import { getSetting } from "@/lib/settings";
import { decideTagging, fetchProductIds, type TagDecision } from "@/lib/instagram-shopping-core";

// Instagram product tagging. Feed posts, carousel slides and reels can carry product tags (needs
// Instagram Shopping approved + the catalogue connected). Stories CANNOT: the Graph API has no
// product sticker, so story product tags stay manual in the app.

const GRAPH = "https://graph.facebook.com/v21.0";
const STATUS_TTL = 10 * 60_000;
const PRODUCT_TTL = 60 * 60_000;

export type ShoppingStatus = { eligible: boolean; reason?: string };

let statusCache: { at: number; value: ShoppingStatus } | null = null;
const productCache = new Map<string, { at: number; id: string | null }>();
const logged = new Set<string>();
function logOnce(msg: string) {
  if (logged.has(msg)) return;
  logged.add(msg);
  console.warn(`[instagram-shopping] ${msg}`);
}

/** Uses META_ACCESS_TOKEN (system user) on graph.facebook.com; the Instagram-login token cannot read this. Never throws. */
export async function getShoppingStatus(force = false): Promise<ShoppingStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < STATUS_TTL) return statusCache.value;
  let value: ShoppingStatus;
  try {
    const [token, igId] = await Promise.all([getSetting("META_ACCESS_TOKEN"), getSetting("INSTAGRAM_BUSINESS_ACCOUNT_ID")]);
    if (!token || !igId) {
      value = { eligible: false, reason: "META_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID missing" };
    } else {
      const res = await fetch(`${GRAPH}/${igId}?` + new URLSearchParams({ fields: "shopping_product_tag_eligibility", access_token: token }));
      const data = await res.json();
      if (!res.ok) value = { eligible: false, reason: `Meta error: ${data?.error?.message ?? res.status}` };
      else if (data.shopping_product_tag_eligibility === true) value = { eligible: true };
      else value = { eligible: false, reason: "Instagram Shopping is not connected or approved yet" };
    }
  } catch (err) {
    value = { eligible: false, reason: err instanceof Error ? err.message : "status check failed" };
  }
  statusCache = { at: Date.now(), value };
  return value;
}

/** slug -> catalogue product id for the slugs that exist, are in stock and visible. Cached ~1h per slug. Never throws. */
export async function resolveProductIds(slugs: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(slugs.filter(Boolean))];
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const s of unique) {
    const c = productCache.get(s);
    if (c && Date.now() - c.at < PRODUCT_TTL) { if (c.id) out[s] = c.id; }
    else missing.push(s);
  }
  if (missing.length === 0) return out;
  try {
    const [token, catalogId] = await Promise.all([getSetting("META_ACCESS_TOKEN"), getSetting("META_CATALOG_ID")]);
    if (!token || !catalogId) return out;
    const found = await fetchProductIds(missing, { catalogId, token, base: GRAPH, fetchFn: (u) => fetch(u) });
    for (const s of missing) {
      productCache.set(s, { at: Date.now(), id: found[s] ?? null });
      if (found[s]) out[s] = found[s];
    }
  } catch (err) {
    logOnce(`product lookup failed: ${err instanceof Error ? err.message : err}`);
  }
  return out;
}

/** One call for the publisher: which product ids (per slug, in order) can be tagged right now. */
export async function planTagging(slugs: (string | undefined | null)[]): Promise<{ decision: TagDecision; ids: (string | undefined)[] }> {
  const wanted = slugs.filter((s): s is string => !!s);
  if (wanted.length === 0) return { decision: "skip-no-products", ids: slugs.map(() => undefined) };
  const status = await getShoppingStatus();
  if (!status.eligible) {
    logOnce(`product tagging skipped: ${status.reason ?? "not eligible"}`);
    return { decision: "skip-not-eligible", ids: slugs.map(() => undefined) };
  }
  const map = await resolveProductIds(wanted);
  const ids = slugs.map((s) => (s ? map[s] : undefined));
  const decision = decideTagging(true, ids.filter(Boolean) as string[]);
  if (decision !== "tag") logOnce(`product tagging skipped: no catalogue match for ${wanted.join(", ")}`);
  return { decision, ids };
}

export function logTagFallback(reason: string) {
  console.warn(`[instagram-shopping] container rejected with product_tags, retrying without: ${reason}`);
}

export async function getShoppingOverview() {
  const status = await getShoppingStatus(true);
  const [token, catalogId] = await Promise.all([getSetting("META_ACCESS_TOKEN"), getSetting("META_CATALOG_ID")]);
  let catalogue: { name?: string; productCount?: number; lastUpload?: string; lastUploadItems?: number; lastUploadErrors?: number } | null = null;
  if (token && catalogId) {
    try {
      const [c, f] = await Promise.all([
        fetch(`${GRAPH}/${catalogId}?` + new URLSearchParams({ fields: "name,product_count", access_token: token })).then((r) => r.json()),
        fetch(`${GRAPH}/${catalogId}/product_feeds?` + new URLSearchParams({ fields: "latest_upload{end_time,num_persisted_items,error_count}", access_token: token })).then((r) => r.json()),
      ]);
      const up = f?.data?.[0]?.latest_upload;
      catalogue = { name: c?.name, productCount: c?.product_count, lastUpload: up?.end_time, lastUploadItems: up?.num_persisted_items, lastUploadErrors: up?.error_count };
    } catch { /* leave null */ }
  }
  return { ...status, catalogue };
}
