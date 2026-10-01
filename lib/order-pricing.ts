import { getAllChapters } from "@/lib/chapters-dynamic";
import { calculateDiscount, type DiscountRule } from "@/lib/discounts";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getCurrentCustomer } from "@/lib/auth";
import { getRedeemableAmount } from "@/lib/loyalty";
import { getShippingRate } from "@/lib/shiprocket";
import { getSetting } from "@/lib/settings";
import {
  assertValidOrderQuantities,
  computeTotalWithCoupon,
  pickBestDiscount,
  priceItemsFromCatalog,
  shippingChargeFor,
} from "@/lib/checkout-rules";
import { resolveReferralDiscount } from "@/lib/referrals";
import { resolveCouponDiscount } from "@/lib/coupons";

// Cash on delivery is off across DevShop Retail OS: in India, COD drives high
// RTO (return-to-origin) and the courier/logistics economics don't work.
// Storefront checkout offers prepaid/UPI only; this flag hides the COD tile
// (checkout config) and rejects any cod_advance from the customer order route.
// One place to flip if a brand ever needs it back. Admin manual orders are
// unaffected. See LEARNINGS.md 2026-09-30.
export const COD_DISABLED = true;

/** The fixed amount charged upfront for a COD order — the rest is collected by the courier on delivery. */
export async function getCodAdvanceRupees() {
  const setting = await getSetting("COD_ADVANCE_AMOUNT_RUPEES");
  return setting ? Number(setting) : 200;
}

/**
 * Recomputes an order's pricing entirely server-side — item prices, the
 * active discount rule, the one best discount (Miles, referral or coupon),
 * and shipping — rather than trusting whatever numbers the client sent. A
 * tampered client request can't change what actually gets billed. Shipping
 * is free on every order (founder decision, 2 Oct 2026); the pincode is still
 * checked so a confirmed "can't deliver here" blocks the order.
 */
export async function computeTrustedOrderTotal(
  items: { slug: string; quantity: number }[],
  requestedRedeemRupees?: number,
  deliveryPincode?: string,
  referralCode?: string | null,
  checkoutPhone?: string,
  couponCode?: string | null,
  paymentType: "prepaid" | "cod_advance" | "post_barter" = "prepaid"
) {
  void paymentType; // shipping no longer depends on the payment type
  assertValidOrderQuantities(items);
  const chapters = await getAllChapters();
  const pricedItems = priceItemsFromCatalog(items, chapters);

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
  let requestedLoyalty = 0;
  if (customer && requestedRedeemRupees && requestedRedeemRupees > 0) {
    const { maxRedeemableRupees } = await getRedeemableAmount(customer.id);
    requestedLoyalty = Math.min(requestedRedeemRupees, maxRedeemableRupees);
  }

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
  }
  const shippingCharge = shippingChargeFor();

  const resolvedReferral = await resolveReferralDiscount(referralCode, customer?.id ?? null, checkoutPhone ?? "");
  const referralCandidate = resolvedReferral ? Math.min(resolvedReferral.discountRupees, subtotal) : 0;

  const resolvedCoupon = await resolveCouponDiscount(couponCode, subtotal);
  const couponCandidate = resolvedCoupon ? resolvedCoupon.discountRupees : 0;

  // One discount per order: only the single largest of the three applies.
  const best = pickBestDiscount({ miles: requestedLoyalty, referral: referralCandidate, coupon: couponCandidate });
  const loyaltyDiscountAmount = best.applied === "miles" ? best.amount : 0;
  const referralDiscountAmount = best.applied === "referral" ? best.amount : 0;
  const couponDiscountAmount = best.applied === "coupon" ? best.amount : 0;
  const referral = best.applied === "referral" ? resolvedReferral : null;
  const coupon = best.applied === "coupon" ? resolvedCoupon : null;

  // ₹1 floor, except a genuine Pay With A Post free-pair code covering the whole order (₹0).
  const total = computeTotalWithCoupon(subtotal, discountAmount, best, coupon?.code) + shippingCharge;

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
    appliedDiscount: best.applied,
    droppedDiscounts: best.dropped,
    shippingCharge,
    total,
    customer,
  };
}
