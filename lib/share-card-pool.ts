import { getSupabaseServerClient } from "@/lib/supabase";
import { chapters } from "@/lib/chapters";

export type ShareCardProduct = { imageUrl: string; productName: string };

/**
 * Static chapters that actually ship a real lifestyle/model photo
 * (public/images/chapters/<folder>/lifestyle.jpg) — hardcoded rather than
 * checked via fs at request time, since the public/ folder isn't reliably
 * readable from a serverless function at runtime the way it is in dev.
 */
const STATIC_LIFESTYLE_SLUGS = new Set([
  "moon-aviator-classic-black-yellow",
  "moon-aviator-classic-demi-brown-grey-graded",
  "moon-aviator-metal-black-yellow",
  "moon-aviator-metal-gold-green",
  "moon-aviator-metal-gunmetal-brown",
  "moon-octagon-black-blue",
  "moon-octagon-gold-grey",
  "moon-octagon-silver-grey",
  "moon-octagon-silver-light-brown",
  "moon-rectangle-black-blue",
  "moon-rectangle-black-orange",
  "moon-rectangle-black-purple",
  "moon-round-black-light-brown",
  "moon-round-demi-brown-blue-graded",
  "moon-wayfarer-black-green",
  "moon-wayfarer-demi-brown-light-brown",
]);

function hashToIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

/**
 * Every product with a real model/lifestyle photo — static chapters with a
 * shot lifestyle.jpg, plus admin-added products with a generated model_image
 * (see lib/image-gen.ts's generateModelPhoto). Feeds the Pay With A Post
 * share card: each barterer's post features a different model wearing a
 * different pair, so a stream of these posts (once tagged/collaborator-added)
 * reads as a varied lookbook on the brand's own Instagram rather than the
 * same single photo repeated by everyone who shares.
 */
export async function getShareCardProductPool(): Promise<ShareCardProduct[]> {
  const staticPool: ShareCardProduct[] = chapters
    .filter((c) => c.verifiedOnSite !== false && STATIC_LIFESTYLE_SLUGS.has(c.folder))
    .map((c) => ({ imageUrl: `/images/chapters/${c.folder}/lifestyle.jpg`, productName: c.name }));

  const supabase = getSupabaseServerClient();
  const { data: dynamicChapters } = await supabase
    .from("dynamic_chapters")
    .select("name, model_image")
    .eq("live", true)
    .not("model_image", "is", null);

  const dynamicPool: ShareCardProduct[] = (dynamicChapters ?? [])
    .filter((c): c is { name: string; model_image: string } => !!c.model_image)
    .map((c) => ({ imageUrl: c.model_image, productName: c.name }));

  return [...staticPool, ...dynamicPool];
}

/** Deterministic per seed (e.g. an order id) — same order always shows the same pick, different orders land on different products. */
export function pickShareCardProduct(pool: ShareCardProduct[], seed: string): ShareCardProduct | null {
  if (pool.length === 0) return null;
  return pool[hashToIndex(seed, pool.length)];
}
