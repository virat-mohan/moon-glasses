import type { Chapter } from "@/types/chapter";

/**
 * MOON GLASSES launch catalogue — 10 shapes, each a distinct lens tint,
 * sourced from a licensed supplier (Ted Smith) reference pack. Every SKU is
 * flat ₹1,499 regardless of frame material.
 */
export const chapters: Chapter[] = [
  {
    slug: "moon-01-hexagonal",
    name: "MOON 01 Hexagonal — Grey Tint",
    series: "Metal",
    folder: "moon-01-hexagonal",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Polished silver metal hexagonal frame with a soft grey tint.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-02-rectangular",
    name: "MOON 02 Rectangular — Amber Tint",
    series: "Plastic",
    folder: "moon-02-rectangular",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Heavy matte-black acetate rectangular frame with an amber lens.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-03-aviator",
    name: "MOON 03 Aviator — Green Tint",
    series: "Metal",
    folder: "moon-03-aviator",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Classic black metal aviator with a deep green lens.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-04-wayfarer",
    name: "MOON 04 Wayfarer — Green Tint",
    series: "Plastic",
    folder: "moon-04-wayfarer",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Matte black acetate wayfarer with a dark green lens.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-05-round",
    name: "MOON 05 Round — Blue Tint",
    series: "Metal",
    folder: "moon-05-round",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Polished round metal frame with tortoise accents and a blue lens.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-06-wide-wayfarer",
    name: "MOON 06 Wide Wayfarer — Amber Tint",
    series: "Plastic",
    folder: "moon-06-wide-wayfarer",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Glossy black acetate wide wayfarer with a bold amber lens.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-07-hexagonal-ii",
    name: "MOON 07 Hexagonal — Pink Tint",
    series: "Metal",
    folder: "moon-07-hexagonal-ii",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Polished silver metal hexagonal frame with a pale pink tint.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-08-cateye-oval",
    name: "MOON 08 Cat-Eye — Pink Tint",
    series: "Plastic",
    folder: "moon-08-cateye-oval",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Polished black acetate cat-eye frame with a pink lens.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-09-oval",
    name: "MOON 09 Oval — Pale Yellow Tint",
    series: "Metal",
    folder: "moon-09-oval",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Polished gold metal oval frame with a pale yellow lens.",
    price: 1499,
    verifiedOnSite: true,
  },
  {
    slug: "moon-10-wide-rectangular",
    name: "MOON 10 Wide Rectangular — Blue Tint",
    series: "Plastic",
    folder: "moon-10-wide-rectangular",
    images: ["front.jpg", "angle.jpg", "side.jpg"],
    primary: "front.jpg",
    sideImage: "angle.jpg",
    story: "Matte black acetate wide rectangular frame with a blue lens.",
    price: 1499,
    verifiedOnSite: true,
  },
];

/** One combined spec list shown on every product page. */
export const SHARED_SPECS = [
  "UV400 Protection — Blocks 100% Of UVA/UVB Rays",
  "Impact-Resistant Lenses",
  "Spring-Hinge Temples For All-Day Comfort",
  "Scratch-Resistant Coating",
  "Includes Microfiber Pouch",
  "One Size Fits Most",
  "Designed In India",
];

/**
 * Drops the "MOON 01"-style SKU code for display — customers see
 * "Hexagonal — Grey Tint", the code stays in `name`/`slug` for admin and
 * internal reference only.
 */
export function shortProductName(name: string) {
  return name.replace(/^MOON\s+\d+\s*/, "");
}

/**
 * Real photography lives as "<original stem>_no_bg.png" per product folder.
 */
export function chapterImageSrc(folder: string, file: string) {
  if (/^https?:\/\//.test(file)) return file;

  const dot = file.lastIndexOf(".");
  const stem = dot === -1 ? file : file.slice(0, dot);
  const resolved = `${stem}_no_bg.png`;
  return `/images/chapters/${encodeURIComponent(folder)}/${encodeURIComponent(resolved)}`;
}
