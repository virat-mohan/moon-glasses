import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import { computeTrustedOrderTotal } from "@/lib/order-pricing";
import { findOrCreateCustomerForGuest, getCurrentCustomer } from "@/lib/auth";
import { earnMilesForOrder, redeemMilesForOrder } from "@/lib/loyalty";
import { applyNewsletterOptIn } from "@/lib/newsletter";
import { recordGuestCheckoutLead } from "@/lib/leads";
import { resolveReferralDiscount, rewardReferrer } from "@/lib/referrals";
import { resolveCouponDiscount, redeemCoupon } from "@/lib/coupons";
import { checkAndAlertLowStock } from "@/lib/inventory";
import { shipOrder } from "@/lib/order-shipping";
import { markCartSessionConverted } from "@/lib/cart-session-convert";
import { sendInvoiceEmail, sendOrderNotificationEmail } from "@/lib/email";
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp-notify";
import { maybeQualifyBarterOrderForCoupon } from "@/lib/post-barter";

/**
 * "Pay With A Post"'s stablemate for regular currency when Razorpay isn't
 * live yet: a real, standalone payment method — the brand's own UPI QR,
 * scanned directly, no payment gateway account required. There's no
 * webhook to confirm a raw UPI transfer landed, so unlike the Razorpay
 * flow this is a two-phase process: createUpiOrder creates the order
 * unpaid and unshipped the moment the shopper says they're paying,
 * confirmUpiOrderPayment (called from the "Mark Paid" button in
 * /admin/orders once the admin actually sees the money land) is what
 * decrements inventory, ships, and fires every other paid-order side
 * effect — mirroring lib/order-fulfillment.ts's finalizeOrder tail
 * exactly, just split across the two phases instead of done atomically.
 */
export async function getUpiPaymentConfig() {
  const [upiId, qrImageUrl, payeeNameSetting] = await Promise.all([
    getSetting("UPI_ID"),
    getSetting("UPI_QR_IMAGE_URL"),
    getSetting("UPI_PAYEE_NAME"),
  ]);
  if (!upiId || !qrImageUrl) return null;
  const brand = await getBrandProfile();
  return { upiId, qrImageUrl, payeeName: payeeNameSetting || brand.brandName };
}

export type UpiOrderPayload = {
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
  isGift?: boolean;
  giftNote?: string | null;
  sessionKey?: string;
  redeemMilesRupees?: number;
  newsletterOptIn?: boolean;
  referralCode?: string | null;
  couponCode?: string | null;
};

export async function createUpiOrder(payload: UpiOrderPayload) {
  const config = await getUpiPaymentConfig();
  if (!config) throw new Error("UPI payment isn't set up yet — add UPI_ID and UPI_QR_IMAGE_URL in /admin/settings");

  const pricing = await computeTrustedOrderTotal(
    payload.items,
    payload.redeemMilesRupees,
    payload.customer.pincode,
    payload.referralCode,
    payload.customer.phone,
    payload.couponCode,
    "prepaid" // free shipping — UPI is a full-payment method, not COD
  );
  if (pricing.total <= 0) throw new Error("Order total must be greater than zero");

  const customer = await getCurrentCustomer();
  const wasGuest = !customer;
  const guestCustomer = wasGuest
    ? await findOrCreateCustomerForGuest(payload.customer.phone, payload.customer.email, payload.customer.name)
    : null;
  const effectiveCustomerId = customer?.id ?? guestCustomer?.id ?? null;

  const supabase = getSupabaseServerClient();
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
      discount_amount: pricing.discountAmount,
      loyalty_discount_amount: pricing.loyaltyDiscountAmount,
      shipping_charge: pricing.shippingCharge,
      total: pricing.total,
      payment_type: "upi_qr",
      payment_status: "unpaid",
      referral_code_used: pricing.referral ? payload.referralCode?.toUpperCase() : null,
      referral_discount_amount: pricing.referralDiscountAmount,
      coupon_code_used: pricing.coupon ? pricing.coupon.code : null,
      coupon_discount_amount: pricing.couponDiscountAmount,
      is_gift: payload.isGift ?? false,
      gift_note: payload.giftNote ?? null,
      customer_id: effectiveCustomerId,
      status: "pending_upi_payment",
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

  if (pricing.discountRule && pricing.discountAmount > 0) {
    await supabase.from("discount_rule_redemptions").insert({
      discount_rule_id: pricing.discountRule.id,
      order_id: savedOrder.id,
      customer_phone: payload.customer.phone,
      customer_email: payload.customer.email,
      discount_amount: pricing.discountAmount,
    });
  }

  if (payload.newsletterOptIn != null) {
    await applyNewsletterOptIn(effectiveCustomerId, savedOrder.customer_email, payload.newsletterOptIn);
  }

  await markCartSessionConverted(payload.sessionKey, {
    id: savedOrder.id,
    customer_email: savedOrder.customer_email,
    customer_phone: savedOrder.customer_phone,
    total: pricing.total,
  });

  const upiLink =
    `upi://pay?pa=${encodeURIComponent(config.upiId)}&pn=${encodeURIComponent(config.payeeName)}` +
    `&am=${pricing.total}&cu=INR&tn=${encodeURIComponent(`Order ${savedOrder.id.slice(0, 8).toUpperCase()}`)}`;

  return {
    orderId: savedOrder.id as string,
    total: pricing.total as number,
    upiId: config.upiId,
    qrImageUrl: config.qrImageUrl,
    payeeName: config.payeeName,
    upiLink,
  };
}

