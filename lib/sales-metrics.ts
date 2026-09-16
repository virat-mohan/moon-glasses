import { getSupabaseServerClient } from "@/lib/supabase";

export type ChapterSales = {
  chapterSlug: string;
  chapterName: string;
  unitsSold: number;
  revenue: number;
};

/** Aggregates order_items between two ISO timestamps (end exclusive), ranked by units sold. */
export async function getChapterSalesInRange(sinceIso: string, untilIso: string): Promise<ChapterSales[]> {
  const supabase = getSupabaseServerClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .gte("created_at", sinceIso)
    .lt("created_at", untilIso);

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return [];

  const { data: items } = await supabase
    .from("order_items")
    .select("chapter_slug, chapter_name, quantity, unit_price")
    .in("order_id", orderIds);

  const bySlug = new Map<string, ChapterSales>();
  for (const item of items ?? []) {
    const existing = bySlug.get(item.chapter_slug);
    if (existing) {
      existing.unitsSold += item.quantity;
      existing.revenue += item.quantity * item.unit_price;
    } else {
      bySlug.set(item.chapter_slug, {
        chapterSlug: item.chapter_slug,
        chapterName: item.chapter_name,
        unitsSold: item.quantity,
        revenue: item.quantity * item.unit_price,
      });
    }
  }

  return [...bySlug.values()].sort((a, b) => b.unitsSold - a.unitsSold);
}

/** Aggregates order_items over the last `days` days, ranked by units sold. */
export async function getTopSellingChapters(days = 30): Promise<ChapterSales[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return getChapterSalesInRange(since, new Date().toISOString());
}
