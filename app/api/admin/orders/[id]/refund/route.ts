import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { refundRazorpayPayment } from "@/lib/razorpay";

/** Actually moves money — calls Razorpay's Refund API, not just a status label. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const requestedAmount = body?.amountRupees != null ? Number(body.amountRupees) : undefined;

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!order.razorpay_payment_id) {
      return NextResponse.json(
        { error: "This order has no Razorpay payment on record — nothing to refund via API." },
        { status: 400 }
      );
    }

    const alreadyRefunded = order.refunded_amount ?? 0;
    const maxRefundable = order.total - alreadyRefunded;
    if (maxRefundable <= 0) {
      return NextResponse.json({ error: "This order is already fully refunded." }, { status: 400 });
    }
    if (requestedAmount != null && (requestedAmount <= 0 || requestedAmount > maxRefundable)) {
      return NextResponse.json(
        { error: `Enter an amount between ₹1 and ₹${maxRefundable}.` },
        { status: 400 }
      );
    }

    const refund = await refundRazorpayPayment(order.razorpay_payment_id, requestedAmount);
    const newRefundedTotal = alreadyRefunded + refund.amountRupees;

    const { error } = await supabase
      .from("orders")
      .update({
        refunded_amount: newRefundedTotal,
        razorpay_refund_id: refund.refundId,
        refund_status: newRefundedTotal >= order.total ? "refunded" : "approved",
      })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, refundId: refund.refundId, amountRupees: refund.amountRupees });
  } catch (err) {
    console.error("Failed to refund order", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not process refund" },
      { status: 500 }
    );
  }
}
