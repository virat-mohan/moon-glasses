import { createHmac } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getPublicFollowerCount, getBusinessDiscoveryProfile, parseInstagramHandle } from "@/lib/instagram";
import { computeTrustedOrderTotal } from "@/lib/order-pricing";
import { findOrCreateCustomerForGuest } from "@/lib/auth";
import { applyNewsletterOptIn } from "@/lib/newsletter";
import { markCartSessionConverted } from "@/lib/cart-session-convert";
import { checkAndAlertLowStock } from "@/lib/inventory";
import { shipOrder } from "@/lib/order-shipping";
import {
  sendPostBarterOrderConfirmationEmail,
  sendPostBarterQualifiedEmail,
  sendPostBarterProgressEmail,
  sendOrderNotificationEmail,
} from "@/lib/email";

const DEFAULT_MIN_FOLLOWERS = 5000;
const DEFAULT_REQUIRED_ORDERS = 3;
// Pay With A Post codes are attribution-only, not a discount — friends
// checking out with one still pay full price. Kept as a real, admin-editable
// setting (POST_BARTER_FRIEND_DISCOUNT_RUPEES) rather than removing the
// column, in case that changes later.
const DEFAULT_FRIEND_DISCOUNT_RUPEES = 0;
const DEFAULT_GIFT_FIRST_DAILY_CAP = 10;

export type BarterTier = "gift_first" | "sell_first";

export async function getPostBarterConfig() {
  const [minFollowersSetting, requiredOrdersSetting, friendDiscountSetting, dailyCapSetting] = await Promise.all([
    getSetting("POST_BARTER_MIN_FOLLOWERS"),
    getSetting("POST_BARTER_REQUIRED_ORDERS"),
    getSetting("POST_BARTER_FRIEND_DISCOUNT_RUPEES"),
    getSetting("POST_BARTER_GIFT_FIRST_DAILY_CAP"),
  ]);
  return {
    minFollowers: minFollowersSetting ? Number(minFollowersSetting) : DEFAULT_MIN_FOLLOWERS,
    requiredOrders: requiredOrdersSetting ? Number(requiredOrdersSetting) : DEFAULT_REQUIRED_ORDERS,
    friendDiscountRupees: friendDiscountSetting ? Number(friendDiscountSetting) : DEFAULT_FRIEND_DISCOUNT_RUPEES,
    giftFirstDailyCap: dailyCapSetting ? Number(dailyCapSetting) : DEFAULT_GIFT_FIRST_DAILY_CAP,
  };
}

/** Start of "today" in IST, matching how the rest of the admin (e.g. reports) reasons about a calendar day. */
function startOfTodayIst(): string {
  const now = new Date();
  const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  return new Date(`${istDateStr}T00:00:00+05:30`).toISOString();
}

/** Exported for the public availability endpoint (app/api/checkout/post-barter/gift-first-availability) that powers the on-site urgency countdown — how many Gift First spots are left today. */
export async function giftFirstCountToday(): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("is_post_barter", true)
    .eq("barter_tier", "gift_first")
    .gte("created_at", startOfTodayIst());
  return count ?? 0;
}

export type TierResult = { tier: BarterTier; followerCount: number | null; minFollowers: number; capReached: boolean };

/**
 * Open to anyone — there is no eligibility gate here, only a tier. Followers
 * are still checked live via Instagram Business Discovery (never
 * self-reported), but the number only decides WHEN the product ships, not
 * WHETHER someone can participate:
 * - gift_first (>= minFollowers, and today's gift_first cap not yet hit):
 *   trusted with the product immediately — they post afterward. Still gated
 *   by verifyGiftFirstOwnership before an order actually ships (see
 *   createPostBarterOrder) — classification alone is not enough to prove
 *   the applicant controls the handle they typed in.
 * - sell_first (< minFollowers, unverifiable, or the daily gift_first cap is
 *   already full): the safer default. No product goes out yet; they post to
 *   share their code, and only once it's driven the required number of real
 *   PAID orders does their own order ship.
 */
