import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Manual confirmation, same pattern as MarkUpiPaidButton/confirmUpiOrderPayment — no gateway webhook exists for this payment link either (see app/barter/[orderId]/pay), so an admin checks their UPI app and clicks this. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("orders")
      .update({ barter_charged_at: new Date().toISOString(), payment_status: "paid" })
      .eq("id", id)
      .eq("is_post_barter", true);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to mark barter order charged", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not mark charged" },
      { status: 400 }
    );
  }
}
