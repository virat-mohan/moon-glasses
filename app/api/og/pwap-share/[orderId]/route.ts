import { getSupabaseServerClient } from "@/lib/supabase";
import { renderPwapShareCardPng } from "@/lib/pwap-share-card";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  let code = "YOURCODE";
  let seed = orderId;
  if (orderId !== "sample") {
    const { data: order } = await getSupabaseServerClient()
      .from("orders")
      .select("id, barter_coupon_code")
      .eq("id", orderId)
      .eq("is_post_barter", true)
      .maybeSingle();
    if (!order?.barter_coupon_code) return new Response("Not found", { status: 404 });
    code = order.barter_coupon_code;
    seed = order.id;
  }

  const png = await renderPwapShareCardPng(seed, code);
  if (!png) return new Response("No model photos available", { status: 404 });
  return new Response(png, { headers: { "Content-Type": "image/png" } });
}
