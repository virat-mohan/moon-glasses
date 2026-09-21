import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ reviews: data ?? [] });
  } catch (err) {
    console.error("Failed to list reviews", err);
    return NextResponse.json({ reviews: [] }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || typeof body?.approved !== "boolean") {
    return NextResponse.json({ error: "Missing id or approved" }, { status: 400 });
  }
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({ approved: body.approved })
      .eq("id", body.id)
      .select("chapter_slug")
      .single();
    if (error) throw error;

    // The chapter page is statically generated with no revalidate window of
    // its own — without this, an approved review would never appear on the
    // live site short of a full redeploy.
    if (data?.chapter_slug) revalidatePath(`/chapter/${data.chapter_slug}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update review", err);
    return NextResponse.json({ error: "Could not update review" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", id)
      .select("chapter_slug")
      .single();
    if (error) throw error;

    if (data?.chapter_slug) revalidatePath(`/chapter/${data.chapter_slug}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete review", err);
    return NextResponse.json({ error: "Could not delete review" }, { status: 500 });
  }
}
