import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Pre-launch switch. While on, the storefront says "Launching soon" everywhere
 * a shopper could buy (announcement bar, Get it buttons, the join block) and
 * points them at the waitlist instead. Flipped from /admin/master-inventory.
 * Read straight from app_settings so it doesn't need a secrets-panel entry.
 */
export const LAUNCH_SOON_KEY = "LAUNCH_SOON";

export async function isLaunchSoon(): Promise<boolean> {
  try {
    const { data } = await getSupabaseServerClient()
      .from("app_settings")
      .select("value")
      .eq("key", LAUNCH_SOON_KEY)
      .maybeSingle();
    return data?.value === "true";
  } catch {
    return false;
  }
}
