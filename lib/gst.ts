import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Every Moonglasses price is GST-inclusive (sunglasses, HSN 9004, 18%).
 * These helpers pull the tax back out of an inclusive amount for invoices
 * and the P&L — never add GST on top of a listed price.
 */
export const GST_RATE = 0.18;
export const SUNGLASSES_HSN = "9004";

/** The GST contained in a GST-inclusive amount. */
export function gstIncluded(inclusiveAmount: number): number {
  return Math.round(inclusiveAmount - inclusiveAmount / (1 + GST_RATE));
}

/** The taxable value (amount before GST) of a GST-inclusive amount. */
export function exGst(inclusiveAmount: number): number {
  return inclusiveAmount - gstIncluded(inclusiveAmount);
}

/** Business GSTIN from app_settings ("GSTIN"); null until it's been set. */
export async function getGstin(): Promise<string | null> {
  try {
    const { data } = await getSupabaseServerClient().from("app_settings").select("value").eq("key", "GSTIN").maybeSingle();
    return data?.value?.trim() || null;
  } catch {
    return null;
  }
}
