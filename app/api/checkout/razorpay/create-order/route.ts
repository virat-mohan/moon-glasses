import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { computeTrustedOrderTotal, getCodAdvanceRupees } from "@/lib/order-pricing";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.items?.length) {
    return NextResponse.json({ error: "Missing items" }, { status: 400 });
  }

  try {
    const pricing = await computeTrustedOrderTotal(
      body.items,
      body.redeemMilesRupees,
      body.pincode,
      body.referralCode,
      body.phone,
      body.couponCode,
      body.paymentType === "cod_advance" ? "cod_advance" : "prepaid"
    );
    if (pricing.total <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero" }, { status: 400 });
    }

    const isCodAdvance = body.paymentType === "cod_advance";
    const codAdvanceRupees = isCodAdvance ? await getCodAdvanceRupees() : 0;
    // COD orders only charge the small advance right now — the rest is
    // collected by the courier on delivery, never mind the full total.
    const chargeAmount = isCodAdvance ? Math.min(codAdvanceRupees, pricing.total) : pricing.total;

    const { razorpayOrderId, keyId } = await createRazorpayOrder(
      chargeAmount,
      `moonglasses_${Date.now()}`
    );

    // Snapshot the full checkout payload (customer, items, discounts) keyed
    // by the Razorpay order — the Razorpay webhook's only way to actually
    // create the order if the customer's browser never makes it back to
    // /verify (crashed tab, closed app, dropped connection right after
    // paying). Best-effort: this must never block starting the payment.
    if (body.order) {
      try {
        const supabase = getSupabaseServerClient();
        await supabase.from("pending_orders").insert({
          razorpay_order_id: razorpayOrderId,
          payload: body.order,
        });
      } catch (err) {
        console.error("Failed to snapshot pending order", err);
      }
    }

    return NextResponse.json({
      razorpayOrderId,
      keyId,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      loyaltyDiscountAmount: pricing.loyaltyDiscountAmount,
      referralDiscountAmount: pricing.referralDiscountAmount,
      couponDiscountAmount: pricing.couponDiscountAmount,
      shippingCharge: pricing.shippingCharge,
      total: pricing.total,
      chargeAmount,
      codAdvanceAmount: isCodAdvance ? chargeAmount : 0,
    });
  } catch (err) {
    console.error("Failed to create Razorpay order", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create Razorpay order" },
      { status: 500 }
    );
  }
}