export async function classifyPostBarterApplicant(instagramHandle: string): Promise<TierResult> {
  const { minFollowers, giftFirstDailyCap } = await getPostBarterConfig();
  const followerCount = await getPublicFollowerCount(instagramHandle);
  const meetsFollowerBar = followerCount != null && followerCount >= minFollowers;

  if (!meetsFollowerBar) {
    return { tier: "sell_first", followerCount, minFollowers, capReached: false };
  }

  const countToday = await giftFirstCountToday();
  const capReached = countToday >= giftFirstDailyCap;
  return { tier: capReached ? "sell_first" : "gift_first", followerCount, minFollowers, capReached };
}

const VERIFICATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes — long enough to edit a bio and click Verify, short enough that a leaked code is useless later

function verificationSecret(): string {
  // Server-only value, already never exposed to the client — reused here
  // purely as an HMAC key so verification codes need no database row and
  // no new setting. Never used for anything Supabase-auth-related here.
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "post-barter-fallback-secret";
}

function codeForWindow(handle: string, windowStart: number): string {
  const h = createHmac("sha256", verificationSecret())
    .update(`${handle.toLowerCase()}:${windowStart}`)
    .digest("hex");
  return `MOON-${h.slice(0, 6).toUpperCase()}`;
}

/**
 * A stateless, short-lived proof-of-ownership code for the gift_first tier
 * — the one tier that ships real inventory before any content or sales
 * exist to check against. Asking someone to drop this in their Instagram
 * bio for a few minutes (verified via Business Discovery's `biography`
 * field) proves they control the account, without a full OAuth connect
 * flow. No DB write: the code is a deterministic HMAC of the handle and the
 * current 15-minute window, so verifying it later is just recomputing it.
 */
export function generateGiftFirstVerificationCode(instagramHandle: string): string {
  const handle = parseInstagramHandle(instagramHandle).toLowerCase();
  const windowStart = Math.floor(Date.now() / VERIFICATION_WINDOW_MS) * VERIFICATION_WINDOW_MS;
  return codeForWindow(handle, windowStart);
}

