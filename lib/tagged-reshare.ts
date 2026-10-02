import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting, setSetting } from "@/lib/settings";
import {
  getTaggedMedia,
  getOwnInstagramUsername,
  postImageToInstagramStory,
  postVideoToInstagramStory,
  type InstagramTaggedMedia,
} from "@/lib/instagram";
import { STORAGE_REF_PREFIX } from "@/lib/barter-post-detection";
import { checkVoice, hasBlock, describeBlocks } from "@/lib/brand-voice";
import { uploadReshareStory } from "@/lib/reshare-story-card";
import { selectReshares, RESHARE_MAX_PER_RUN } from "@/lib/tagged-reshare-select";

/** Stored in instagram_mentions.raw.auto_reshare; the admin list reads it. */
export type AutoReshareMark = { status: "reshared" | "skipped" | "failed" | "pending"; reason?: string; at: string };

export async function isAutoReshareOn(): Promise<boolean> {
  return (await getSetting("AUTO_RESHARE_TAGS")) !== "false"; // default ON when unset
}

const mark = (status: AutoReshareMark["status"], reason?: string): AutoReshareMark => ({
  status,
  ...(reason ? { reason } : {}),
  at: new Date().toISOString(),
});

function captionBlock(caption: string | null): string | null {
  if (!caption) return null;
  const findings = checkVoice(caption, "social", { format: "story" });
  return hasBlock(findings) ? `Caption fails brand voice: ${describeBlocks(findings)}` : null;
}

type Result = { id: string; source: "tag" | "story"; status: string; reason?: string };

