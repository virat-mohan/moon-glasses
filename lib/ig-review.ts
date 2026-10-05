import queueData from "@/data/ig-review/queue.json";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { estimateTimes, orderSlides } from "@/lib/ig-drip-core";
import { checkVoice, hasBlock, type VoiceFinding } from "@/lib/brand-voice";

export type IgStatus = "review" | "approved" | "held";
export type IgItem = {
  id: string; position: number; name: string; price: number; collection: string; url: string;
  caption: string; slides: string[]; story: string; story_link: string; story_sticker_label: string;
  feed_at: string; story_at: string; status: IgStatus; flags: string[];
  voice: { ok: boolean; findings: VoiceFinding[] }; edited: boolean;
  posted_at: string | null; ig_post_id: string | null; story_id: string | null; error: string | null; estimate: string | null;
};

const base = queueData.items as unknown as IgItem[];

/** Generated queue plus Virat's decisions from ig_publish_queue (if the table exists). Nothing here publishes. */
export async function loadIgQueue(): Promise<{ items: IgItem[]; slots: string; dbError: string | null; dripOn: boolean }> {
  let rows: { id: string; status: IgStatus; caption: string | null; posted_at?: string | null; ig_post_id?: string | null; story_id?: string | null; error?: string | null }[] = [];
  let dbError: string | null = null;
  try {
    const { data, error } = await getSupabaseServerClient().from("ig_publish_queue").select("id,status,caption,posted_at,ig_post_id,story_id,error");
    if (error) throw error;
    rows = (data ?? []) as typeof rows;
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Could not read decisions";
  }
  const by = new Map(rows.map((r) => [r.id, r]));
  const est = estimateTimes(rows.map((r) => ({ id: r.id, status: r.status, posted_at: r.posted_at ?? null })), base.map((b) => b.id), new Date());
  const items = base.map((b) => {
    const r = by.get(b.id);
    const caption = r?.caption ?? b.caption;
    const findings = checkVoice(caption, "social", { format: "post" });
    return { ...b, slides: orderSlides(b.slides, b.position), caption, status: (r?.status ?? "review") as IgStatus, edited: !!r?.caption, posted_at: r?.posted_at ?? null, ig_post_id: r?.ig_post_id ?? null, story_id: r?.story_id ?? null, error: r?.error ?? null, estimate: est[b.id] ?? null, voice: { ok: !hasBlock(findings), findings } };
  });
  const dripOn = (await getSetting("IG_DRIP_ENABLED")) === "true";
  return { items, slots: "first approved product goes out at once, then one every 6 hours after the previous post", dbError, dripOn };
}

export const IG_IDS = new Set(base.map((b) => b.id));
