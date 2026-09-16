import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getRazorpayPaymentStatus } from "@/lib/razorpay";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase
      .from("orders")
      .select("razorpay_payment_id")
      .eq("id", id)
      .maybeSingle();
    if (!order?.razorpay_payment_id) {
      return NextResponse.json({ error: "No Razorpay payment on this order" }, { status: 400 });
    }

    const { paymentStatus, refundedRupees, refundStatus } = await getRazorpayPaymentStatus(
      order.razorpay_payment_id
    );

    const { error } = await supabase
      .from("orders")
      .update({ refund_status: refundStatus, refunded_amount: refundedRupees })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, paymentStatus, refundedRupees, refundStatus });
  } catch (err) {
    console.error("Failed to sync payment from Razorpay", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not sync from Razorpay" },
      { status: 500 }
    );
  }
}
