import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAndUploadPwapShareCard } from "@/lib/pwap-share-card";

/**
 * The next look for a Pay With A Post share: variant n of the order's card
 * (variant 0 is made when the order is placed). Each "Share again" asks for
 * the next variant, so the same customer never posts the same photo twice.
 * Cached in storage, so a variant is only rendered once.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const variant = Math.max(0, Math.min(50, Number(req.nextUrl.searchParams.get("n")) || 0));
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, is_post_barter, barter_coupon_code")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.is_post_barter || !order.barter_coupon_code) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const path = variant ? `pwap-share/${orderId}-${variant}.png` : `pwap-share/${orderId}.png`;
  const existing = supabase.storage.from("ad-creatives").getPublicUrl(path).data.publicUrl;
  const head = await fetch(existing, { method: "HEAD" }).catch(() => null);
  const url = head?.ok ? existing : await generateAndUploadPwapShareCard(orderId, order.barter_coupon_code, variant);
  if (!url) return NextResponse.json({ error: "Could not make the post" }, { status: 500 });
  return NextResponse.json({ url });
}
