// Pure checkout rules (founder decisions, 2 Oct 2026). No imports on purpose:
// these run on the server (pricing, fulfillment, routes), in the browser
// (cart and checkout UI) and in node tests, so the same rule is enforced
// everywhere. See lib/checkout-rules.test.ts.

/** Per-line quantity limits. Integers only. */
export const MIN_LINE_QUANTITY = 1;
export const MAX_LINE_QUANTITY = 50;

/** Pay With A Post is only offered while a product has at least this much stock (Inventory Master). */
export const PWAP_MIN_STOCK = 25;

/** The lowest total an order can be charged after discounts, in rupees. */
export const MIN_ORDER_TOTAL_RUPEES = 1;

export const RAZORPAY_DISABLED_MESSAGE = "Card payments are not available. Please pay by UPI.";
export const COD_DISABLED_MESSAGE = "Cash on delivery isn't available. Please pay by UPI.";
export const WHATSAPP_ORDERS_DISABLED_MESSAGE = "Please pay by UPI at checkout";

export function isValidLineQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity >= MIN_LINE_QUANTITY &&
    quantity <= MAX_LINE_QUANTITY
  );
}

/** Throws a shopper-readable error unless every line has a whole-number quantity from 1 to 50. */
export function assertValidOrderQuantities(items: { slug: string; quantity: unknown }[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Your cart is empty.");
  for (const item of items) {
    if (!isValidLineQuantity(item?.quantity)) {
      throw new Error(
        `Quantity must be a whole number from ${MIN_LINE_QUANTITY} to ${MAX_LINE_QUANTITY} for each item.`
      );
    }
  }
}

/** Clamp for the cart/checkout UI: anything outside 1..50 is pulled back in (below 1 means "remove"). */
export function clampLineQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return MIN_LINE_QUANTITY;
  return Math.min(MAX_LINE_QUANTITY, Math.max(MIN_LINE_QUANTITY, Math.floor(quantity)));
}

/**
 * Prices each line from the catalogue only. Whatever price/name the client
 * sent is ignored, so a tampered request can't change what gets billed.
 */
export function priceItemsFromCatalog(
  items: { slug: string; quantity: number }[],
  catalog: { slug: string; name: string; price: number }[]
) {
  assertValidOrderQuantities(items);
  return items.map((item) => {
    const product = catalog.find((c) => c.slug === item.slug);
    if (!product) throw new Error(`Unknown chapter: ${item.slug}`);
    return { slug: item.slug, name: product.name, price: product.price, quantity: item.quantity };
  });
}

export type DiscountSource = "miles" | "referral" | "coupon";

/**
 * One discount per order: of Miles redemption, a referral code and a coupon,
 * only the single largest applies. Ties go miles, then referral, then coupon
 * (the order listed). Returns what was applied and what was dropped so the
 * checkout can say so.
 */
export function pickBestDiscount(candidates: { miles?: number; referral?: number; coupon?: number }) {
  const order: DiscountSource[] = ["miles", "referral", "coupon"];
  const offered = order
    .map((source) => ({ source, amount: Math.max(0, Math.floor(candidates[source] ?? 0)) }))
    .filter((c) => c.amount > 0);
  if (offered.length === 0) {
    return { applied: null as DiscountSource | null, amount: 0, dropped: [] as DiscountSource[] };
  }
  const best = offered.reduce((a, b) => (b.amount > a.amount ? b : a));
  return {
    applied: best.source as DiscountSource | null,
    amount: best.amount,
    dropped: offered.filter((c) => c.source !== best.source).map((c) => c.source),
  };
}

/** Subtotal less the bulk rule and the one chosen discount. Shipping is free. Never below ₹1. */
export function computeOrderTotal(subtotal: number, bulkDiscount: number, bestDiscount: number) {
  return Math.max(MIN_ORDER_TOTAL_RUPEES, subtotal - bulkDiscount - bestDiscount);
}

/** Shipping is free on every order (cost is inside the price). Kept as a function so the rule has one home. */
export function shippingChargeFor(): 0 {
  return 0;
}

