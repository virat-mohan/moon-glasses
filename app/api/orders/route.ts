import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { markCartSessionConverted } from "@/lib/cart-session-convert";
import { getCurrentCustomer, findOrCreateCustomerForGuest } from "@/lib/auth";
import { getRedeemableAmount, earnMilesForOrder, redeemMilesForOrder } from "@/lib/loyalty";
import { sendInvoiceEmail, sendOrderNotificationEmail } from "@/lib/email";
import { applyNewsletterOptIn } from "@/lib/newsletter";
import { recordGuestCheckoutLead } from "@/lib/leads";
import { getShippingRate } from "@/lib/shiprocket";
import { resolveReferralDiscount, rewardReferrer } from "@/lib/referrals";
import { resolveCouponDiscount, redeemCoupon } from "@/lib/coupons";
import { checkAndAlertLowStock } from "@/lib/inventory";

type OrderPayload = {
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: { slug: string; name: string; price: number; quantity: number }[];
  subtotal: number;
  discountAmount?: number;
  isGift?: boolean;
  giftNote?: string | null;
  sessionKey?: string;
  redeemMilesRupees?: number;
  newsletterOptIn?: boolean;
  attributedAdBriefId?: string | null;
  couponCode?: string | null;
  referralCode?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: OrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.customer || !body.items?.length) {
    return NextResponse.json({ error: "Missing customer or items" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const discountAmount = body.discountAmount ?? 0;

    // Loyalty customer_id and redemption amount are resolved server-side
    // from the session cookie and the ledger — never from client input, so
    // a tampered request can't claim someone else's Miles or redeem more
    // than they actually have.
    const customer = await getCurrentCustomer();
    let loyaltyDiscountAmount = 0;
    if (customer && body.redeemMilesRupees) {
      const { maxRedeemableRupees } = await getRedeemableAmount(customer.id);
      loyaltyDiscountAmount = Math.min(body.redeemMilesRupees, maxRedeemableRupees);
    }

    // Looked up fresh from Shiprocket by pincode, same as the Razorpay flow
    // — never a client-supplied amount, so it stays a genuine pass-through.
    const unitCount = body.items.reduce((sum, item) => sum + item.quantity, 0);
    let shippingCharge = 0;
    if (body.customer.pincode) {
      const shippingResult = await getShippingRate(body.customer.pincode, unitCount);
      if (shippingResult.status === "checked_unavailable") {
        return NextResponse.json(
          {
            error: `We can't currently deliver to pincode ${body.customer.pincode} — please double-check it or use a different address.`,
          },
          { status: 400 }
        );
      }
      shippingCharge = shippingResult.status === "available" ? shippingResult.rate : 0;
    }

    const referral = await resolveReferralDiscount(body.referralCode, customer?.id ?? null, body.customer.phone);
    const referralDiscountAmount = referral ? Math.min(referral.discountRupees, body.subtotal) : 0;

    const coupon = await resolveCouponDiscount(body.couponCode, body.subtotal);
    const couponDiscountAmount = coupon ? coupon.discountRupees : 0;

    // Guest checkout (no OTP session) still gets a real customer record —
    // matched/deduped by phone/email, never a logged-in session — so Miles
    // and a referral code work for them too, not just people who verified.
    const wasGuest = !customer;
    const guestCustomer = wasGuest
      ? await findOrCreateCustomerForGuest(body.customer.phone, body.customer.email, body.customer.name)
      : null;
    const effectiveCustomerId = customer?.id ?? guestCustomer?.id ?? null;

    const total =
      body.subtotal -
      discountAmount -
      loyaltyDiscountAmount -
      referralDiscountAmount -
      couponDiscountAmount +
      shippingCharge;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email,
        delivery_address: body.customer.address,
        delivery_city: body.customer.city ?? null,
        delivery_state: body.customer.state ?? null,
        delivery_pincode: body.customer.pincode ?? null,
        subtotal: body.subtotal,
        discount_amount: discountAmount,
        loyalty_discount_amount: loyaltyDiscountAmount,
        shipping_charge: shippingCharge,
        total,
        is_gift: body.isGift ?? false,
        gift_note: body.giftNote ?? null,
        customer_id: effectiveCustomerId,
        attributed_ad_brief_id:
          body.attributedAdBriefId && UUID_RE.test(body.attributedAdBriefId)
            ? body.attributedAdBriefId
            : null,
        referral_code_used: referral ? body.referralCode?.toUpperCase() : null,
        referral_discount_amount: referralDiscountAmount,
        coupon_code_used: coupon ? coupon.code : null,
        coupon_discount_amount: couponDiscountAmount,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      body.items.map((item) => ({
        order_id: order.id,
        chapter_slug: item.slug,
        chapter_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
      }))
    );

    if (itemsError) throw itemsError;

    if (discountAmount > 0) {
      const { data: activeRule } = await supabase
        .from("discount_rules")
        .select("id")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (activeRule) {
        await supabase.from("discount_rule_redemptions").insert({
          discount_rule_id: activeRule.id,
          order_id: order.id,
          customer_phone: body.customer.phone,
          customer_email: body.customer.email,
          discount_amount: discountAmount,
        });
      }
    }

    if (effectiveCustomerId) {
      const capsBought = body.items.reduce((sum, item) => sum + item.quantity, 0);
      if (customer && loyaltyDiscountAmount > 0) {
        await redeemMilesForOrder(effectiveCustomerId, order.id, loyaltyDiscountAmount);
      }
      await earnMilesForOrder(effectiveCustomerId, order.id, capsBought);
    }

    // Decrement inventory. Best-effort — a failed decrement shouldn't fail the order.
    for (const item of body.items) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("stock_on_hand")
        .eq("chapter_slug", item.slug)
        .maybeSingle();
      if (inv) {
        const newStock = Math.max(0, inv.stock_on_hand - item.quantity);
        await supabase.from("inventory").update({ stock_on_hand: newStock }).eq("chapter_slug", item.slug);
        await checkAndAlertLowStock(item.slug, newStock);
      }
    }

    await markCartSessionConverted(body.sessionKey, {
      id: order.id,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      total,
    });

    if (body.newsletterOptIn != null) {
      await applyNewsletterOptIn(effectiveCustomerId, order.customer_email, body.newsletterOptIn);
    }

    if (referral) {
      await rewardReferrer(
        referral.referrerCustomerId,
        order.id,
        effectiveCustomerId,
        body.customer.phone,
        referral.rewardMiles
      );
    }

    if (wasGuest) {
      await recordGuestCheckoutLead({
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email,
        chapterName: body.items[0]?.name,
      });
    }

    if (coupon) {
      await redeemCoupon(coupon.couponId, order.id, couponDiscountAmount, body.customer.phone, body.customer.email);
    }

    // Best-effort — a failed email must never fail the order itself.
    const emailItems = body.items.map((item) => ({
      chapter_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
    }));
    await Promise.allSettled([
      sendInvoiceEmail(order, emailItems),
      sendOrderNotificationEmail(order, emailItems),
    ]);

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("Failed to save order", err);
    return NextResponse.json({ error: "Could not save order" }, { status: 500 });
  }
}
