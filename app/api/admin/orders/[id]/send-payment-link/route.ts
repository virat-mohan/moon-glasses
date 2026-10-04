import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendUnpaidOrderPaymentReminder } from "@/lib/abandoned-cart";

/**
 * Admin action: 1-click send of the direct UPI payment link to the customer via WhatsApp.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer_name, customer_phone, total, payment_status")
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Order is already paid" }, { status: 400 });
    }

    if (!order.customer_phone) {
      return NextResponse.json({ error: "Order has no customer phone number" }, { status: 400 });
    }

    const sent = await sendUnpaidOrderPaymentReminder({
      id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      total: order.total,
    });

    if (!sent) {
      return NextResponse.json(
        { error: "Could not send WhatsApp message. Check WhatsApp provider configuration or customer phone number." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send WhatsApp payment link", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send WhatsApp payment link" },
      { status: 500 }
    );
  }
}
