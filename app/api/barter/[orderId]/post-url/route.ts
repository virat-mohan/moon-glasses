import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Lets the customer register their post link on their own barter order page — the same unguessable-UUID-as-capability-link pattern /return/[orderId] and /review/[orderId] already use, no login needed. */
export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const body = await request.json().catch(() => null);
  const postUrl = String(body?.postUrl ?? "").trim();
  if (!/^https?:\/\/(www\.)?instagram\.com\//i.test(postUrl)) {
    return NextResponse.json({ error: "Enter a valid Instagram post link" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase.from("orders").select("id, is_post_barter").eq("id", orderId).maybeSingle();
    if (!order || !order.is_post_barter) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const { error } = await supabase.from("orders").update({ barter_post_url: postUrl }).eq("id", orderId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save barter post url", orderId, err);
    return NextResponse.json({ error: "Could not save your post link" }, { status: 500 });
  }
}
