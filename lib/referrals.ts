import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

function randomCode() {
  // Base36, uppercased, 6 chars — short enough to say out loud, long enough
  // that collisions are rare (retried below on the off chance one happens).
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Every customer gets one, generated lazily on first account access rather than at signup — cheaper and nothing depends on it existing before then. */
export async function getOrCreateReferralCode(customerId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("customers")
    .select("referral_code")
    .eq("id", customerId)
    .maybeSingle();
  if (existing?.referral_code) return existing.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from("customers").update({ referral_code: code }).eq("id", customerId);
    if (!error) return code;
    // Unique-constraint collision — vanishingly unlikely at this scale, retry with a new code.
  }
  throw new Error("Could not generate a unique referral code");
}

async function getReferralConfig() {
  const [discountSetting, milesSetting] = await Promise.all([
    getSetting("REFERRAL_DISCOUNT_RUPEES"),
    getSetting("REFERRAL_REWARD_MILES"),
  ]);
  return {
    discountRupees: discountSetting ? Number(discountSetting) : 200,
    rewardMiles: milesSetting ? Number(milesSetting) : 500,
  };
}

/**
 * Looks up whether a referral code is valid and usable for this specific
 * checkout — used server-side to compute the discount, never trusting a
 * client-supplied discount amount directly. Returns null (no discount, no
 * error surfaced to the shopper) rather than throwing, since an invalid or
 * self-referred code should just silently not apply rather than block a
 * sale — the code is analytics/growth metadata, not something worth
 * failing an order over.
 */
export async function resolveReferralDiscount(
  referralCode: string | null | undefined,
  checkoutCustomerId: string | null,
  checkoutPhone: string
) {
  if (!referralCode) return null;
  const supabase = getSupabaseServerClient();

  const { data: referrer } = await supabase
    .from("customers")
    .select("id, phone")
    .eq("referral_code", referralCode.toUpperCase())
    .maybeSingle();
  if (!referrer) return null;
  // No self-referral — checked by account id (logged-in checkout) and by
  // phone (guest checkout has no customer_id yet at this point, so the id
  // check alone would miss someone using their own code as a guest).
  if (checkoutCustomerId && referrer.id === checkoutCustomerId) return null;
  if (checkoutPhone && referrer.phone && referrer.phone === checkoutPhone) return null;

  // Referral is for acquiring a genuinely new customer, not a discount on a
  // repeat order — check by customer_id if logged in, otherwise by phone
  // (the best available signal for a guest checkout).
  const priorOrdersQuery = checkoutCustomerId
    ? supabase.from("orders").select("id").eq("customer_id", checkoutCustomerId).limit(1)
    : supabase.from("orders").select("id").eq("customer_phone", checkoutPhone).limit(1);
  const { data: priorOrders } = await priorOrdersQuery;
  if (priorOrders && priorOrders.length > 0) return null;

  const { discountRupees, rewardMiles } = await getReferralConfig();
  return { referrerCustomerId: referrer.id as string, discountRupees, rewardMiles };
}

/**
 * Rewards the referrer once the referred order actually saves — fires
 * alongside earnMilesForOrder for the new customer's own purchase, same
 * moment, same "no need to wait for delivery" logic already established
 * for regular Miles.
 */
export async function rewardReferrer(
  referrerCustomerId: string,
  referredOrderId: string,
  referredCustomerId: string | null,
  referredPhone: string,
  rewardMiles: number
) {
  if (rewardMiles <= 0) return;
  const supabase = getSupabaseServerClient();
  await Promise.all([
    supabase.from("loyalty_ledger").insert({
      customer_id: referrerCustomerId,
      delta: rewardMiles,
      reason: "referral",
      order_id: referredOrderId,
    }),
    supabase.from("referrals").insert({
      referrer_customer_id: referrerCustomerId,
      referred_order_id: referredOrderId,
      referred_customer_id: referredCustomerId,
      referred_phone: referredPhone,
      reward_miles: rewardMiles,
    }),
  ]);
}
