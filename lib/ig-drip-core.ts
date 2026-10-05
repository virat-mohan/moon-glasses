// Instagram catalogue drip: pure scheduling and run logic. No I/O here, so it is unit-testable.
// Everything that touches Instagram or the database is injected (see lib/ig-drip.ts).

export const SITE = "https://www.moon-glasses.store";
export const STORY_DELAY_MIN = 15;
export const INTERVAL_HOURS = 6;
const HOUR = 3600_000;

/** When the next product is due: the first goes straight away; each later one 6 hours after the previous ACTUAL post. */
export function dueAt(lastPostedAt: string | null): Date | null {
  return lastPostedAt ? new Date(new Date(lastPostedAt).getTime() + INTERVAL_HOURS * HOUR) : null;
}

/** Estimates for display: the unposted approved items in queue order, each 6h after the one before. Null = "as soon as it is switched on". */
export function estimateTimes(rows: { id: string; status: string; posted_at: string | null }[], order: string[], now: Date): Record<string, string | null> {
  const by = new Map(rows.map((r) => [r.id, r]));
  let last = rows.map((r) => r.posted_at).filter(Boolean).sort().pop() ?? null;
  let t: number | null = last ? new Date(last).getTime() + INTERVAL_HOURS * HOUR : null;
  const out: Record<string, string | null> = {};
  for (const id of order) {
    const r = by.get(id);
    if (!r || r.status !== "approved" || r.posted_at) continue;
    if (t !== null && t < now.getTime()) t = now.getTime();
    out[id] = t === null ? null : new Date(t).toISOString();
    t = (t ?? now.getTime()) + INTERVAL_HOURS * HOUR;
  }
  return out;
}

export type DripItem = { id: string; caption: string; slides: string[]; story: string; story_link: string };
export type DripRow = {
  id: string; status: "review" | "approved" | "held"; caption: string | null;
  posted_at: string | null; ig_post_id: string | null; story_started_at: string | null; story_id: string | null; error: string | null;
};
export type DripDeps = {
  rows: () => Promise<DripRow[]>;
  claimFeed: (id: string, at: Date) => Promise<boolean>;   // atomic: only succeeds if still approved and unposted
  saveFeed: (id: string, postId: string) => Promise<void>;
  claimStory: (id: string, at: Date) => Promise<boolean>;                         // atomic: only succeeds if story not started
  saveStory: (id: string, storyId: string) => Promise<void>;
  saveError: (id: string, message: string) => Promise<void>;
  captionBlocked: (caption: string) => boolean;                                   // brand-book check (checkVoice); true = refuse
  postCarousel: (imageUrls: string[], caption: string) => Promise<{ postId: string }>;
  postStory: (imageUrl: string, linkUrl: string) => Promise<{ postId: string }>;
};
export type DripResult = { action: "none" | "feed" | "story" | "halted" | "refused"; id?: string; reason?: string; postId?: string };

/** Grid rhythm: odd-numbered products (1st, 3rd...) lead with the model photo (slide2.jpg), even-numbered lead with the product (slide1.jpg). Files are never renamed. */
export function orderSlides(slides: string[], position: number): string[] {
  return position % 2 === 1 && slides.length >= 2 ? [slides[1], slides[0], ...slides.slice(2)] : slides;
}

export const abs = (p: string) => (p.startsWith("http") ? p : `${SITE}${p}`);

export async function runDrip(
  items: DripItem[],
  deps: DripDeps,
  opts: { now: Date; enabled: boolean; force?: boolean },
): Promise<DripResult> {
  if (!opts.enabled && !opts.force) return { action: "none", reason: "IG_DRIP_ENABLED is off" };
  const rows = await deps.rows();
  const failed = rows.find((r) => r.error);
  if (failed) return { action: "halted", id: failed.id, reason: `Queue stopped after an error on ${failed.id}. Check it, then clear the error.` };
  const by = new Map(rows.map((r) => [r.id, r]));
  const { now, force } = opts;

  // 1. A story that is due (15 minutes after its post).
  if (!force || true) {
    for (const it of items) {
      const r = by.get(it.id);
      if (!r || !r.posted_at || !r.ig_post_id || r.story_started_at || r.story_id) continue;
      if (now.getTime() - new Date(r.posted_at).getTime() < STORY_DELAY_MIN * 60_000) continue;
      if (!(await deps.claimStory(it.id, now))) return { action: "none", reason: "story already claimed" };
      try {
        const res = await deps.postStory(abs(it.story), it.story_link);
        await deps.saveStory(it.id, res.postId);
        return { action: "story", id: it.id, postId: res.postId };
      } catch (e) {
        await deps.saveError(it.id, `story: ${e instanceof Error ? e.message : String(e)}`);
        return { action: "halted", id: it.id, reason: "story failed" };
      }
    }
  }

  // 2. The next feed post: first approved, unposted product in queue order, once 6h have passed since the last actual post.
  const lastPosted = rows.map((r) => r.posted_at).filter((x): x is string => !!x).sort().pop() ?? null;
  const due = dueAt(lastPosted);
  if (!force && due && due.getTime() > now.getTime()) return { action: "none", reason: `next post due ${due.toISOString()}` };
  const next = items.find((it) => {
    const r = by.get(it.id);
    return !!r && r.status === "approved" && !r.posted_at;
  });
  if (!next) return { action: "none", reason: "nothing approved and unposted" };
  const row = by.get(next.id)!;
  const caption = (row.caption ?? next.caption).trim();
  if (deps.captionBlocked(caption)) return { action: "refused", id: next.id, reason: "Caption breaks the brand book" };
  if (next.slides.length < 2) return { action: "refused", id: next.id, reason: "Needs two slides" };

  if (!(await deps.claimFeed(next.id, now))) return { action: "none", reason: "already claimed" };
  try {
    const res = await deps.postCarousel(orderSlides(next.slides, items.indexOf(next) + 1).map(abs), caption);
    await deps.saveFeed(next.id, res.postId);
    return { action: "feed", id: next.id, postId: res.postId };
  } catch (e) {
    await deps.saveError(next.id, e instanceof Error ? e.message : String(e));
    return { action: "halted", id: next.id, reason: "post failed" };
  }
}
