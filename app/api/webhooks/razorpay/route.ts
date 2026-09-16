import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { verifyRazorpayWebhookSignature, getRazorpayPaymentStatus } from "@/lib/razorpay";
import { finalizeOrder, type OrderPayload } from "@/lib/order-fulfillment";

/**
 * Razorpay's server-to-server safety net, independent of the customer's
 * browser. Two jobs:
 *  1. payment.captured — if /verify never ran (crashed tab, closed app
 *     right after paying), recover the checkout payload from
 *     pending_orders and create the order here instead of silently taking
 *     the customer's money with nothing to show for it.
 *  2. refund.processed / refund.failed — keeps refund_status in sync with
 *     what Razorpay actually did, independent of the admin dashboard's
 *     "Sync from Razorpay" button.
 * Always returns 200 quickly so Razorpay doesn't retry-storm on a
 * downstream hiccup — errors are logged, not surfaced as a failing status.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const webhookSecret = await getSetting("RAZORPAY_WEBHOOK_SECRET");

  if (!webhookSecret) {
    console.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET isn't set — ignoring");
    return NextResponse.json({ ok: true });
  }
  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const event = body?.event as string | undefined;

  try {
    if (event === "payment.captured") {
      const payment = body.payload?.payment?.entity;
      const razorpayOrderId = payment?.order_id as string | undefined;
      const razorpayPaymentId = payment?.id as string | undefined;
      if (!razorpayOrderId || !razorpayPaymentId) {
        return NextResponse.json({ ok: true });
      }

      const supabase = getSupabaseServerClient();
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("razorpay_payment_id", razorpayPaymentId)
        .maybeSingle();
      if (existing) {
        // /verify already handled this one — nothing to recover.
        return NextResponse.json({ ok: true });
      }

      const { data: pending } = await supabase
        .from("pending_orders")
        .select("payload")
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();
      if (!pending) {
        console.error(
          "Razorpay webhook: payment captured but no pending_orders snapshot found",
          razorpayOrderId
        );
        return NextResponse.json({ ok: true });
      }

      await finalizeOrder(pending.payload as OrderPayload, razorpayOrderId, razorpayPaymentId);
    } else if (event === "refund.processed" || event === "refund.failed") {
      const refund = body.payload?.refund?.entity;
      const razorpayPaymentId = refund?.payment_id as string | undefined;
      if (!razorpayPaymentId) return NextResponse.json({ ok: true });

      const supabase = getSupabaseServerClient();
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("razorpay_payment_id", razorpayPaymentId)
        .maybeSingle();
      if (!order) return NextResponse.json({ ok: true });

      const { refundedRupees, refundStatus } = await getRazorpayPaymentStatus(razorpayPaymentId);
      await supabase
        .from("orders")
        .update({ refund_status: refundStatus, refunded_amount: refundedRupees })
        .eq("id", order.id);
    }
  } catch (err) {
    console.error("Razorpay webhook handling failed", err);
  }

  return NextResponse.json({ ok: true });
}