/** Storefront checkout is UPI only (and Pay With A Post). Razorpay and COD are refused. */
export function assertStorefrontPaymentAllowed(paymentType: string | undefined | null) {
  if (paymentType === "cod_advance" || paymentType === "cod") throw new Error(COD_DISABLED_MESSAGE);
  if (paymentType === "razorpay" || paymentType === "card") throw new Error(RAZORPAY_DISABLED_MESSAGE);
}

export function isPwapAvailableForStock(stock: number | null | undefined) {
  return typeof stock === "number" && stock >= PWAP_MIN_STOCK;
}

/** Throws unless every line's product has at least PWAP_MIN_STOCK on hand. */
export function assertPwapStock(items: { slug: string }[], stockBySlug: Record<string, number | undefined>) {
  for (const item of items) {
    if (!isPwapAvailableForStock(stockBySlug[item.slug])) {
      throw new Error("Pay With A Post isn't available for this product right now. Please pay by UPI.");
    }
  }
}

/** True when a line can be sold from what's on hand. */
export function hasStockFor(stock: number | null | undefined, quantity: number) {
  return typeof stock === "number" && stock >= quantity;
}

/**
 * Meta dedupes a browser pixel event and a Conversions API event when both
 * carry the same event_id. The order id is that shared id, so a Purchase is
 * counted once however many senders fire it.
 */
export function purchaseEventId(orderId: string) {
  return orderId;
}

/**
 * The arguments for the browser pixel's fbq("track", ...) call. A Purchase
 * must carry the order id as eventID (fbq's 4th argument) so Meta merges it
 * with the server Conversions API event of the same event_id.
 */
export function pixelTrackArgs(
  eventName: string,
  params: { value?: number; currency?: string; orderId?: string } = {}
): unknown[] {
  if (eventName === "Purchase" && !params.orderId) {
    throw new Error("Purchase needs the order id so Meta can dedupe it");
  }
  const custom = params.value != null ? { value: params.value, currency: params.currency ?? "INR" } : undefined;
  if (eventName === "Purchase") {
    return ["track", eventName, custom ?? {}, { eventID: purchaseEventId(params.orderId as string) }];
  }
  return custom ? ["track", eventName, custom] : ["track", eventName];
}

/**
 * Pay With A Post free-pair codes ("another pair on us") are minted as
 * FREE<NAME><n><xx> in lib/post-barter.ts. Before the ₹1 floor, such a code
 * covering the whole order made it ₹0 and it confirmed instantly; that still
 * holds, and only for these codes.
 */
export function isFreePairCouponCode(code: string | null | undefined) {
  return typeof code === "string" && /^FREE[A-Z]*\d+[A-Z0-9]{0,2}$/.test(code.trim().toUpperCase());
}

/** Total after the one chosen discount. Floors at ₹1 unless a genuine free-pair coupon covers the whole order. */
export function computeTotalWithCoupon(
  subtotal: number,
  bulkDiscount: number,
  best: { applied: DiscountSource | null; amount: number },
  couponCode: string | null | undefined
) {
  const remaining = subtotal - bulkDiscount;
  if (best.applied === "coupon" && isFreePairCouponCode(couponCode) && best.amount >= remaining) return 0;
  return computeOrderTotal(subtotal, bulkDiscount, best.amount);
}

/** The admin alert when a paid UPI order is refused for short stock. */
export function buildStockShortAlert(order: {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total: number;
}) {
  const ref = order.id.slice(0, 8).toUpperCase();
  const subject = `Refund needed: order #${ref} paid but out of stock`;
  const lines = [
    "Refund needed.",
    `Order: ${order.id} (#${ref})`,
    `Customer: ${order.customer_name ?? "-"}, ${order.customer_phone ?? "-"}, ${order.customer_email ?? "-"}`,
    `Amount paid: ₹${Number(order.total).toLocaleString("en-IN")}`,
    "The UPI payment landed but stock was short, so the sale was refused (status stock_short). Refund the customer.",
  ];
  return { subject, text: lines.join("\n") };
}
