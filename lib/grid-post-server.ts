import { getSupabaseServerClient } from "@/lib/supabase";
import { postToInstagramFeed } from "@/lib/instagram";
import { checkVoice, hasBlock, describeBlocks } from "@/lib/brand-voice";
import { decideFit, buildGridCaption, gridClaimAllowed, gridMark, type GridMark } from "@/lib/grid-post";

type Row = { id: string; media_id: string; ig_username: string | null; raw: Record<string, unknown> | null };

const gridOf = (raw: Record<string, unknown> | null) => (raw?.grid_post as GridMark | undefined) ?? null;

/**
 * Atomic claim: the update only matches while grid_post.status is still what we read,
 * so two clicks/requests can never both publish.
 */
async function claim(row: Row, to: GridMark): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const current = gridOf(row.raw);
  let q = supabase
    .from("instagram_mentions")
    .update({ raw: { ...(row.raw ?? {}), grid_post: to } })
    .eq("id", row.id)
    .select("id");
  q = current ? q.eq("raw->grid_post->>status", current.status) : q.is("raw->grid_post", null);
  const { data, error } = await q;
  return !error && (data?.length ?? 0) === 1;
}

async function save(row: Row, mark: GridMark) {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("instagram_mentions").select("raw").eq("id", row.id).maybeSingle();
  await supabase
    .from("instagram_mentions")
    .update({ raw: { ...((data?.raw as object) ?? {}), grid_post: mark } })
    .eq("id", row.id);
}

async function load(id: string): Promise<Row | null> {
  const { data } = await getSupabaseServerClient()
    .from("instagram_mentions")
    .select("id, media_id, ig_username, raw")
    .eq("id", id)
    .eq("kind", "tag")
    .maybeSingle();
  return (data as Row | null) ?? null;
}

export async function skipTag(id: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const row = await load(id);
  if (!row) return { ok: false, error: "Not found", status: 404 };
  if (!gridClaimAllowed(gridOf(row.raw), "skip")) return { ok: false, error: "Already posted or posting", status: 409 };
  if (!(await claim(row, gridMark("skipped")))) return { ok: false, error: "Changed by someone else, refresh", status: 409 };
  return { ok: true };
}

async function toFeedJpeg(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the photo (${res.status}). Instagram links expire; open it on Instagram instead.`);
  const input = Buffer.from(await res.arrayBuffer());
  const sharp = (await import("sharp")).default;
  const meta = await sharp(input).rotate().metadata();
  const w = meta.autoOrient?.width ?? meta.width ?? 0;
  const h = meta.autoOrient?.height ?? meta.height ?? 0;
  let img = sharp(input).rotate();
  const fit = decideFit(w, h);
  if (fit.action === "crop") img = img.resize(fit.width, fit.height, { fit: "cover", position: sharp.strategy.attention });
  return img.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export async function approveTag(id: string): Promise<{ ok: boolean; error?: string; status?: number; postId?: string }> {
  const row = await load(id);
  if (!row) return { ok: false, error: "Not found", status: 404 };
  const raw = row.raw ?? {};
  const type = String(raw.media_type ?? "");
  if (type === "VIDEO") return { ok: false, error: "Videos and reels can't go on the grid. Open it on Instagram.", status: 400 };
  const source = (raw.media_url as string | null) || (type === "CAROUSEL_ALBUM" ? (raw.thumbnail_url as string | null) : null);
  if (!source) return { ok: false, error: "No image saved for this post. Open it on Instagram.", status: 400 };
  if (!row.ig_username) return { ok: false, error: "No username to credit", status: 400 };

  let caption: string;
  try {
    caption = buildGridCaption(row.ig_username, (c) => {
      const f = checkVoice(c, "social");
      return hasBlock(f) ? describeBlocks(f) : null;
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Caption blocked", status: 400 };
  }
  if (!gridClaimAllowed(gridOf(row.raw), "post")) return { ok: false, error: "Already posted or posting", status: 409 };
  if (!(await claim(row, gridMark("posting")))) return { ok: false, error: "Already posting, refresh", status: 409 };

  try {
    const jpeg = await toFeedJpeg(source);
    const supabase = getSupabaseServerClient();
    const path = `grid/${row.media_id}.jpg`;
    const { error: upErr } = await supabase.storage.from("ad-creatives").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("ad-creatives").getPublicUrl(path);
    const { postId } = await postToInstagramFeed(pub.publicUrl, caption, [row.ig_username]);
    await save(row, gridMark("posted", { postId }));
    return { ok: true, postId };
  } catch (e) {
    const reason = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    await save(row, gridMark("failed", { reason })).catch(() => {});
    return { ok: false, error: reason, status: 502 };
  }
}
