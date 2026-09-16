import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Validates a coupon code server-side and computes its discount against the
 * trusted subtotal — never trusts a client-supplied discount amount. Returns
 * null (no discount, no error surfaced) for any invalid/expired/exhausted
 * code, same "silently doesn't apply" behavior as resolveReferralDiscount —
 * a bad code shouldn't block checkout.
 */
export async function resolveCouponDiscount(code: string | null | undefined, subtotal: number) {
  if (!code) return null;
  const supabase = getSupabaseServerClient();
  const { data: coupon } = await supabase
    .from("coupon_codes")
    .select("id, code, discount_type, discount_value, expires_at, usage_limit, times_used, active")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!coupon || !coupon.active) return null;
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return null;
  if (coupon.usage_limit != null && coupon.times_used >= coupon.usage_limit) return null;

  const rawDiscount =
    coupon.discount_type === "percent"
      ? (subtotal * coupon.discount_value) / 100
      : coupon.discount_value;

  return {
    couponId: coupon.id as string,
    code: coupon.code as string,
    discountRupees: Math.min(Math.round(rawDiscount), subtotal),
  };
}

/** Logs a redemption and increments the usage counter — called once the order actually saves, never at preview time. */
export async function redeemCoupon(
  couponId: string,
  orderId: string,
  discountAmount: number,
  customerPhone: string,
  customerEmail: string
) {
  const supabase = getSupabaseServerClient();
  await supabase.from("coupon_redemptions").insert({
    coupon_id: couponId,
    order_id: orderId,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    discount_amount: discountAmount,
  });
  const { data: coupon } = await supabase
    .from("coupon_codes")
    .select("times_used")
    .eq("id", couponId)
    .maybeSingle();
  if (coupon) {
    await supabase
      .from("coupon_codes")
      .update({ times_used: coupon.times_used + 1 })
      .eq("id", couponId);
  }
}
