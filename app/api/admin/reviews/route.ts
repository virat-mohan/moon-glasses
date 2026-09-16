import { NextResponse } from "next/server";
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
    const { error } = await supabase.from("reviews").update({ approved: body.approved }).eq("id", body.id);
    if (error) throw error;
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
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete review", err);
    return NextResponse.json({ error: "Could not delete review" }, { status: 500 });
  }
}
