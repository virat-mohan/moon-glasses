import { getSupabaseServerClient } from "@/lib/supabase";
import { getAccountInsights, getAccountInsightsDaily } from "@/lib/meta-insights";

export type DailyAdRow = {
  date: string;
  adSpend: number;
  clicks: number;
  impressions: number;
  revenue: number;
  orders: number;
  roas: number | null;
};

/**
 * Day-by-day ad spend/revenue for the Growth Reports page, plus a totals
 * row. The totals ROAS is total revenue / total spend across the whole
 * range — never an average of each day's individual ROAS, which would
 * over-weight low-spend days and give a misleading blended number.
 */
export async function computeDailyAdReport(sinceIso: string, untilIso: string) {
  const supabase = getSupabaseServerClient();
  const sinceDate = sinceIso.slice(0, 10);
  // Meta's time_range `until` is inclusive of that day — back it off by a
  // day from our exclusive-upper-bound convention so it lines up with the
  // orders query below instead of pulling in one extra day of ad spend.
  const untilDate = new Date(new Date(untilIso).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [dailyInsights, { data: orders }] = await Promise.all([
    getAccountInsightsDaily(sinceDate, untilDate),
    supabase.from("orders").select("total, created_at").gte("created_at", sinceIso).lt("created_at", untilIso).neq("status", "cancelled"),
  ]);

  const revenueByDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders ?? []) {
    const day = o.created_at.slice(0, 10);
    const row = revenueByDay.get(day) ?? { revenue: 0, orders: 0 };
    row.revenue += o.total ?? 0;
    row.orders += 1;
    revenueByDay.set(day, row);
  }

  const allDates = new Set([...dailyInsights.map((d) => d.date), ...revenueByDay.keys()]);
  const days: DailyAdRow[] = [...allDates]
    .sort()
    .map((date) => {
      const insight = dailyInsights.find((d) => d.date === date);
      const rev = revenueByDay.get(date);
      const adSpend = insight?.spend ?? 0;
      const revenue = rev?.revenue ?? 0;
      return {
        date,
        adSpend,
        clicks: insight?.clicks ?? 0,
        impressions: insight?.impressions ?? 0,
        revenue,
        orders: rev?.orders ?? 0,
        roas: adSpend > 0 ? Number((revenue / adSpend).toFixed(2)) : null,
      };
    });

  const totalAdSpend = days.reduce((sum, d) => sum + d.adSpend, 0);
  const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
  const totals: DailyAdRow = {
    date: "Total",
    adSpend: totalAdSpend,
    clicks: days.reduce((sum, d) => sum + d.clicks, 0),
    impressions: days.reduce((sum, d) => sum + d.impressions, 0),
    revenue: totalRevenue,
    orders: days.reduce((sum, d) => sum + d.orders, 0),
    roas: totalAdSpend > 0 ? Number((totalRevenue / totalAdSpend).toFixed(2)) : null,
  };

  return { days, totals };
}

/**
 * Revenue truly attributable to one launched campaign — orders whose
 * checkout carried that campaign's `ab` (ad brief id) param, see
 * lib/client-tracking.ts. Distinct from the blended account-wide
 * weekly_reports.roas (all revenue / all spend, ads or not) — this is
 * what makes a per-campaign scale/pause decision trustworthy rather than
 * a guess from click volume.
 */
export async function getAttributedRevenue(adBriefId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("total")
    .eq("attributed_ad_brief_id", adBriefId)
    .gte("created_at", since);
  const orders = data ?? [];
  return { revenue: orders.reduce((sum, o) => sum + (o.total ?? 0), 0), orderCount: orders.length };
}

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  adSpend: number;
  clicks: number;
  impressions: number;
  pageViews: number;
  addToCarts: number;
  checkoutsStarted: number;
  ordersCount: number;
  revenue: number;
  abandonedCarts: number;
  roas: number | null;
};

/** Generates and stores a report for the 7-day window ending `weekEnd` (defaults to now). */
export async function generateWeeklyReport(weekEnd: Date = new Date()): Promise<WeeklyReport> {
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sinceISO = weekStart.toISOString();
  const untilISO = weekEnd.toISOString();

  const supabase = getSupabaseServerClient();

  const [{ data: events }, { data: orders }, { data: abandoned }, insights] = await Promise.all([
    supabase
      .from("tracking_events")
      .select("event_name")
      .gte("created_at", sinceISO)
      .lt("created_at", untilISO),
    supabase.from("orders").select("total").gte("created_at", sinceISO).lt("created_at", untilISO),
    supabase
      .from("cart_sessions")
      .select("id")
      .eq("status", "abandoned")
      .gte("last_activity_at", sinceISO)
      .lt("last_activity_at", untilISO),
    getAccountInsights(sinceISO.slice(0, 10), untilISO.slice(0, 10)),
  ]);

  const countEvent = (name: string) => (events ?? []).filter((e) => e.event_name === name).length;
  const revenue = (orders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);
  const roas = insights.spend > 0 ? Number((revenue / insights.spend).toFixed(2)) : null;

  const report: WeeklyReport = {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    adSpend: insights.spend,
    clicks: insights.clicks,
    impressions: insights.impressions,
    pageViews: countEvent("PageView"),
    addToCarts: countEvent("AddToCart"),
    checkoutsStarted: countEvent("InitiateCheckout"),
    ordersCount: orders?.length ?? 0,
    revenue,
    abandonedCarts: abandoned?.length ?? 0,
    roas,
  };

  await supabase.from("weekly_reports").insert({
    week_start: report.weekStart,
    week_end: report.weekEnd,
    ad_spend: report.adSpend,
    clicks: report.clicks,
    impressions: report.impressions,
    page_views: report.pageViews,
    add_to_carts: report.addToCarts,
    checkouts_started: report.checkoutsStarted,
    orders_count: report.ordersCount,
    revenue: report.revenue,
    abandoned_carts: report.abandonedCarts,
    roas: report.roas,
  });

  return report;
}
