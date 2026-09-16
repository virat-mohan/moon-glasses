import type { MetadataRoute } from "next";
import { getBrandProfile } from "@/lib/brand";

/**
 * Explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot,
 * Google-Extended, etc.) rather than the common default of blocking them —
 * for GEO (Generative Engine Optimization) we want answer engines like
 * ChatGPT/Perplexity/Gemini to actually be able to read and cite the site,
 * not shut them out the way a lot of boilerplate robots.txt does.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const brand = await getBrandProfile();
  const base = brand.siteUrl.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/account", "/checkout", "/cart", "/invoice"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
