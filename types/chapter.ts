export type StorySeries = "Plastic" | "Metal";

export type Chapter = {
  slug: string;
  name: string;
  series: StorySeries;
  /** Folder name under public/images/chapters, kept exactly as supplied. */
  folder: string;
  /** Filenames within that folder, in display order. */
  images: string[];
  /** Filename of the hero shot shown on this Chapter's own detail page — admin-editable, doesn't affect anywhere else. */
  primary: string;
  /** Filename of the side-profile shot used everywhere a product is browsed (homepage, series grids, explore globe) — fixed per Chapter, independent of `primary`. */
  sideImage: string;
  /** Full Storage URL for the homepage tile's hover-flip lifestyle/model shot — admin-uploaded via /admin/product-images. Undefined falls back to the static lifestyle.jpg convention. */
  modelImage?: string;
  /** Gender of the model in that lifestyle shot, if known — used only to make sure a grid's initial open state shows a mix of male and female models rather than one gender by coincidence. */
  modelGender?: "male" | "female";
  /** Short editorial line for this product. */
  story: string;
  /** Price in INR — Plastic ₹1,499 flat, Metal ₹1,999 flat. No frame-material selector: material is fixed per SKU. */
  price: number;
  /** False for Chapters not confirmed live at brief time — flagged, not guessed. */
  verifiedOnSite: boolean;
};
