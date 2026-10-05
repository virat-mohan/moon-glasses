import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { IG_IDS } from "@/lib/ig-review";

/** Clears a stored error so the queue can run again. Does not un-post: posted_at stays, so nothing double-posts. Check Instagram first. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!IG_IDS.has(body?.id)) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  const { error } = await getSupabaseServerClient().from("ig_publish_queue").update({ error: null }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
