import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Updates any subset of a coupon's fields — code, discount type/value, expiry, usage limit, active. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  const patch: Record<string, string | number | boolean | null> = {};
  if (typeof body.code === "string") patch.code = body.code.trim().toUpperCase();
  if (body.discountType === "flat" || body.discountType === "percent") patch.discount_type = body.discountType;
  if (body.discountValue != null) patch.discount_value = Number(body.discountValue);
  if ("expiresAt" in body) patch.expires_at = body.expiresAt || null;
  if ("usageLimit" in body) patch.usage_limit = body.usageLimit ? Number(body.usageLimit) : null;
  if (typeof body.active === "boolean") patch.active = body.active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("coupon_codes").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, coupon: data });
  } catch (err) {
    console.error("Failed to update coupon", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update coupon" },
      { status: 500 }
    );
  }
}

/** Deletes a coupon outright — its redemption history stays (coupon_redemptions isn't cascaded), so past order records are unaffected. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("coupon_codes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete coupon", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete coupon" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("coupon_redemptions")
      .select("id, order_id, customer_phone, customer_email, discount_amount, redeemed_at")
      .eq("coupon_id", id)
      .order("redeemed_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ redemptions: data ?? [] });
  } catch (err) {
    console.error("Failed to load redemptions", err);
    return NextResponse.json({ error: "Could not load redemptions" }, { status: 500 });
  }
}
