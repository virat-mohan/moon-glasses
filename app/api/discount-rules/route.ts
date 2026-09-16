import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("discount_rules")
      .select("id, name, buy_quantity, discount_percent")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ rule: null });

    return NextResponse.json({
      rule: {
        id: data.id,
        name: data.name,
        buyQuantity: data.buy_quantity,
        discountPercent: data.discount_percent,
      },
    });
  } catch {
    return NextResponse.json({ rule: null });
  }
}
