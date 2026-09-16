import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const orderId = String(body?.orderId ?? "").trim();
  const chapterSlug = String(body?.chapterSlug ?? "").trim();
  const customerName = String(body?.customerName ?? "").trim();
  const rating = Number(body?.rating);
  const reviewText = body?.reviewText ? String(body.reviewText).trim().slice(0, 2000) : null;

  if (!orderId || !chapterSlug || !customerName || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Missing or invalid review details" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    // Confirm this chapter was actually part of this order — the review
    // page only ever offers items from the order it belongs to, but the
    // API itself shouldn't trust that without checking, since the order id
    // in the URL is a capability link anyone with it could hit directly.
    const { data: item } = await supabase
      .from("order_items")
      .select("chapter_slug")
      .eq("order_id", orderId)
      .eq("chapter_slug", chapterSlug)
      .maybeSingle();
    if (!item) {
      return NextResponse.json({ error: "That item isn't part of this order" }, { status: 400 });
    }

    const { error } = await supabase.from("reviews").upsert(
      {
        order_id: orderId,
        chapter_slug: chapterSlug,
        customer_name: customerName,
        rating,
        review_text: reviewText,
        approved: false,
      },
      { onConflict: "order_id,chapter_slug" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save review", err);
    return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
  }
}
