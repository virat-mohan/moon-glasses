import { chapters, chapterImageSrc } from "@/lib/chapters";

/**
 * Parses a `?items=slug:qty,slug:qty` cart deep-link — used to hand a WhatsApp
 * catalog order straight into the real checkout flow (Razorpay, invoice,
 * Miles, referral, abandoned-cart recovery) instead of a disconnected
 * ad-hoc payment link. Unknown slugs or malformed entries are skipped rather
 * than throwing, since this is parsed from a URL a human pasted by hand.
 */
export function parseCartDeepLink(itemsParam: string) {
  const resolved: { chapter: (typeof chapters)[number]; image: string; quantity: number }[] = [];

  for (const part of itemsParam.split(",")) {
    const [slug, qtyRaw] = part.split(":");
    if (!slug) continue;
    const chapter = chapters.find((c) => c.slug === slug.trim());
    if (!chapter) continue;
    const quantity = Math.max(1, parseInt(qtyRaw ?? "1", 10) || 1);
    resolved.push({ chapter, image: chapterImageSrc(chapter.folder, chapter.sideImage), quantity });
  }

  return resolved;
}
