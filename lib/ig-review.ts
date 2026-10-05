import queueData from "@/data/ig-review/queue.json";
import { getSupabaseServerClient } from "@/lib/supabase";
import { checkVoice, hasBlock, type VoiceFinding } from "@/lib/brand-voice";

export type IgStatus = "review" | "approved" | "held";
export type IgItem = {
  id: string; position: number; name: string; price: number; collection: string; url: string;
  caption: string; slides: string[]; story: string; story_link: string; story_sticker_label: string;
  feed_at: string; story_at: string; status: IgStatus; flags: string[];
  voice: { ok: boolean; findings: VoiceFinding[] }; edited: boolean;
};

const base = queueData.items as unknown as IgItem[];

/** Generated queue plus Virat's decisions from ig_publish_queue (if the table exists). Nothing here publishes. */
export async function loadIgQueue(): Promise<{ items: IgItem[]; slots: string; dbError: string | null }> {
  let rows: { id: string; status: IgStatus; caption: string | null }[] = [];
  let dbError: string | null = null;
  try {
    const { data, error } = await getSupabaseServerClient().from("ig_publish_queue").select("id,status,caption");
    if (error) throw error;
    rows = (data ?? []) as typeof rows;
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Could not read decisions";
  }
  const by = new Map(rows.map((r) => [r.id, r]));
  const items = base.map((b) => {
    const r = by.get(b.id);
    const caption = r?.caption ?? b.caption;
    const findings = checkVoice(caption, "social", { format: "post" });
    return { ...b, caption, status: (r?.status ?? "review") as IgStatus, edited: !!r?.caption, voice: { ok: !hasBlock(findings), findings } };
  });
  return { items, slots: queueData.slots_ist, dbError };
}

export const IG_IDS = new Set(base.map((b) => b.id));
