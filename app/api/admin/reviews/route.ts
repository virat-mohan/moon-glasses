import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase";
import { cleanText, MAX_REVIEW_CHARS } from "@/lib/review-core";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const [{ data, error }, { count: requests }, { count: reminders }] = await Promise.all([
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("id", { count: "exact", head: true }).not("review_requested_at", "is", null).not("is_test", "is", true),
      supabase.from("orders").select("id", { count: "exact", head: true }).not("review_reminded_at", "is", null).not("is_test", "is", true),
    ]);
    if (error) throw error;
    const orderReviews = new Set((data ?? []).filter((r) => r.order_id).map((r) => r.order_id));
    // Pair names for the list (order-linked reviews only carry a slug).
    return NextResponse.json({
      reviews: data ?? [],
      funnel: { requestsSent: requests ?? 0, remindersSent: reminders ?? 0, ordersReviewed: orderReviews.size },
    });
  } catch (err) {
    console.error("Failed to list reviews", err);
    return NextResponse.json({ reviews: [], funnel: null }, { status: 500 });
  }
}

/** PATCH { id, status?: "approved" | "hidden" | "pending", reply?: string }. Hiding keeps the row. */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const status = body?.status ?? (typeof body?.approved === "boolean" ? (body.approved ? "approved" : "hidden") : undefined);
  const hasReply = typeof body?.reply === "string";
  if (!body?.id || (!status && !hasReply) || (status && !["approved", "hidden", "pending"].includes(status))) {
    return NextResponse.json({ error: "Missing id, status or reply" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (status) {
    patch.status = status;
    patch.approved = status === "approved";
  }
  if (hasReply) {
    const reply = cleanText(body.reply, MAX_REVIEW_CHARS);
    patch.admin_reply = reply || null;
    patch.replied_at = reply ? new Date().toISOString() : null;
  }
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("reviews").update(patch).eq("id", body.id).select("chapter_slug").single();
    if (error) throw error;
    if (data?.chapter_slug) revalidatePath(`/chapter/${data.chapter_slug}`);
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update review", err);
    return NextResponse.json({ error: "Could not update review" }, { status: 500 });
  }
}

/** Deleting is only for obvious spam. Reviews of 3 stars or fewer can only be hidden, never removed. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const supabase = getSupabaseServerClient();
    const { data: row } = await supabase.from("reviews").select("rating, flagged_reason").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.rating <= 3 && !row.flagged_reason) {
      return NextResponse.json({ error: "Low ratings are hidden, never deleted" }, { status: 400 });
    }
    const { data, error } = await supabase.from("reviews").delete().eq("id", id).select("chapter_slug").single();
    if (error) throw error;
    if (data?.chapter_slug) revalidatePath(`/chapter/${data.chapter_slug}`);
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete review", err);
    return NextResponse.json({ error: "Could not delete review" }, { status: 500 });
  }
}
