// Pure helpers for Instagram product tagging. No settings/db imports so they can be unit-tested
// with node --test. Network goes through an injected fetch.

export const MAX_PRODUCT_TAGS = 5;
/** Lower centre: brand standard keeps the face in the top half, never put anything on the face. */
export const TAG_Y = 0.84;
export const TAG_MIN_Y = 0.7;

export type ProductTag = { product_id: string; x: number; y: number };

const clamp = (n: number) => Math.min(0.95, Math.max(0.05, n));

/** Image/carousel-slide tags: max 5, centred at y=0.84, spread horizontally when several. */
export function buildProductTags(productIds: string[], opts: { y?: number } = {}): ProductTag[] {
  const ids = [...new Set(productIds.filter(Boolean))].slice(0, MAX_PRODUCT_TAGS);
  const n = ids.length;
  const y = clamp(Math.max(opts.y ?? TAG_Y, TAG_MIN_Y));
  return ids.map((product_id, i) => {
    const x = n === 1 ? 0.5 : n === 2 ? [0.35, 0.65][i] : n === 3 ? [0.3, 0.5, 0.7][i] : 0.15 + (0.7 * i) / (n - 1);
    return { product_id, x: clamp(x), y };
  });
}

/** Reels carry product tags without a position. */
export function buildReelProductTags(productIds: string[]): { product_id: string }[] {
  return [...new Set(productIds.filter(Boolean))].slice(0, MAX_PRODUCT_TAGS).map((product_id) => ({ product_id }));
}

export type TagDecision = "tag" | "skip-not-eligible" | "skip-no-products";
export function decideTagging(eligible: boolean, productIds: string[]): TagDecision {
  if (!eligible) return "skip-not-eligible";
  return productIds.length > 0 ? "tag" : "skip-no-products";
}

/** After a container call fails: retry once without tags if tags were sent, else surface the error. */
export function decideTagFallback(hadTags: boolean, alreadyRetried: boolean): "retry-without-tags" | "throw" {
  return hadTags && !alreadyRetried ? "retry-without-tags" : "throw";
}

/** Slide i gets product i when counts match; otherwise the first product goes on slide 1 only. */
export function mapCarouselProducts(slideCount: number, productIds: (string | undefined)[]): (string[] | undefined)[] {
  const out: (string[] | undefined)[] = Array.from({ length: slideCount }, () => undefined);
  const ids = productIds.filter((x): x is string => !!x);
  if (ids.length === 0 || slideCount === 0) return out;
  if (productIds.length === slideCount) {
    productIds.forEach((id, i) => { if (id) out[i] = [id]; });
  } else {
    out[0] = [ids[0]];
  }
  return out;
}

type FetchFn = (url: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;

type Row = { id: string; retailer_id?: string; availability?: string; visibility?: string };

/** Slug -> catalogue product id. Slugs missing from the catalogue, out of stock or hidden are left out. */
export async function fetchProductIds(
  slugs: string[],
  o: { catalogId: string; token: string; base?: string; fetchFn: FetchFn }
): Promise<Record<string, string>> {
  const base = o.base ?? "https://graph.facebook.com/v21.0";
  const filter = JSON.stringify({ retailer_id: { is_any: slugs } });
  const build = (fields: string) =>
    `${base}/${o.catalogId}/products?` +
    new URLSearchParams({ fields, filter, limit: "100", access_token: o.token }).toString();
  let url: string | undefined = build("id,retailer_id,availability,visibility");
  let triedPlain = false;
  const out: Record<string, string> = {};
  for (let page = 0; url && page < 10; page++) {
    const res = await o.fetchFn(url);
    const data = await res.json();
    if (!res.ok) {
      if (!triedPlain) { triedPlain = true; url = build("id,retailer_id"); continue; }
      throw new Error(`Catalogue lookup failed: ${JSON.stringify(data?.error?.message ?? data)}`);
    }
    for (const r of (data.data ?? []) as Row[]) {
      if (!r.retailer_id || !slugs.includes(r.retailer_id)) continue;
      if (r.availability && /out of stock/i.test(r.availability)) continue;
      if (r.visibility && /hidden|staging/i.test(r.visibility)) continue;
      out[r.retailer_id] = r.id;
    }
    url = data.paging?.next;
  }
  return out;
}
