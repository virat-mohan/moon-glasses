import { getSupabaseServerClient } from "@/lib/supabase";
// The brand profile + defaults now live in the canonical Retail OS brand config
// (lib/retail-os-brand.ts), so the AI pipeline and customer-facing surfaces
// share one in-repo source. Re-exported so existing "@/lib/brand" imports keep
// working unchanged.
import { DEFAULT_BRAND_PROFILE, type BrandProfile } from "@/lib/retail-os-brand";

export type { BrandProfile };
export { DEFAULT_BRAND_PROFILE };

const BRAND_PROFILE_KEY = "BRAND_PROFILE";

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
