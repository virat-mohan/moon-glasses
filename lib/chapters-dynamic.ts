import fs from "fs";
import path from "path";
import { chapters as staticChapters, chapterImageSrc } from "@/lib/chapters";
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
  collection: string | null;
  live: boolean | null;
};

type ChapterCollection = "core" | "limited";

function mapDynamicRow(row: {
  slug: string;
  name: string;
  series: string;
  images: string[];
  primary_image: string;
  model_image: string | null;
  story: string;
  price: number;
  verified_on_site: boolean;
  collection: string | null;
  live: boolean | null;
}): Chapter & { collection: ChapterCollection } {
  return {
    slug: row.slug,
    name: row.name,
    series: row.series as Chapter["series"],
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
    live: row.live ?? false,
  };
}

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
        .select("chapter_slug, primary_image, price, story, images, model_image, name, collection, live"),
    ]);

    dynamicChapters = (dynamicRows ?? []).map((row) => mapDynamicRow(row));

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
          collection: r.collection,
          live: r.live,
        },
      ])
    );
  } catch (err) {
    console.error("getAllChapters: Supabase fetch failed, falling back to static list", err);
  }

  const staticWithCollection = [
    ...staticChapters.map((c) => ({ ...c, collection: "core" as ChapterCollection, live: true })),
    ...limitedSeries.map((c) => ({ ...c, collection: "limited" as ChapterCollection, live: true })),
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
      collection: (o.collection as ChapterCollection) ?? c.collection,
      live: o.live ?? c.live,
    };
  });
}

/**
 * Every chapter, both collections, REGARDLESS of live status — used by
 * /chapter/[slug] (which does its own live check before rendering, so a
 * draft's URL doesn't 404 for admins previewing it — see that page) and
 * the admin editing tools that need to find any product by slug.
 */
export async function getAllChapters(): Promise<Chapter[]> {
  return getMergedChapters();
}

/** Just the core/everyday lineup that's actually published — what the homepage grid renders. */
export async function getCoreCollectionChapters(): Promise<Chapter[]> {
  return (await getMergedChapters()).filter((c) => c.collection === "core" && c.live !== false);
}

/** Just the published Limited Series drop line — what /limited-series renders. */
export async function getLimitedSeriesChapters(): Promise<Chapter[]> {
  return (await getMergedChapters()).filter((c) => c.collection === "limited" && c.live !== false);
}

/**
 * The full master inventory — literally every product, code-based or
 * supplier-sourced, live or draft. /admin/master-inventory uses this so you
 * can generate/regenerate a model photo for anything (including the
 * original 16 and the Limited Series) from one screen, not just new
 * imports. `isStatic` tells the UI which rows are code-based (always live,
 * fixed collection — no Publish/Collection controls make sense there) vs.
 * real `dynamic_chapters` rows (draft/publish + collection are editable).
 */
export async function getMasterInventoryChapters(): Promise<
  (Chapter & { collection: ChapterCollection; isStatic: boolean })[]
> {
  const staticSlugs = new Set([...staticChapters, ...limitedSeries].map((c) => c.slug));
  const merged = await getMergedChapters();
  return merged.map((c) => {
    const isStatic = staticSlugs.has(c.slug);
    // Static/limited chapters store `primary` as a bare filename (e.g.
    // "front.jpg") resolved against `folder` at render time everywhere else
    // on the site — dynamic_chapters rows already store a full Supabase URL.
    // The master-inventory list has no folder-aware <Image> component of its
    // own, so resolve it into a real URL here instead of leaking the raw
    // filename to a plain <img src>.
    const primary = isStatic ? chapterImageSrc(c.folder, c.primary) : c.primary;

    // Static chapters don't store their lifestyle shot as `modelImage` at
    // all — CollectionItem instead falls back to the on-disk convention
    // /images/chapters/<folder>/lifestyle.jpg at render time. Without
    // checking that same file here, every one of the original 16 looked
    // like it had no model photo yet, even when it's been live with one for
    // ages. Only claim it exists when the file is actually there, same as
    // CollectionItem's own onError fallback.
    let modelImage = c.modelImage;
    if (!modelImage && isStatic) {
      const lifestylePath = path.join(process.cwd(), "public", "images", "chapters", c.folder, "lifestyle.jpg");
      if (fs.existsSync(lifestylePath)) {
        modelImage = `/images/chapters/${encodeURIComponent(c.folder)}/lifestyle.jpg`;
      }
    }

    return { ...c, primary, modelImage, isStatic };
  });
}

export async function getChapterBySlug(slug: string): Promise<Chapter | undefined> {
  const all = await getAllChapters();
  return all.find((c) => c.slug === slug);
}
