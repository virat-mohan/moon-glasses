import type { MetadataRoute } from "next";
import { getCoreCollectionChapters, getLimitedSeriesChapters } from "@/lib/chapters-dynamic";
import { getBrandProfile } from "@/lib/brand";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brand = await getBrandProfile();
  // Canonical host is www (the bare domain 301s there).
  const base = brand.siteUrl.replace(/\/$/, "").replace(/^https:\/\/(?!www\.)/, "https://www.");
  const now = new Date();

  const staticPages = [
    "",
    "/about",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/shipping-policy",
    "/pay-with-a-post",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  // Only what's actually live on the storefront (Collection + Limited Series),
  // so held/draft products never get indexed.
  const live = [...(await getCoreCollectionChapters()), ...(await getLimitedSeriesChapters())];
  const chapterPages = live.map((c) => ({
    url: `${base}/chapter/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...chapterPages];
}
