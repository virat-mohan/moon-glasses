// Retail OS brand configuration — Moon-glasses instance.
//
// Canonical contract & source of truth: the `virat-mohan/ViratMohan` repo,
// `retail-os/brand-config/` (the Retail OS brand-configuration layer), governed
// by `case-study/BRAND_OUTPUT_STANDARD.md` v1.1 — viratmohan.com design
// authority → DevShop expression → Retail OS expression → client brand config.
//
// This is Moon-glasses' INSTANCE of the same contract Travaholic uses (second
// proof point). Moon stays visually and verbally Moon — this only removes
// hardcoded brand-identity duplication so the brand is configured, not
// hand-edited. Deterministic and isomorphic: plain constants, no server-only
// imports, no network/AI needed to resolve identity; safe in server components,
// client components and tests.
//
// Contract notes vs the Travaholic instance (for the future shared package):
//  - `BrandProfile.visualLanguage` is REQUIRED here (Moon's AI pipeline uses it);
//    it should be an OPTIONAL field in the canonical contract.
//  - `titleName` (the ™ page-title variant) and the optional identity fields
//    below are additive, generic fields — no Moon-specific hacks in the contract.

export type BrandProfile = {
  brandName: string;
  tagline: string;
  voice: string;
  productNoun: string;
  currencySymbol: string;
  siteUrl: string;
  instagramHandle: string;
  /** AI image-generation visual language (see lib/image-gen.ts). Moon-required; optional in the canonical contract. */
  visualLanguage: string;
};

// Moved here from lib/brand.ts so the AI pipeline and customer-facing surfaces
// share one in-repo source. Values unchanged.
export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  brandName: "Moonglasses",
  tagline: "Light tints, good vibe",
  voice:
    "Fashion-forward, editorial, confident — dark/nightlife imagery paired with restrained, minimal copy. Short lines, no hard sell. Built for a young, style-conscious Indian audience.",
  productNoun: "sunglasses",
  currencySymbol: "₹",
  siteUrl: "https://moon-glasses.store",
  instagramHandle: "@moonglassesonline",
  visualLanguage:
    "Near-black backgrounds, high contrast, warm gold (#E7C77A) as the sole accent colour. Editorial nightlife photography — gigs, sets, city-at-night energy — never daytime/beach/outdoor lifestyle. Minimal, uncluttered composition; confident subjects, genuine expressions, no stock-photo posing. Typography-led when text appears: bold, uppercase, generous letter-spacing.",
};

export type RetailOsBrand = {
  key: string;
  profile: BrandProfile;
  /** Page-title brand form when it differs from brandName (e.g. a ™ variant). Falls back to brandName. */
  titleName?: string;
  description: string;
  keywords: string[];
  assets: {
    orgLogoPath: string; // absolute-from-root; used in Organization JSON-LD
    navLogoPath: string;
    navLogoAlt: string;
    ogImagePath: string;
  };
  /** Optional identity block (a brand may render none of it, as Moon's footer does today). */
  address?: { addressCountry: string; streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string; full?: string };
  social?: { instagram?: string; facebook?: string };
};

/** Moon-glasses — exact current identity values (no visible change on consumption). */
export const moonglassesBrand: RetailOsBrand = {
  key: "moonglasses",
  profile: DEFAULT_BRAND_PROFILE,
  titleName: "Moonglasses™",
  description:
    "Moonglasses™ — fashion eyewear for after dark. The Collection from ₹1,499, the Limited Series from ₹1,999. Ships across India.",
  keywords: ["fashion sunglasses India", "MOON GLASSES", "eyewear", "aviator sunglasses"],
  assets: {
    orgLogoPath: "/images/brand/moon-glasses-logo.png",
    navLogoPath: "/images/brand/moon-glasses-logo.png",
    navLogoAlt: "MOON GLASSES",
    ogImagePath: "/images/brand/moon-glasses-logo.png",
  },
  address: { addressCountry: "IN" },
  social: { instagram: "https://www.instagram.com/moonglassesonline/" },
};

/** The active brand for this deployment. */
export const brand: RetailOsBrand = moonglassesBrand;

/** The brand name used in page titles (™ variant when set). */
export function titleBrandName(b: RetailOsBrand = brand): string {
  return b.titleName ?? b.profile.brandName;
}

/** Deterministic validation — required identity fields present and well-formed. */
export function validateRetailOsBrand(b: RetailOsBrand): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!b.key?.trim()) errors.push("key is required");
  if (!b.profile?.brandName?.trim()) errors.push("profile.brandName is required");
  if (!b.profile?.siteUrl?.startsWith("http")) errors.push("profile.siteUrl must be an absolute URL");
  if (!b.profile?.visualLanguage?.trim()) errors.push("profile.visualLanguage is required for Moon");
  if (!b.description?.trim()) errors.push("description is required");
  if (!b.assets?.navLogoPath?.startsWith("/")) errors.push("assets.navLogoPath must be a root-relative path");
  if (!b.assets?.ogImagePath?.startsWith("/")) errors.push("assets.ogImagePath must be a root-relative path");
  return { ok: errors.length === 0, errors };
}
