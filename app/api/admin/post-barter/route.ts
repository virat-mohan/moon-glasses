import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, barter_tier, barter_instagram_handle, barter_follower_count, barter_coupon_code, barter_required_orders, barter_post_url, barter_qualified_at, total"
      )
      .eq("is_post_barter", true)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const codes = (orders ?? []).map((o) => o.barter_coupon_code).filter(Boolean) as string[];
    let usageByCode: Record<string, number> = {};
    if (codes.length > 0) {
      const { data: coupons } = await supabase.from("coupon_codes").select("code, times_used").in("code", codes);
      usageByCode = Object.fromEntries((coupons ?? []).map((c) => [c.code, c.times_used ?? 0]));
    }

    const withProgress = (orders ?? []).map((o) => ({
      ...o,
      orders_so_far: o.barter_coupon_code ? (usageByCode[o.barter_coupon_code] ?? 0) : 0,
    }));

    return NextResponse.json({ orders: withProgress });
  } catch (err) {
    console.error("Failed to load post-barter orders", err);
    return NextResponse.json({ orders: [] }, { status: 500 });
  }
}
