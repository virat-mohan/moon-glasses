import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { postImageToInstagramStory, postVideoToInstagramStory } from "@/lib/instagram";
import { STORAGE_REF_PREFIX } from "@/lib/barter-post-detection";

/** Reposts a saved customer story mention as our own Story. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const supabase = getSupabaseServerClient();
  const { data: mention } = await supabase
    .from("instagram_mentions")
    .select("id, kind, media_ref, reposted_at")
    .eq("id", String(body?.mentionId ?? ""))
    .maybeSingle();
  if (!mention) return NextResponse.json({ error: "Mention not found" }, { status: 404 });
  if (mention.reposted_at) return NextResponse.json({ error: "Already reposted" }, { status: 400 });
  if (!mention.media_ref?.startsWith(STORAGE_REF_PREFIX)) {
    return NextResponse.json({ error: "No saved media to repost" }, { status: 400 });
  }

  const [bucket, ...rest] = mention.media_ref.slice(STORAGE_REF_PREFIX.length).split("/");
  const path = rest.join("/");
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Could not read the saved media" }, { status: 500 });

  try {
    const isVideo = path.endsWith(".mp4");
    await (isVideo ? postVideoToInstagramStory(signed.signedUrl) : postImageToInstagramStory(signed.signedUrl));
    await supabase.from("instagram_mentions").update({ reposted_at: new Date().toISOString() }).eq("id", mention.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Repost failed" }, { status: 400 });
  }
}