/** Confirms the given code is genuinely sitting in that handle's live Instagram bio right now — checked against the current window and the one before it, so a code generated a few minutes ago (right before the window rolled over) still verifies. */
export async function verifyGiftFirstOwnership(instagramHandle: string, code: string): Promise<boolean> {
  const handle = parseInstagramHandle(instagramHandle).toLowerCase();
  if (!handle || !code) return false;

  const now = Date.now();
  const currentWindowStart = Math.floor(now / VERIFICATION_WINDOW_MS) * VERIFICATION_WINDOW_MS;
  const validCodes = [codeForWindow(handle, currentWindowStart), codeForWindow(handle, currentWindowStart - VERIFICATION_WINDOW_MS)];
  if (!validCodes.includes(code.trim().toUpperCase())) return false;

  const profile = await getBusinessDiscoveryProfile(handle);
  if (!profile) return false;
  return profile.biography.toUpperCase().includes(code.trim().toUpperCase());
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Rotated onto the sharer's first name (e.g. "ANUN" -> "ANUNAFTERGLOW") so
// the code reads like something worth sharing rather than a random string —
// echoes the brand's night-out positioning instead of being purely
// functional. Picked randomly per mint (not hashed) since a nicer-sounding
// code is worth more than the same person always landing on the same word.
const THEME_WORDS = [
  "AFTERGLOW",
  "MIDNIGHT",
  "MOONLIT",
  "NIGHTFALL",
  "STARLIT",
  "NEONNIGHTS",
  "AFTERDARK",
  "DUSKFALL",
  "GLOWUP",
  "NIGHTOWL",
];

/** Mints a shareable coupon code for this barter order — same shape as a creator's coupon (lib/creators.ts), reusing the exact checkout coupon engine so a friend's redemption is a completely ordinary coupon redemption. Full price for the friend — see discount_value below — this is attribution, not a discount mechanic. */
async function createBarterCouponCode(customerName: string, instagramHandle: string, friendDiscountRupees: number): Promise<string> {
  const supabase = getSupabaseServerClient();
  const firstName = customerName.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const base =
    firstName ||
    parseInstagramHandle(instagramHandle).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase() ||
    "CREATOR";

  for (let attempt = 0; attempt < 5; attempt++) {
    const theme = THEME_WORDS[Math.floor(Math.random() * THEME_WORDS.length)];
    const code = `${base}${theme}${attempt === 0 ? "" : randomSuffix()}`;
    const { error } = await supabase.from("coupon_codes").insert({
      code,
      discount_type: "flat",
      discount_value: friendDiscountRupees,
    });
    if (!error) return code;
  }
  throw new Error("Could not generate a unique barter coupon code");
}

/** Shared by both ship paths: the moment a barter order is either created (gift_first) or qualifies (sell_first), decrement inventory and ship exactly like a normal paid order does. */
async function decrementInventoryAndShip(orderId: string) {
  const supabase = getSupabaseServerClient();
  const { data: items } = await supabase.from("order_items").select("chapter_slug, quantity").eq("order_id", orderId);
  for (const item of items ?? []) {
    const { data: inv } = await supabase.from("inventory").select("stock_on_hand").eq("chapter_slug", item.chapter_slug).maybeSingle();
    if (inv) {
      const newStock = Math.max(0, inv.stock_on_hand - item.quantity);
      await supabase.from("inventory").update({ stock_on_hand: newStock }).eq("chapter_slug", item.chapter_slug);
      await checkAndAlertLowStock(item.chapter_slug, newStock);
    }
  }
  try {
    await shipOrder(orderId);
  } catch (err) {
    console.error("Auto-ship failed for barter order", orderId, err);
  }
}

export type PostBarterOrderPayload = {
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: { slug: string; quantity: number }[];
  instagramHandle: string;
  /** Only meaningful when the applicant classifies as gift_first — see verifyGiftFirstOwnership. Missing or wrong just means a safe downgrade to sell_first, never a hard rejection. */
  ownershipCode?: string;
  /** Required (server-enforced) whenever the order actually resolves to gift_first — explicit acceptance of the post-within-12-hours-of-delivery condition. Meaningless for sell_first, where nothing ships before a post exists anyway. */
  termsAccepted?: boolean;
  isGift?: boolean;
  giftNote?: string | null;
  sessionKey?: string;
  newsletterOptIn?: boolean;
};

/**
 * Creates a "Pay With A Post" order — no payment gateway involved at all.
 * Tier is decided server-side (see classifyPostBarterApplicant), never
 * trusting whatever the client showed the shopper. A gift_first order ships
 * immediately, right here — but only after ownership of the handle is
 * actually verified; failing that check downgrades to sell_first rather
 * than blocking checkout outright. A sell_first order deliberately does NOT
 * ship — it only ships once maybeQualifyBarterOrderForCoupon below confirms
 * enough real, paid orders have come in through their code.
 */
export async function createPostBarterOrder(payload: PostBarterOrderPayload) {
  const totalQuantity = payload.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity !== 1) {
    throw new Error("Pay With A Post covers one item per order — adjust your cart to a single item.");
  }

  const supabase = getSupabaseServerClient();

  // One active barter order per person at a time — also doubles as
  // idempotency protection against a double-submit/retry: a retry just
  // hands back the same order instead of minting a second one.
  const { data: existing } = await supabase
    .from("orders")
    .select("id, barter_coupon_code, barter_required_orders, barter_tier")
    .eq("is_post_barter", true)
    .is("barter_qualified_at", null)
    .or(`customer_phone.eq.${payload.customer.phone},customer_email.eq.${payload.customer.email}`)
    .maybeSingle();
  if (existing) {
    return {
      orderId: existing.id as string,
      couponCode: existing.barter_coupon_code as string,
      requiredOrders: existing.barter_required_orders as number,
      tier: existing.barter_tier as BarterTier,
    };
  }

  const { tier: classifiedTier, followerCount } = await classifyPostBarterApplicant(payload.instagramHandle);
  const { requiredOrders, friendDiscountRupees } = await getPostBarterConfig();

  // Re-verify ownership server-side even if the client claims it already
  // checked — never trust a client-supplied "verified" flag for something
  // that ships real inventory on trust.
  let tier = classifiedTier;
  if (classifiedTier === "gift_first") {
    const verified = payload.ownershipCode
      ? await verifyGiftFirstOwnership(payload.instagramHandle, payload.ownershipCode)
      : false;
    if (!verified) tier = "sell_first";
  }

  // Binding condition for shipping on trust: explicit acceptance of the
  // post-within-12-hours-of-delivery term (see barter_charge_deadline_at,
  // set once Shiprocket confirms delivery). Never silently downgrade this
  // one — a shopper who didn't see/accept the term must be told plainly,
  // not quietly re-routed into sell_first.
  if (tier === "gift_first" && !payload.termsAccepted) {
    throw new Error("Please accept the Pay With A Post terms to ship now — or continue without checking the box to post first instead.");
  }

  const pricing = await computeTrustedOrderTotal(payload.items, 0, payload.customer.pincode, null, payload.customer.phone, null, "prepaid");

  const guestCustomer = await findOrCreateCustomerForGuest(payload.customer.phone, payload.customer.email, payload.customer.name);
  const couponCode = await createBarterCouponCode(payload.customer.name, payload.instagramHandle, friendDiscountRupees);
  const isGiftFirst = tier === "gift_first";

  const { data: savedOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name: payload.customer.name,
      customer_phone: payload.customer.phone,
      customer_email: payload.customer.email,
      delivery_address: payload.customer.address,
      delivery_city: payload.customer.city ?? null,
      delivery_state: payload.customer.state ?? null,
      delivery_pincode: payload.customer.pincode ?? null,
      subtotal: pricing.subtotal,
      total: pricing.total,
      shipping_charge: 0,
      payment_type: "post_barter",
      payment_status: "barter_pending",
      is_gift: payload.isGift ?? false,
      gift_note: payload.giftNote ?? null,
      customer_id: guestCustomer?.id ?? null,
      status: "confirmed",
      is_post_barter: true,
      barter_tier: tier,
      barter_instagram_handle: parseInstagramHandle(payload.instagramHandle),
      barter_follower_count: followerCount,
      barter_coupon_code: couponCode,
      barter_required_orders: requiredOrders,
      // gift_first ships on trust right away — there's nothing left to
      // "qualify" for, so this is stamped immediately rather than left for
      // maybeQualifyBarterOrderForCoupon to set later.
      barter_qualified_at: isGiftFirst ? new Date().toISOString() : null,
      barter_terms_accepted_at: isGiftFirst ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (orderError) throw orderError;

  const orderItems = pricing.items.map((item) => ({
    order_id: savedOrder.id,
    chapter_slug: item.slug,
    chapter_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
  }));
  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  if (payload.newsletterOptIn != null) {
    await applyNewsletterOptIn(guestCustomer?.id ?? null, savedOrder.customer_email, payload.newsletterOptIn);
  }

  await markCartSessionConverted(payload.sessionKey, {
    id: savedOrder.id,
    customer_email: savedOrder.customer_email,
    customer_phone: savedOrder.customer_phone,
    total: pricing.total,
  });

  if (isGiftFirst) {
    await decrementInventoryAndShip(savedOrder.id);
  }

  await Promise.allSettled([
    sendPostBarterOrderConfirmationEmail(savedOrder.customer_email, savedOrder.customer_name, savedOrder.id, couponCode, requiredOrders, tier),
    sendOrderNotificationEmail(savedOrder, orderItems),
  ]);

  return { orderId: savedOrder.id as string, couponCode, requiredOrders, tier };
}

/**
 * Called right after any coupon redemption (see lib/order-fulfillment.ts
 * and app/api/orders/route.ts) to check whether that redemption was the one
 * that pushed a sell_first "Pay With A Post" order over its required-orders
 * line. gift_first orders already have barter_qualified_at set at creation,
 * so the `is("barter_qualified_at", null)` filter below naturally skips
 * them — this function only ever does anything for sell_first orders.
 *
 * Only counts redemptions on orders that actually got paid
 * (payment_status = 'paid') — a redemption from the no-payment-gateway
 * WhatsApp-manual order path (see app/api/orders/route.ts, which never
 * confirms real payment) must never be able to fake progress toward a free
 * shipment. Also excludes redemptions that match the barterer's own
 * phone/email — buying from themselves with their own code must never
 * count toward their own qualification, and never triggers a progress email
 * either (buyerPhone/buyerEmail identify who JUST redeemed, so a
 * self-redemption short-circuits before any email is even considered).
 */
export async function maybeQualifyBarterOrderForCoupon(
  couponCode: string | null | undefined,
  buyerPhone?: string | null,
  buyerEmail?: string | null
) {
  if (!couponCode) return;
  const supabase = getSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_phone, customer_email, barter_required_orders, barter_qualified_at")
    .eq("is_post_barter", true)
    .eq("barter_coupon_code", couponCode.toUpperCase())
    .is("barter_qualified_at", null)
    .maybeSingle();
  if (!order) return;

  const buyerIsBarterer =
    (buyerPhone && order.customer_phone && buyerPhone === order.customer_phone) ||
    (buyerEmail && order.customer_email && buyerEmail === order.customer_email);
  if (buyerIsBarterer) return;

  const { data: coupon } = await supabase.from("coupon_codes").select("id").eq("code", couponCode.toUpperCase()).maybeSingle();
  if (!coupon) return;

  const { data: redemptions } = await supabase
    .from("coupon_redemptions")
    .select("customer_phone, customer_email, order_id")
    .eq("coupon_id", coupon.id);

  const redemptionOrderIds = (redemptions ?? []).map((r) => r.order_id).filter(Boolean) as string[];
  let paidOrderIds = new Set<string>();
  if (redemptionOrderIds.length > 0) {
    const { data: paidOrders } = await supabase
      .from("orders")
      .select("id")
      .in("id", redemptionOrderIds)
      .eq("payment_status", "paid");
    paidOrderIds = new Set((paidOrders ?? []).map((o) => o.id as string));
  }

  const qualifyingCount = (redemptions ?? []).filter((r) => {
    if (!r.order_id || !paidOrderIds.has(r.order_id)) return false;
    const samePhone = r.customer_phone && order.customer_phone && r.customer_phone === order.customer_phone;
    const sameEmail = r.customer_email && order.customer_email && r.customer_email === order.customer_email;
    return !samePhone && !sameEmail;
  }).length;

  if (qualifyingCount < order.barter_required_orders) {
    try {
      await sendPostBarterProgressEmail(order.customer_email, qualifyingCount, order.barter_required_orders);
    } catch (err) {
      console.error("Failed to send barter progress email", order.id, err);
    }
    return;
  }

  await supabase.from("orders").update({ barter_qualified_at: new Date().toISOString() }).eq("id", order.id);
  await decrementInventoryAndShip(order.id);

  try {
    await sendPostBarterQualifiedEmail(order.customer_email, order.customer_phone);
  } catch (err) {
    console.error("Failed to send barter-qualified email", order.id, err);
  }
}