/** Called from the "Mark Paid" action in /admin/orders once an admin has actually confirmed the transfer landed — never automatic, since there's no gateway webhook for a raw UPI transfer. */
export async function confirmUpiOrderPayment(orderId: string) {
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found");
  if (order.payment_type !== "upi_qr") throw new Error("Not a UPI QR order");
  if (order.payment_status === "paid") return { alreadyConfirmed: true as const };

  const { data: items } = await supabase
    .from("order_items")
    .select("chapter_slug, chapter_name, unit_price, quantity")
    .eq("order_id", orderId);

  await supabase.from("orders").update({ payment_status: "paid", status: "confirmed" }).eq("id", orderId);

  for (const item of items ?? []) {
    const { data: inv } = await supabase.from("inventory").select("stock_on_hand").eq("chapter_slug", item.chapter_slug).maybeSingle();
    if (inv) {
      const newStock = Math.max(0, inv.stock_on_hand - item.quantity);
      await supabase.from("inventory").update({ stock_on_hand: newStock }).eq("chapter_slug", item.chapter_slug);
      await checkAndAlertLowStock(item.chapter_slug, newStock);
    }
  }

  if (order.customer_id) {
    const capsBought = (items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    if (order.loyalty_discount_amount > 0) {
      await redeemMilesForOrder(order.customer_id, orderId, order.loyalty_discount_amount);
    }
    await earnMilesForOrder(order.customer_id, orderId, capsBought);
  } else {
    await recordGuestCheckoutLead({
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      chapterName: items?.[0]?.chapter_name,
    });
  }

  if (order.referral_code_used) {
    const referral = await resolveReferralDiscount(order.referral_code_used, order.customer_id, order.customer_phone);
    if (referral) {
      await rewardReferrer(referral.referrerCustomerId, orderId, order.customer_id, order.customer_phone, referral.rewardMiles);
    }
  }

  if (order.coupon_code_used) {
    const coupon = await resolveCouponDiscount(order.coupon_code_used, order.subtotal);
    if (coupon) {
      await redeemCoupon(coupon.couponId, orderId, order.coupon_discount_amount, order.customer_phone, order.customer_email);
      // A friend paying via UPI QR with a barterer's "Pay With A Post" code
      // is a real, paid redemption exactly like the Razorpay/manual paths —
      // must count toward that barterer's progress too.
      try {
        await maybeQualifyBarterOrderForCoupon(order.coupon_code_used, order.customer_phone, order.customer_email);
      } catch (err) {
        console.error("Failed to check barter qualification", orderId, err);
      }
    }
  }

  await Promise.allSettled([
    sendInvoiceEmail(order, items ?? []),
    sendOrderNotificationEmail(order, items ?? []),
    sendOrderConfirmationWhatsApp(order, items ?? []),
  ]);

  try {
    await shipOrder(orderId);
  } catch (err) {
    console.error("Auto-ship failed for confirmed UPI order", orderId, err);
  }

  return { alreadyConfirmed: false as const };
}
