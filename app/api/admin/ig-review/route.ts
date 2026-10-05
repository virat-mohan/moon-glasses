import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { IG_IDS, loadIgQueue } from "@/lib/ig-review";
import { checkVoice, hasBlock } from "@/lib/brand-voice";

// Review only: this route records a decision. It never posts to Instagram.
export async function GET() {
  return NextResponse.json(await loadIgQueue());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : body?.id ? [body.id] : [];
  const status = body?.status;
  if (!ids.length || !ids.every((i) => IG_IDS.has(i))) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  if (!["review", "approved", "held"].includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });
  const caption = typeof body?.caption === "string" ? body.caption.trim() : undefined;
  if (caption !== undefined && hasBlock(checkVoice(caption, "social", { format: "post" })))
    return NextResponse.json({ error: "That caption breaks the brand book. Fix it first." }, { status: 400 });
  const now = new Date().toISOString();
  const rows = ids.map((id) => ({ id, status, ...(caption !== undefined ? { caption } : {}), decided_at: now, updated_at: now }));
  const { error } = await getSupabaseServerClient().from("ig_publish_queue").upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
