import type { StorySeries } from "@/types/chapter";
import { chapters } from "@/lib/chapters";

export const seriesOrder: { name: StorySeries; slug: string; blurb: string }[] = [
  { name: "Plastic", slug: "plastic", blurb: "Acetate frames, from ₹1,499." },
  { name: "Metal", slug: "metal", blurb: "Metal frames, from ₹1,999." },
];

export function seriesChapters(name: StorySeries) {
  return chapters.filter((c) => c.series === name);
}
