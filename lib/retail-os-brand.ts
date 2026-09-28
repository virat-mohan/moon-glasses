// Retail OS brand configuration — Moon-glasses instance.
//
// The CONTRACT (types, defineRetailOsBrand, validateRetailOsBrand, titleBrandName)
// now comes from the shared versioned package @retail-os/brand-config
// (github:virat-mohan/retail-os-brand-config, pinned in package.json). This file
// holds only Moon's VALUES — no local copy of the contract, so there is one
// canonical source and no drift. Values are unchanged from the previous local
// implementation. Governed by case-study/BRAND_OUTPUT_STANDARD.md v1.1 in
// virat-mohan/ViratMohan.
import {
  defineRetailOsBrand,
  titleBrandName as titleBrandNameOf,
  type RetailOsBrand,
  type BrandProfile as BaseBrandProfile,
} from "@retail-os/brand-config/brand-identity";

// Moon's AI image pipeline (lib/ad-brief.ts) always uses visualLanguage, so keep
// it required here even though the shared contract treats it as optional.
export type BrandProfile = BaseBrandProfile & { visualLanguage: string };
export type { RetailOsBrand };
export { validateRetailOsBrand } from "@retail-os/brand-config/brand-identity";

// Zero-arg convenience defaulting to the active brand, matching the existing
// call sites (layout, footer) that used the previous local titleBrandName().
export function titleBrandName(b: RetailOsBrand = brand): string {
  return titleBrandNameOf(b);
}

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  brandName: "MOON GLASSES",
  tagline: "See A Brighter You",
  voice:
    "Fashion-forward, editorial, confident — dark/nightlife imagery paired with restrained, minimal copy. Short lines, no hard sell. Built for a young, style-conscious Indian audience.",
  productNoun: "sunglasses",
  currencySymbol: "₹",
  siteUrl: "https://moon-glasses.store",
  instagramHandle: "@moonglassesonline",
  visualLanguage:
    "Near-black backgrounds, high contrast, warm gold (#e0b84a) as the sole accent colour. Editorial nightlife photography — gigs, sets, city-at-night energy — never daytime/beach/outdoor lifestyle. Minimal, uncluttered composition; confident subjects, genuine expressions, no stock-photo posing. Typography-led when text appears: bold, uppercase, generous letter-spacing.",
};

export const moonglassesBrand: RetailOsBrand = defineRetailOsBrand({
  key: "moonglasses",
  profile: DEFAULT_BRAND_PROFILE,
  titleName: "MOON GLASSES™",
  description:
    "MOON GLASSES™ — fashion eyewear for after dark. ₹1,499 acetate, ₹1,999 metal. Ships across India.",
  keywords: ["fashion sunglasses India", "MOON GLASSES", "eyewear", "aviator sunglasses"],
  assets: {
    orgLogoPath: "/images/brand/moon-glasses-logo.png",
    navLogoPath: "/images/brand/moon-glasses-logo.png",
    navLogoAlt: "MOON GLASSES",
    ogImagePath: "/images/brand/moon-glasses-logo.png",
  },
  address: { addressCountry: "IN" },
  social: { instagram: "https://www.instagram.com/moonglassesonline/" },
});

/** The active brand for this deployment. */
export const brand: RetailOsBrand = moonglassesBrand;
