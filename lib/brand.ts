import { getSupabaseServerClient } from "@/lib/supabase";

export type BrandProfile = {
  brandName: string;
  tagline: string;
  voice: string;
  productNoun: string;
  currencySymbol: string;
  siteUrl: string;
  instagramHandle: string;
  /**
   * The visual design language — palette, lighting, mood, composition —
   * for AI-generated imagery that isn't grounded in a real product photo
   * (brand-awareness ad creative, drop-announcement art, etc). Any image
   * generation that DOES depict a specific product must instead use that
   * product's real uploaded photo as an image-to-image reference (see
   * generateAdImage's referenceImageUrl and generateModelPhoto in
   * lib/image-gen.ts) — this field is only for imagery that never renders
   * a specific, un-uploaded product design.
   */
  visualLanguage: string;
};

const BRAND_PROFILE_KEY = "BRAND_PROFILE";

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

/**
 * Everything downstream (ad brief prompts, image-gen prompts, journal drafts)
 * reads brand voice/product from here instead of hardcoding "Moonglasses" or
 * "sunglasses" — swap this one record to repoint the whole marketing pipeline at a
 * different brand or product line later.
 */
export async function getBrandProfile(): Promise<BrandProfile> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", BRAND_PROFILE_KEY)
      .maybeSingle();
    if (!data?.value) return DEFAULT_BRAND_PROFILE;
    return { ...DEFAULT_BRAND_PROFILE, ...JSON.parse(data.value) };
  } catch {
    return DEFAULT_BRAND_PROFILE;
  }
}

export async function setBrandProfile(profile: BrandProfile) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: BRAND_PROFILE_KEY, value: JSON.stringify(profile), updated_at: new Date().toISOString() });
  if (error) throw error;
}
