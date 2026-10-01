import { getSupabaseServerClient } from "@/lib/supabase";
import { logTrackingEvent } from "@/lib/tracking";
import { getSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import { computeTrustedOrderTotal } from "@/lib/order-pricing";
import { findOrCreateCustomerForGuest, getCurrentCustomer } from "@/lib/auth";
import { earnMilesForOrder, redeemMilesForOrder } from "@/lib/loyalty";
import { applyNewsletterOptIn } from "@/lib/newsletter";
import { recordGuestCheckoutLead } from "@/lib/leads";
import { resolveReferralDiscount, rewardReferrer } from "@/lib/referrals";
import { resolveCouponDiscount, redeemCoupon } from "@/lib/coupons";
import { decrementStockForOrder, getInventoryMap } from "@/lib/inventory";
import { hasStockFor } from "@/lib/checkout-rules";
import { shipOrder } from "@/lib/order-shipping";
import { markCartSessionConverted, sendPurchaseConversion } from "@/lib/cart-session-convert";
import { sendInvoiceEmail, sendOrderNotificationEmail, sendStockShortRefundAlert } from "@/lib/email";
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
  // The QR shown to the shopper is generated per order (exact amount baked in),
  // so a static QR image is optional now — only the UPI ID is required.
  if (!upiId) return null;
  const brand = await getBrandProfile();
  return { upiId, qrImageUrl, payeeName: payeeNameSetting || brand.brandName };
}

/**
 * A raw UPI transfer carries no order reference we can read back, so each
 * pending UPI order is told apart by its exact amount: the rupee total plus a
 * 1–99 paise tag no other unpaid UPI order of the same total is using. The
 * bank's credit SMS (forwarded to /api/webhooks/bank-sms) is matched on it.
 */
