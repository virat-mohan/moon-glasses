import type { StorySeries } from "@/types/chapter";
import { chapters } from "@/lib/chapters";

export const seriesOrder: { name: StorySeries; slug: string; blurb: string }[] = [
  { name: "Plastic", slug: "plastic", blurb: "Acetate frames, flat ₹1,499." },
  { name: "Metal", slug: "metal", blurb: "Metal frames, flat ₹1,499." },
];

export function seriesChapters(name: StorySeries) {
  return chapters.filter((c) => c.series === name);
}
