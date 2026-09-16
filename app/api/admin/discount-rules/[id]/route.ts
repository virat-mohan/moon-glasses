import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Usage log for one discount rule — mirrors /api/admin/coupons/[id] for coupon codes. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("discount_rule_redemptions")
      .select("id, order_id, customer_phone, customer_email, discount_amount, redeemed_at")
      .eq("discount_rule_id", id)
      .order("redeemed_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ redemptions: data ?? [] });
  } catch (err) {
    console.error("Failed to load discount rule redemptions", err);
    return NextResponse.json({ error: "Could not load redemptions" }, { status: 500 });
  }
}
