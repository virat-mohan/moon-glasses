import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("coupon_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ coupons: data ?? [] });
  } catch (err) {
    console.error("Failed to load coupons", err);
    return NextResponse.json({ error: "Could not load coupons" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const discountType = body?.discountType === "percent" ? "percent" : "flat";
  const discountValue = Number(body?.discountValue);
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  const usageLimit = body?.usageLimit ? Number(body.usageLimit) : null;

  if (!code || !discountValue || discountValue <= 0) {
    return NextResponse.json({ error: "Code and a positive discount value are required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("coupon_codes")
      .insert({
        code,
        discount_type: discountType,
        discount_value: discountValue,
        expires_at: expiresAt,
        usage_limit: usageLimit,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ coupon: data });
  } catch (err) {
    console.error("Failed to create coupon", err);
    const message = err instanceof Error && err.message.includes("duplicate") ? "That code already exists" : "Could not create coupon";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
