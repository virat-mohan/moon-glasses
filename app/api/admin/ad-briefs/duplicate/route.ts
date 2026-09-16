import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Clones an existing brief's copy + creative as a brand-new draft — for
 * reusing the same content as a separate post (e.g. re-running a Story that
 * already worked, or turning a posted brief into a fresh one to post again
 * without waiting/editing). A straight DB copy, not a re-generation — the
 * duplicate starts with the exact same headline/copy/images the original
 * has right now, just reset to an unposted, unlaunched draft.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data: original } = await supabase.from("ad_briefs").select("*").eq("id", body.id).maybeSingle();
    if (!original) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

    const clone = { ...original };
    delete clone.id;
    delete clone.created_at;

    const { data: inserted, error } = await supabase
      .from("ad_briefs")
      .insert({
        ...clone,
        status: "draft",
        posted_at: null,
        instagram_post_id: null,
        meta_campaign_id: null,
        meta_adset_id: null,
        meta_ad_id: null,
        launched_at: null,
        scheduled_for: null,
        scheduled_action: null,
        queue_status: "none",
        queue_error: null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ brief: inserted });
  } catch (err) {
    console.error("Failed to duplicate ad brief", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not duplicate brief" },
      { status: 500 }
    );
  }
}
