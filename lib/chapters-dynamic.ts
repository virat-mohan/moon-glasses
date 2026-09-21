import { chapters as staticChapters } from "@/lib/chapters";
import { limitedSeries } from "@/lib/limited-series";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { Chapter } from "@/types/chapter";

type Override = {
  primary_image: string | null;
  price: number | null;
  story: string | null;
  images: string[] | null;
  model_image: string | null;
  name: string | null;
};

type ChapterCollection = "core" | "limited";

/**
 * Static 16 + anything added from /admin/add-chapter, with per-field edits
 * from /admin/edit-chapter applied. Server-only (uses the Supabase service
 * role client). Every chapter (static or dynamic) also carries which
 * collection it belongs to — "core" (the everyday lineup) or "limited"
 * (the Limited Series drop line) — so the homepage and /limited-series can
 * each show only their half without a second data source.
 */
async function getMergedChapters(): Promise<(Chapter & { collection: ChapterCollection })[]> {
  let dynamicChapters: (Chapter & { collection: ChapterCollection })[] = [];
  let overrides: Record<string, Override> = {};

  try {
    const supabase = getSupabaseServerClient();

    const [{ data: dynamicRows }, { data: overrideRows }] = await Promise.all([
      supabase.from("dynamic_chapters").select("*"),
      supabase
        .from("chapter_hero_overrides")
        .select("chapter_slug, primary_image, price, story, images, model_image, name"),
    ]);

    dynamicChapters = (dynamicRows ?? []).map((row) => ({
      slug: row.slug,
      name: row.name,
      series: row.series,
      folder: "", // unused — dynamic chapters store full URLs in `images`/`primary`
      images: row.images,
      primary: row.primary_image,
      // Admin-added Chapters don't have a separate side-angle pick yet —
      // fall back to whatever was set as the hero image.
      sideImage: row.primary_image,
      modelImage: row.model_image ?? undefined,
      story: row.story,
      price: row.price,
      verifiedOnSite: row.verified_on_site,
      collection: (row.collection as ChapterCollection) ?? "core",
    }));

    overrides = Object.fromEntries(
      (overrideRows ?? []).map((r) => [
        r.chapter_slug,
        {
          primary_image: r.primary_image,
          price: r.price,
          story: r.story,
          images: r.images,
          model_image: r.model_image,
          name: r.name,
        },
      ])
    );
  } catch (err) {
    console.error("getAllChapters: Supabase fetch failed, falling back to static list", err);
  }

  const staticWithCollection = [
    ...staticChapters.map((c) => ({ ...c, collection: "core" as ChapterCollection })),
    ...limitedSeries.map((c) => ({ ...c, collection: "limited" as ChapterCollection })),
  ];

  const merged = [...staticWithCollection, ...dynamicChapters];
  return merged.map((c) => {
    const o = overrides[c.slug];
    if (!o) return c;
    return {
      ...c,
      name: o.name ?? c.name,
      primary: o.primary_image ?? c.primary,
      // sideImage is what the homepage card and the product page's own
      // og:image/thumbnail actually render (see CollectionItem and
      // chapter/[slug]/page.tsx) — without also overriding it here, setting
      // a new hero image only changed the product page's main gallery shot
      // and silently left the homepage showing the old one.
      sideImage: o.primary_image ?? c.sideImage,
      price: o.price ?? c.price,
      story: o.story ?? c.story,
      images: o.images && o.images.length > 0 ? o.images : c.images,
      modelImage: o.model_image ?? c.modelImage,
    };
  });
}

/** Every chapter, both collections — used by /chapter/[slug] and the admin editing tools. */
export async function getAllChapters(): Promise<Chapter[]> {
  return getMergedChapters();
}

/** Just the core/everyday lineup — what the homepage grid renders. */
export async function getCoreCollectionChapters(): Promise<Chapter[]> {
  return (await getMergedChapters()).filter((c) => c.collection === "core");
}

/** Just the Limited Series drop line — what /limited-series renders. */
export async function getLimitedSeriesChapters(): Promise<Chapter[]> {
  return (await getMergedChapters()).filter((c) => c.collection === "limited");
}

export async function getChapterBySlug(slug: string): Promise<Chapter | undefined> {
  const all = await getAllChapters();
  return all.find((c) => c.slug === slug);
}
