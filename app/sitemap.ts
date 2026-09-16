import type { MetadataRoute } from "next";
import { chapters } from "@/lib/chapters";
import { getBrandProfile } from "@/lib/brand";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brand = await getBrandProfile();
  const base = brand.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticPages = [
    "",
    "/about",
    "/preorder",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/shipping-policy",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  const chapterPages = chapters.map((c) => ({
    url: `${base}/chapter/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...chapterPages];
}
