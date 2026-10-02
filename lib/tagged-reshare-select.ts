/**
 * Pure selection logic for the auto-reshare cron (app/api/cron/tagged-reshare).
 * Decides which tagged posts / story mentions go out as our Story this run and
 * which are recorded as skipped, so nothing is ever reshared twice and a first
 * run never dumps a backlog.
 */
export type ReshareCandidate = { id: string; username: string | null; timestamp: string };
export type ReshareSkip<T> = { item: T; reason: string };
export type ReshareSelection<T> = { post: T[]; skip: ReshareSkip<T>[]; deferred: T[] };

export const RESHARE_MAX_AGE_DAYS = 7;
export const RESHARE_MAX_PER_RUN = 5;

export function selectReshares<T extends ReshareCandidate>(input: {
  items: T[];
  handledIds: Set<string>;
  ownUsername: string | null;
  now: Date;
  /** True until the first successful run has recorded the existing backlog. */
  firstRun: boolean;
  cap?: number;
  maxAgeDays?: number;
}): ReshareSelection<T> {
  const cap = input.cap ?? RESHARE_MAX_PER_RUN;
  const maxAgeMs = (input.maxAgeDays ?? RESHARE_MAX_AGE_DAYS) * 24 * 60 * 60 * 1000;
  const own = input.ownUsername?.toLowerCase().replace(/^@/, "") || null;
  const out: ReshareSelection<T> = { post: [], skip: [], deferred: [] };
  const seen = new Set<string>();
  // Oldest first, so a burst of tags goes out in the order it arrived.
  const sorted = [...input.items].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (const item of sorted) {
    if (input.handledIds.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    const user = item.username?.toLowerCase().replace(/^@/, "") || null;
    if (own && user === own) {
      out.skip.push({ item, reason: "Our own account" });
      continue;
    }
    const t = Date.parse(item.timestamp);
    const tooOld = !Number.isFinite(t) || input.now.getTime() - t > maxAgeMs;
    if (tooOld) {
      out.skip.push({
        item,
        reason: input.firstRun ? "Before auto-reshare was switched on" : `Older than ${input.maxAgeDays ?? RESHARE_MAX_AGE_DAYS} days`,
      });
      continue;
    }
    if (out.post.length >= cap) {
      out.deferred.push(item); // left unrecorded, picked up next run
      continue;
    }
    out.post.push(item);
  }
  return out;
}