async function pickUniqueUpiAmountPaise(totalRupees: number): Promise<number> {
  const base = totalRupees * 100;
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await getSupabaseServerClient()
    .from("orders")
    .select("upi_amount_paise")
    .eq("payment_type", "upi_qr")
    .neq("payment_status", "paid")
    .gte("created_at", since)
    .gte("upi_amount_paise", base)
    .lt("upi_amount_paise", base + 100);
  const taken = new Set((data ?? []).map((r) => r.upi_amount_paise as number));
  const free = Array.from({ length: 99 }, (_, i) => base + i + 1).filter((p) => !taken.has(p));
  return free.length ? free[Math.floor(Math.random() * free.length)] : base + 1 + Math.floor(Math.random() * 99);
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
  // getUpiPaymentConfig, computeTrustedOrderTotal (which itself calls out to
  // Shiprocket for a live shipping quote), and getCurrentCustomer are all
  // independent reads — running them one after another was most of why the
  // QR took a visible moment to appear after tapping "Pay". In parallel
  // instead, total wait time is however long the SLOWEST of the three
  // takes, not the sum of all three.
  const [config, pricing, customer, stock] = await Promise.all([
    getUpiPaymentConfig(),
    computeTrustedOrderTotal(
      payload.items,
      payload.redeemMilesRupees,
      payload.customer.pincode,
      payload.referralCode,
      payload.customer.phone,
      payload.couponCode,
      "prepaid" // free shipping — UPI is a full-payment method, not COD
    ),
    getCurrentCustomer(),
    getInventoryMap(),
  ]);
  // Early, friendly refusal. The binding check is the atomic decrement in
  // confirmUpiOrderPayment, since stock is only taken once payment lands.
  for (const item of pricing.items) {
    if (item.slug in stock && !hasStockFor(stock[item.slug], item.quantity)) {
      throw new Error(`Sorry, only ${Math.max(0, stock[item.slug])} of ${item.name} left. Please lower the quantity.`);
    }
  }
  if (!config) throw new Error("UPI payment isn't set up yet — add UPI_ID in /admin/settings");
  // Only a Pay With A Post free-pair code can bring the total to ₹0 (see
  // computeTotalWithCoupon); that order confirms immediately below, no QR.
  if (pricing.total <= 0 && !pricing.coupon) throw new Error("Order total must be greater than zero");

  const wasGuest = !customer;
  const guestCustomer = wasGuest
    ? await findOrCreateCustomerForGuest(payload.customer.phone, payload.customer.email, payload.customer.name)
    : null;
  const effectiveCustomerId = customer?.id ?? guestCustomer?.id ?? null;

  const supabase = getSupabaseServerClient();
  const upiAmountPaise = await pickUniqueUpiAmountPaise(pricing.total);
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
      upi_amount_paise: upiAmountPaise,
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

  // None of these four depend on each other's result — only on savedOrder.id
  // already being known — so they run together instead of one after another.
  const [{ error: itemsError }] = await Promise.all([
    supabase.from("order_items").insert(orderItems),
    pricing.discountRule && pricing.discountAmount > 0
      ? supabase.from("discount_rule_redemptions").insert({
          discount_rule_id: pricing.discountRule.id,
          order_id: savedOrder.id,
          customer_phone: payload.customer.phone,
          customer_email: payload.customer.email,
          discount_amount: pricing.discountAmount,
        })
      : Promise.resolve(),
    payload.newsletterOptIn != null
      ? applyNewsletterOptIn(effectiveCustomerId, savedOrder.customer_email, payload.newsletterOptIn)
      : Promise.resolve(),
    // The order is unpaid here, so no Purchase yet (Meta or first-party):
    // confirmUpiOrderPayment fires it once the money lands.
    markCartSessionConverted(
      payload.sessionKey,
      {
        id: savedOrder.id,
        customer_email: savedOrder.customer_email,
        customer_phone: savedOrder.customer_phone,
        total: pricing.total,
      },
      { sendPurchase: false }
    ),
  ]);
  if (itemsError) throw itemsError;

  if (pricing.total <= 0) {
    await confirmUpiOrderPayment(savedOrder.id);
    return { orderId: savedOrder.id as string, total: 0, free: true as const };
  }

  const payAmount = (upiAmountPaise / 100).toFixed(2);
  const upiLink =
    `upi://pay?pa=${encodeURIComponent(config.upiId)}&pn=${encodeURIComponent(config.payeeName)}` +
    `&am=${payAmount}&cu=INR&tn=${encodeURIComponent(`Order ${savedOrder.id.slice(0, 8).toUpperCase()}`)}`;

  return {
    orderId: savedOrder.id as string,
    total: pricing.total as number,
    appliedDiscount: pricing.appliedDiscount,
    droppedDiscounts: pricing.droppedDiscounts,
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

  // Claim the confirmation first, conditionally, so the admin button and the
  // bank-SMS auto-confirm (lib/payment-auto-confirm.ts, same function) can't
  // both confirm and decrement stock twice.
  const { data: claimed } = await supabase
    .from("orders")
    .update({ payment_status: "paid", status: "confirmed" })
    .eq("id", orderId)
    .neq("payment_status", "paid")
    .select("id");
  if (!claimed?.length) return { alreadyConfirmed: true as const };

  // Stock is only taken now, atomically. If a line is short the sale is
  // refused: the order goes back to unpaid and flagged for a refund.
  try {
    await decrementStockForOrder((items ?? []).map((i) => ({ slug: i.chapter_slug, quantity: i.quantity })));
  } catch (err) {
    await supabase
      .from("orders")
      .update({ payment_status: order.payment_status, status: "stock_short" })
      .eq("id", orderId);
    // The money has landed, so the admin must refund. Best-effort: the alert
    // must never hide the original stock error.
    if (Number(order.total) > 0) {
      await sendStockShortRefundAlert(order).catch((alertErr) =>
        console.error("Stock-short refund alert failed", orderId, alertErr)
      );
    }
    throw err;
  }

  // Purchase fires only now that payment is confirmed. Meta: one event_id
  // (the order id) shared with the browser pixel. First-party log: credited
  // to the shopper's cart session so the founder console sees the channel.
  const { data: session } = await supabase
    .from("cart_sessions")
    .select("session_key")
    .eq("customer_phone", order.customer_phone)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await Promise.allSettled([
    sendPurchaseConversion({
      id: order.id,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      total: order.total,
    }),
    logTrackingEvent("Purchase", { sessionKey: session?.session_key ?? undefined, value: order.total }),
  ]);

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
    sendOrderConfirmationWhatsApp(order),
  ]);

  try {
    await shipOrder(orderId);
  } catch (err) {
    console.error("Auto-ship failed for confirmed UPI order", orderId, err);
  }

  return { alreadyConfirmed: false as const };
}
