import queueData from "@/data/ig-review/queue.json";
import { getSupabaseServerClient } from "@/lib/supabase";
import { checkVoice, hasBlock } from "@/lib/brand-voice";
import { getSetting } from "@/lib/settings";
import { postToInstagramCarouselFeed, postImageToInstagramStory } from "@/lib/instagram";
import { runDrip, type DripDeps, type DripItem, type DripResult, type DripRow } from "@/lib/ig-drip-core";

type Q = { id: string; caption: string; slides: string[]; story: string; story_link: string };
const queue = queueData.items as unknown as Q[];

export const dripItems: DripItem[] = queue.map((q) => ({ id: q.id, caption: q.caption, slides: q.slides, story: q.story, story_link: q.story_link }));

export async function isDripEnabled() {
  return (await getSetting("IG_DRIP_ENABLED")) === "true";
}

const COLS = "id,status,caption,posted_at,ig_post_id,story_started_at,story_id,error";

function realDeps(): DripDeps {
  const db = () => getSupabaseServerClient();
  return {
    rows: async () => {
      const { data, error } = await db().from("ig_publish_queue").select(COLS);
      if (error) throw new Error(error.message);
      return (data ?? []) as DripRow[];
    },
    // Marking posted_at first, conditionally, means a retry or a second run can never post the same product twice.
    claimFeed: async (id, at) => {
      const { data, error } = await db().from("ig_publish_queue")
        .update({ posted_at: at.toISOString(), scheduled_for: at.toISOString(), updated_at: at.toISOString() })
        .eq("id", id).eq("status", "approved").is("posted_at", null).select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length === 1;
    },
    saveFeed: async (id, postId) => { await db().from("ig_publish_queue").update({ ig_post_id: postId, updated_at: new Date().toISOString() }).eq("id", id); },
    claimStory: async (id, at) => {
      const { data, error } = await db().from("ig_publish_queue")
        .update({ story_started_at: at.toISOString() }).eq("id", id).is("story_started_at", null).select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length === 1;
    },
    saveStory: async (id, storyId) => { await db().from("ig_publish_queue").update({ story_id: storyId, updated_at: new Date().toISOString() }).eq("id", id); },
    saveError: async (id, message) => { await db().from("ig_publish_queue").update({ error: message.slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", id); },
    captionBlocked: (c) => hasBlock(checkVoice(c, "social", { format: "post" })),
    postCarousel: (urls, caption) => postToInstagramCarouselFeed(urls, caption),
    postStory: (url, link) => postImageToInstagramStory(url, link),
  };
}

export async function runIgDrip(opts: { force?: boolean } = {}): Promise<DripResult> {
  return runDrip(dripItems, realDeps(), { now: new Date(), enabled: await isDripEnabled(), force: opts.force });
}
