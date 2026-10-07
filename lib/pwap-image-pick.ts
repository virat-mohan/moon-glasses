// Model-photo choice for a new post kit: least recently used across ALL kits.
export type PoolItem = { slug: string };

/**
 * @param lastUsedAt  slug -> ms timestamp of the most recent kit that used it (absent = never used)
 * @param usedByCustomer  slugs this same customer (email/phone) already posted
 * Rules: skip the customer's own slugs unless that empties the pool; skip the
 * single most recently used slug overall when more than one option remains;
 * then never-used first, then oldest use; ties by slug.
 */
export function pickLeastRecentlyUsed<T extends PoolItem>(
  pool: T[],
  lastUsedAt: Map<string, number>,
  usedByCustomer: Set<string> = new Set()
): T | null {
  if (pool.length === 0) return null;
  let candidates = pool.filter((p) => !usedByCustomer.has(p.slug));
  if (candidates.length === 0) candidates = [...pool];

  let newest: string | null = null;
  let newestAt = -Infinity;
  for (const [slug, at] of lastUsedAt) {
    if (pool.some((p) => p.slug === slug) && at > newestAt) {
      newest = slug;
      newestAt = at;
    }
  }
  if (newest && candidates.length > 1) {
    const rest = candidates.filter((p) => p.slug !== newest);
    if (rest.length > 0) candidates = rest;
  }

  return [...candidates].sort((a, b) => {
    const ua = lastUsedAt.get(a.slug) ?? -1;
    const ub = lastUsedAt.get(b.slug) ?? -1;
    return ua - ub || a.slug.localeCompare(b.slug);
  })[0];
}
