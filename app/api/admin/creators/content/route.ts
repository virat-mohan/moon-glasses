import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getTaggedMedia } from "@/lib/instagram";

/**
 * With ?creatorId=... returns that creator's already-linked content rows.
 * Without it, returns recent media where the brand's own connected
 * Instagram account is tagged/collaborator-added — for an admin to eyeball
 * and link to the right creator. Never touches a creator's own account.
 */
export async function GET(request: Request) {
  const creatorId = new URL(request.url).searchParams.get("creatorId");
  if (creatorId) {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("creator_content")
        .select("*")
        .eq("creator_id", creatorId)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ content: data ?? [] });
    } catch (err) {
      console.error("Failed to load creator content", err);
      return NextResponse.json({ content: [] }, { status: 500 });
    }
  }

  try {
    const tagged = await getTaggedMedia(25);
    return NextResponse.json({ tagged });
  } catch (err) {
    console.error("Failed to load tagged Instagram media", err);
    return NextResponse.json(
      { tagged: [], error: err instanceof Error ? err.message : "Could not load tagged media" },
      { status: 200 }
    );
  }
}

/** Links a piece of content (from the tagged-media list, or typed in manually) to a creator. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const creatorId = body?.creatorId as string | undefined;
  if (!creatorId) return NextResponse.json({ error: "Missing creatorId" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("creator_content")
      .insert({
        creator_id: creatorId,
        platform: "instagram",
        post_url: body.postUrl || null,
        media_type: body.mediaType || null,
        caption: body.caption || null,
        likes: body.likes != null ? Number(body.likes) : null,
        comments: body.comments != null ? Number(body.comments) : null,
        reach: body.reach != null ? Number(body.reach) : null,
        posted_at: body.postedAt || null,
        source: body.source === "instagram_tags" ? "instagram_tags" : "manual",
        notes: body.notes || null,
      })
      .select()
      .single();
    if (error) throw error;

    const { data: creator } = await supabase.from("creators").select("status").eq("id", creatorId).maybeSingle();
    if (creator && creator.status === "product_shipped") {
      await supabase
        .from("creators")
        .update({ status: "content_received", updated_at: new Date().toISOString() })
        .eq("id", creatorId);
    }

    return NextResponse.json({ content: data });
  } catch (err) {
    console.error("Failed to link creator content", err);
    return NextResponse.json({ error: "Could not save content" }, { status: 500 });
  }
}