export async function runTaggedReshare(): Promise<{ results: Result[]; notes: string[] }> {
  const supabase = getSupabaseServerClient();
  const results: Result[] = [];
  const notes: string[] = [];
  const firstRun = !(await getSetting("AUTO_RESHARE_SEEDED_AT"));
  const own = (await getOwnInstagramUsername()) ?? "moonglassesonline";
  const now = new Date();
  let budget = RESHARE_MAX_PER_RUN;
  let tagsRead = false;

  // a. Feed posts / reels that tag us.
  try {
    const tagged = await getTaggedMedia(50);
    tagsRead = true;
    const ids = tagged.map((t) => t.id);
    const { data: done } = ids.length
      ? await supabase.from("instagram_mentions").select("media_id").eq("kind", "tag").in("media_id", ids)
      : { data: [] as { media_id: string }[] };
    const sel = selectReshares({
      items: tagged,
      handledIds: new Set((done ?? []).map((d) => d.media_id)),
      ownUsername: own,
      now,
      firstRun,
      cap: budget,
    });
    for (const s of sel.skip) {
      await recordTag(s.item, mark("skipped", s.reason), null);
      results.push({ id: s.item.id, source: "tag", status: "skipped", reason: s.reason });
    }
    for (const item of sel.post) {
      try {
        const blocked = captionBlock(item.caption);
        if (blocked) {
          console.warn("tagged-reshare: skipped", item.id, blocked);
          await recordTag(item, mark("skipped", blocked), null);
          results.push({ id: item.id, source: "tag", status: "skipped", reason: blocked });
          continue;
        }
        // Claim the row first so an overlapping run can't post it again.
        const claimed = await recordTag(item, mark("pending"), null);
        if (!claimed) continue;
        budget--;
        const source = item.mediaType === "VIDEO" ? item.thumbnailUrl : (item.mediaUrl ?? item.thumbnailUrl);
        if (!source) throw new Error("Instagram gave no image for this post");
        const storyUrl = await uploadReshareStory(item.id, source, item.username);
        if (!storyUrl) throw new Error("Could not render the story image");
        await postImageToInstagramStory(storyUrl);
        await updateTag(item.id, mark("reshared"), now.toISOString());
        results.push({ id: item.id, source: "tag", status: "reshared" });
      } catch (err) {
        const reason = err instanceof Error ? err.message.slice(0, 300) : "Reshare failed";
        console.error("tagged-reshare: tag failed", item.id, reason);
        await updateTag(item.id, mark("failed", reason), null).catch(() => {});
        results.push({ id: item.id, source: "tag", status: "failed", reason });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tagged-reshare: could not read tagged posts", msg);
    notes.push(msg.slice(0, 300));
  }

  // b. Story mentions already saved by the webhook, not yet reposted.
  try {
    const { data: rows } = await supabase
      .from("instagram_mentions")
      .select("id, ig_username, media_ref, caption, raw, created_at")
      .eq("kind", "story")
      .is("reposted_at", null)
      .like("media_ref", `${STORAGE_REF_PREFIX}%`)
      .order("created_at", { ascending: false })
      .limit(50);
    const pending = (rows ?? []).filter((r) => !(r.raw as { auto_reshare?: unknown } | null)?.auto_reshare);
    const byId = new Map(pending.map((r) => [r.id as string, r]));
    const sel = selectReshares({
      items: pending.map((r) => ({ id: r.id as string, username: r.ig_username as string | null, timestamp: r.created_at as string })),
      handledIds: new Set(),
      ownUsername: own,
      now,
      firstRun,
      cap: Math.max(0, budget),
    });
    for (const s of sel.skip) {
      await markStory(byId.get(s.item.id)!, mark("skipped", s.reason));
      results.push({ id: s.item.id, source: "story", status: "skipped", reason: s.reason });
    }
    for (const it of sel.post) {
      const row = byId.get(it.id)!;
      try {
        const blocked = captionBlock(row.caption as string | null);
        if (blocked) {
          await markStory(row, mark("skipped", blocked));
          results.push({ id: it.id, source: "story", status: "skipped", reason: blocked });
          continue;
        }
        await markStory(row, mark("pending"));
        const [bucket, ...rest] = String(row.media_ref).slice(STORAGE_REF_PREFIX.length).split("/");
        const path = rest.join("/");
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (!signed?.signedUrl) throw new Error("Could not read the saved media");
        await (path.endsWith(".mp4") ? postVideoToInstagramStory(signed.signedUrl) : postImageToInstagramStory(signed.signedUrl));
        await markStory(row, mark("reshared"), new Date().toISOString());
        results.push({ id: it.id, source: "story", status: "reshared" });
      } catch (err) {
        const reason = err instanceof Error ? err.message.slice(0, 300) : "Repost failed";
        console.error("tagged-reshare: story failed", it.id, reason);
        await markStory(row, mark("failed", reason)).catch(() => {});
        results.push({ id: it.id, source: "story", status: "failed", reason });
      }
    }
  } catch (err) {
    notes.push(`Story mentions: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Seeded only once the tag backlog has actually been recorded.
  if (firstRun && tagsRead) await setSetting("AUTO_RESHARE_SEEDED_AT", now.toISOString());
  return { results, notes };

  async function recordTag(item: InstagramTaggedMedia, m: AutoReshareMark, repostedAt: string | null): Promise<boolean> {
    const { error } = await supabase.from("instagram_mentions").insert({
      kind: "tag",
      media_id: item.id,
      ig_username: item.username?.toLowerCase() ?? null,
      permalink: item.permalink,
      caption: item.caption,
      raw: { auto_reshare: m, media_type: item.mediaType, timestamp: item.timestamp },
      reposted_at: repostedAt,
    });
    if (error && error.code !== "23505") console.error("tagged-reshare: could not record", item.id, error);
    return !error;
  }

  async function updateTag(mediaId: string, m: AutoReshareMark, repostedAt: string | null) {
    const { data } = await supabase.from("instagram_mentions").select("raw").eq("kind", "tag").eq("media_id", mediaId).maybeSingle();
    await supabase
      .from("instagram_mentions")
      .update({ raw: { ...((data?.raw as object) ?? {}), auto_reshare: m }, ...(repostedAt ? { reposted_at: repostedAt } : {}) })
      .eq("kind", "tag")
      .eq("media_id", mediaId);
  }

  async function markStory(row: { id: unknown; raw: unknown }, m: AutoReshareMark, repostedAt?: string) {
    row.raw = { ...((row.raw as object) ?? {}), auto_reshare: m };
    await supabase
      .from("instagram_mentions")
      .update({ raw: row.raw, ...(repostedAt ? { reposted_at: repostedAt } : {}) })
      .eq("id", row.id as string);
  }
}
