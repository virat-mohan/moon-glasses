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

/**
 * Takes an order's units out of Inventory Master, all or nothing, only once
 * payment is confirmed. Never oversells: each line is a conditional update
 * that only lands while stock_on_hand is still >= the quantity.
 *
 * First choice is the decrement_order_stock RPC (one transaction for every
 * line, supabase/migrations/20261002_atomic_stock_decrement.sql). Until that
 * migration is applied, it falls back to a compare-and-set per line
 * (update ... where stock_on_hand = <value read> and stock_on_hand >= qty),
 * retried a few times on contention, rolling back earlier lines if a later
 * one is short. Throws OutOfStockError when any line can't be filled.
 */
export class OutOfStockError extends Error {
  constructor(public slug: string) {
    super(`Sorry, ${chapters.find((c) => c.slug === slug)?.name ?? slug} just sold out.`);
    this.name = "OutOfStockError";
  }
}

export async function decrementStockForOrder(items: { slug: string; quantity: number }[]) {
  const supabase = getSupabaseServerClient();
  const lines = items.filter((i) => i.quantity > 0);

  const { data: rpcRows, error: rpcError } = await supabase.rpc("decrement_order_stock", {
    p_items: lines.map((i) => ({ slug: i.slug, quantity: i.quantity })),
  });
  if (!rpcError) {
    const rows = (rpcRows ?? []) as { chapter_slug: string; stock_on_hand: number | null }[];
    const short = rows.find((r) => r.stock_on_hand === null);
    if (short) throw new OutOfStockError(short.chapter_slug);
    for (const row of rows) await checkAndAlertLowStock(row.chapter_slug, row.stock_on_hand as number);
    return;
  }
  // PGRST202 / 42883 = function not found: migration not applied yet.
  if (rpcError.code !== "PGRST202" && rpcError.code !== "42883") throw rpcError;

  const done: { slug: string; quantity: number }[] = [];
  try {
    for (const line of lines) {
      let landed: number | null = null;
      for (let attempt = 0; attempt < 5 && landed === null; attempt++) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("stock_on_hand")
          .eq("chapter_slug", line.slug)
          .maybeSingle();
        // No Inventory Master row means the product isn't stock-tracked; leave it be.
        if (!inv) break;
        if (inv.stock_on_hand < line.quantity) throw new OutOfStockError(line.slug);
        const next = inv.stock_on_hand - line.quantity;
        const { data: updated } = await supabase
          .from("inventory")
          .update({ stock_on_hand: next })
          .eq("chapter_slug", line.slug)
          .eq("stock_on_hand", inv.stock_on_hand)
          .gte("stock_on_hand", line.quantity)
          .select("stock_on_hand");
        if (updated && updated.length) landed = next;
      }
      if (landed === null) {
        const { data: exists } = await supabase.from("inventory").select("chapter_slug").eq("chapter_slug", line.slug).maybeSingle();
        if (exists) throw new OutOfStockError(line.slug);
        continue;
      }
      done.push(line);
      await checkAndAlertLowStock(line.slug, landed);
    }
  } catch (err) {
    for (const line of done) {
      const { data: inv } = await supabase.from("inventory").select("stock_on_hand").eq("chapter_slug", line.slug).maybeSingle();
      if (inv) {
        await supabase.from("inventory").update({ stock_on_hand: inv.stock_on_hand + line.quantity }).eq("chapter_slug", line.slug);
      }
    }
    throw err;
  }
}
