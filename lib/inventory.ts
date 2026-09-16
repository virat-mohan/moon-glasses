import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { sendLowStockAlertEmail } from "@/lib/email";
import { chapters } from "@/lib/chapters";

export type StockLabel = "out-of-stock" | "selling-fast" | null;

// Small-batch stock — 10 units left is the point urgency messaging starts
// being credibly true rather than a generic marketing nudge.
const SELLING_FAST_THRESHOLD = 10;

export function stockLabelFor(stock: number | undefined): StockLabel {
  if (stock === undefined) return null;
  if (stock <= 0) return "out-of-stock";
  if (stock <= SELLING_FAST_THRESHOLD) return "selling-fast";
  return null;
}

/** Chapter slug -> stock on hand. Missing slugs simply render no badge. */
export async function getInventoryMap(): Promise<Record<string, number>> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("inventory").select("chapter_slug, stock_on_hand");
    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.chapter_slug, row.stock_on_hand]));
  } catch {
    return {};
  }
}

/**
 * Call this right after any stock_on_hand write (order decrement, RTO/return
 * restock, or a manual admin edit) with the row's new value. Fires one email
 * the moment stock first dips at/under the threshold — guarded by
 * low_stock_alerted so it doesn't resend on every subsequent order while
 * still low, and resets automatically once a restock brings it back above
 * threshold so the next dip alerts again.
 */
export async function checkAndAlertLowStock(chapterSlug: string, newStock: number) {
  try {
    const supabase = getSupabaseServerClient();
    const thresholdSetting = await getSetting("LOW_STOCK_THRESHOLD_UNITS");
    const threshold = thresholdSetting ? Number(thresholdSetting) : SELLING_FAST_THRESHOLD;

    const { data: row } = await supabase
      .from("inventory")
      .select("low_stock_alerted")
      .eq("chapter_slug", chapterSlug)
      .maybeSingle();

    if (newStock > threshold) {
      if (row?.low_stock_alerted) {
        await supabase.from("inventory").update({ low_stock_alerted: false }).eq("chapter_slug", chapterSlug);
      }
      return;
    }

    if (row?.low_stock_alerted) return; // already alerted for this dip

    const chapterName = chapters.find((c) => c.slug === chapterSlug)?.name ?? chapterSlug;
    await sendLowStockAlertEmail(chapterName, newStock, threshold);
    await supabase.from("inventory").update({ low_stock_alerted: true }).eq("chapter_slug", chapterSlug);
  } catch (err) {
    console.error("Low-stock alert check failed", chapterSlug, err);
  }
}
