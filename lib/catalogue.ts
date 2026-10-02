import type { Chapter } from "@/types/chapter";

export type CatalogueItem = {
  slug: string;
  name: string;
  /** Moonglasses' own model name, e.g. "Voltage". */
  model: string;
  /** Model + shape, e.g. "Voltage Aviator": groups the colourways. */
  group: string;
  colour: string;
  material: string;
  price: number;
  description: string;
  folder: string;
  sideImage: string;
  modelImage?: string;
  collectionLabel: "Collection" | "Limited Series";
};

/** "Voltage Aviator — Gold Pink" → model Voltage, group "Voltage Aviator", colour "Gold Pink". */
export function parseName(name: string) {
  const [left, right = ""] = name.split(/\s+—\s+/);
  const words = left.replace(/\([^)]*\)/g, " ").replace(/^MOON\s*\d*\s*/i, "").trim().split(/\s+/).filter(Boolean);
  const model = words.length > 1 ? words.slice(0, -1).join(" ") : "";
  return { group: words.join(" ") || left, model, colour: right.replace(/\([^)]*\)/g, "").trim() };
}

/** Only what the site really shows: live products, in a stable order (collection, then model). */
export function liveCatalogue(chapters: (Chapter & { collection?: string })[]): CatalogueItem[] {
  return chapters
    .filter((c) => c.live !== false)
    .map((c): CatalogueItem => {
      const { group, model, colour } = parseName(c.name);
      return {
        slug: c.slug,
        name: c.name,
        model,
        group,
        colour,
        material: c.series === "Metal" ? "Metal" : "Acetate",
        price: c.price,
        description: c.story.slice(0, 500),
        folder: c.folder,
        sideImage: c.sideImage,
        modelImage: c.modelImage,
        collectionLabel: c.collection === "limited" ? "Limited Series" : "Collection",
      };
    })
    .sort((a, b) => a.collectionLabel.localeCompare(b.collectionLabel) || a.group.localeCompare(b.group) || a.colour.localeCompare(b.colour));
}
