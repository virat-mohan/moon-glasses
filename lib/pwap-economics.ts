import { getSupabaseServerClient } from "@/lib/supabase";

export type PwapEconomicsInputs = {
  /** Average selling price, GST-inclusive (₹). */
  avgPrice: number;
  /** Average product cost from product_costing (actual, else target) (₹). */
  avgCost: number;
  gstRate: number;
  /** "sales" = real paid orders, last 90 days; "catalogue" = live products. */
  source: "sales" | "catalogue";
  /** Pairs behind the average. */
  basis: number;
};

/**
 * The price and cost of an average pair, for the Pay With A Post money view.
 * Uses the real mix sold in the last 90 days once there are at least 10
 * paid pairs; until then the average across the catalogue's costing rows.
 */
export async function getPwapEconomicsInputs(): Promise<PwapEconomicsInputs> {
  const supabase = getSupabaseServerClient();
  const { data: costing } = await supabase.from("product_costing").select("chapter_slug, price, gst_rate, target_cost, actual_cost");
  const rows = costing ?? [];
  const bySlug = new Map(rows.map((c) => [c.chapter_slug as string, c]));
  const unitCost = (c: (typeof rows)[number]) => Number(c.actual_cost ?? c.target_cost ?? 0);
  const gstRate = Number(rows[0]?.gst_rate ?? 18) > 1 ? Number(rows[0]?.gst_rate ?? 18) / 100 : Number(rows[0]?.gst_rate ?? 0.18);

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: paid } = await supabase
    .from("orders")
    .select("id").eq("is_test", false)
    .eq("payment_status", "paid")
    .neq("status", "cancelled")
    .gte("created_at", since);
  const ids = (paid ?? []).map((o) => o.id as string);
  if (ids.length > 0) {
    const { data: items } = await supabase.from("order_items").select("chapter_slug, quantity, unit_price").in("order_id", ids);
    let pairs = 0;
    let price = 0;
    let cost = 0;
    for (const i of items ?? []) {
      const c = bySlug.get(i.chapter_slug);
      if (!c) continue;
      const q = i.quantity ?? 1;
      pairs += q;
      price += q * Number(i.unit_price ?? c.price);
      cost += q * unitCost(c);
    }
    if (pairs >= 10) {
      return { avgPrice: price / pairs, avgCost: cost / pairs, gstRate, source: "sales", basis: pairs };
    }
  }

  const n = rows.length || 1;
  return {
    avgPrice: rows.reduce((s, c) => s + Number(c.price ?? 0), 0) / n,
    avgCost: rows.reduce((s, c) => s + unitCost(c), 0) / n,
    gstRate,
    source: "catalogue",
    basis: rows.length,
  };
}
