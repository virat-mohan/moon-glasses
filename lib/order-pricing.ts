import { getAllChapters } from "@/lib/chapters-dynamic";
import { calculateDiscount, type DiscountRule } from "@/lib/discounts";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getCurrentCustomer } from "@/lib/auth";
import { getRedeemableAmount } from "@/lib/loyalty";
import { getShippingRate } from "@/lib/shiprocket";
import { getSetting } from "@/lib/settings";
import { resolveReferralDiscount } from "@/lib/referrals";
import { resolveCouponDiscount } from "@/lib/coupons";

/** The fixed amount charged upfront for a COD order — the rest is collected by the courier on delivery. */
export async function getCodAdvanceRupees() {
  const setting = await getSetting("COD_ADVANCE_AMOUNT_RUPEES");
  return setting ? Number(setting) : 99;
}

/**
 * Recomputes an order's pricing entirely server-side — item prices, the
 * active discount rule, any Miles redemption, and shipping — rather than
 * trusting whatever numbers the client sent. This is what the Razorpay flow
 * charges against; a tampered client request can't change what actually
 * gets billed. Shipping is looked up fresh from Shiprocket by pincode
 * (never a client-supplied amount) so it stays a genuine cost pass-through.
 */
export async function computeTrustedOrderTotal(
  items: { slug: string; quantity: number }[],
  requestedRedeemRupees?: number,
  deliveryPincode?: string,
  referralCode?: string | null,
  checkoutPhone?: string,
  couponCode?: string | null,
  paymentType: "prepaid" | "cod_advance" = "prepaid"
) {
  const chapters = await getAllChapters();
  const pricedItems = items.map((item) => {
    const chapter = chapters.find((c) => c.slug === item.slug);
    if (!chapter) throw new Error(`Unknown chapter: ${item.slug}`);
    return { slug: item.slug, name: chapter.name, price: chapter.price, quantity: item.quantity };
  });

  const subtotal = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const supabase = getSupabaseServerClient();
  const { data: ruleRow } = await supabase
    .from("discount_rules")
    .select("id, name, buy_quantity, discount_percent")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const discountRule: DiscountRule | null = ruleRow
    ? {
        id: ruleRow.id,
        name: ruleRow.name,
        buyQuantity: ruleRow.buy_quantity,
        discountPercent: ruleRow.discount_percent,
      }
    : null;
  const discountAmount = calculateDiscount(pricedItems, discountRule);

  const customer = await getCurrentCustomer();
  let loyaltyDiscountAmount = 0;
  if (customer && requestedRedeemRupees) {
    const { maxRedeemableRupees } = await getRedeemableAmount(customer.id);
    loyaltyDiscountAmount = Math.min(requestedRedeemRupees, maxRedeemableRupees);
  }

  // Free shipping is a prepaid-only perk — a COD order still needs the real
  // Shiprocket rate checked (both to confirm the pincode is deliverable at
  // all, and because the courier collects it as part of the balance due).
  let shippingCharge = 0;
  if (deliveryPincode) {
    const unitCount = pricedItems.reduce((sum, item) => sum + item.quantity, 0);
    const shippingResult = await getShippingRate(deliveryPincode, unitCount);
    // Only a confirmed "Shiprocket can't deliver here" blocks the order —
    // our own misconfiguration or a transient API error must never turn
    // away a real customer, see getShippingRate's doc comment.
    if (shippingResult.status === "checked_unavailable") {
      throw new Error(
        `We can't currently deliver to pincode ${deliveryPincode} — please double-check it or use a different address.`
      );
    }
    const realRate = shippingResult.status === "available" ? shippingResult.rate : 0;
    shippingCharge = paymentType === "prepaid" ? 0 : realRate;
  }

  const referral = await resolveReferralDiscount(referralCode, customer?.id ?? null, checkoutPhone ?? "");
  const referralDiscountAmount = referral ? Math.min(referral.discountRupees, subtotal) : 0;

  const coupon = await resolveCouponDiscount(couponCode, subtotal);
  const couponDiscountAmount = coupon ? coupon.discountRupees : 0;

  const total =
    Math.max(
      0,
      subtotal - discountAmount - loyaltyDiscountAmount - referralDiscountAmount - couponDiscountAmount
    ) + shippingCharge;

  return {
    items: pricedItems,
    subtotal,
    discountAmount,
    discountRule,
    loyaltyDiscountAmount,
    referralDiscountAmount,
    referral,
    couponDiscountAmount,
    coupon,
    shippingCharge,
    total,
    customer,
  };
}
