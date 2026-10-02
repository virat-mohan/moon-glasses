import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseServerClient()
    .from("instagram_mentions")
    .select("id, ig_username, permalink, caption, raw, created_at")
    .eq("kind", "tag")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = (data ?? []).map((r) => {
    const raw = (r.raw ?? {}) as Record<string, unknown>;
    const mediaType = String(raw.media_type ?? "");
    return {
      id: r.id as string,
      username: r.ig_username as string | null,
      permalink: r.permalink as string | null,
      caption: r.caption as string | null,
      imageUrl: ((mediaType === "VIDEO" ? raw.thumbnail_url : raw.media_url) ?? raw.thumbnail_url ?? null) as string | null,
      mediaType,
      storyStatus: (raw.auto_reshare as { status?: string; reason?: string } | undefined) ?? null,
      grid: (raw.grid_post as { status: string; postId?: string; at: string; reason?: string } | undefined) ?? null,
      canPost: mediaType !== "VIDEO" && !!(raw.media_url || raw.thumbnail_url),
      createdAt: r.created_at as string,
    };
  });
  const readError = (await getSetting("TAGGED_READ_ERROR")) || null;
  return NextResponse.json({ items, readError });
}
