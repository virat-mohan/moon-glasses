import { getSupabaseServerClient } from "@/lib/supabase";
import { chapters } from "@/lib/chapters";
import {
  buildFunnel,
  groupSource,
  isBounce,
  isTeamVisitor,
  splitVisits,
  type BiggestDrop,
  type FunnelStep,
  type SourceGroup,
} from "@/lib/analytics-helpers";

type RawEvent = {
  event_name: string;
  session_key: string | null;
  chapter_slug: string | null;
  value: number | null;
  path: string | null;
  referrer_host: string | null;
  ad_brief_id: string | null;
  utm_source: string | null;
  created_at: string;
};

export type SourceRow = {
  source: SourceGroup | "Not tracked";
  visitors: number;
  orders: number;
  revenue: number;
  /** orders ÷ visitors, 0-1 (0 when no visitors) */
  conversionRate: number;
  adClickOrders: number;
};

export type WebsiteAnalytics = {
  /** Visitors: distinct browsers/devices (session_key) in the window. Same as the old "sessions". */
  visitors: number;
  /** Visits: visitor activity split by the 30-minute inactivity rule. */
  visits: number;
  /** Kept for existing consumers (growth recommendations): same number as visitors. */
  sessions: number;
  pageviews: number;
  bounceRate: number; // 0-1, of visitors
  newVisitors: number;
  returningVisitors: number;
  funnel: {
    // legacy keys (still used by lib/growth-recommendations.ts)
    sessions: number;
    viewedProduct: number;
    addedToCart: number;
    initiatedCheckout: number;
    purchased: number;
  };
  funnelSteps: FunnelStep[];
  biggestDrop: BiggestDrop;
  cartAbandonmentRate: number; // 0-1, of visitors that added to cart
  revenue: number;
  orders: number;
  averageOrderValue: number;
  revenuePerVisitor: number;
  conversionRate: number; // orders / visitors, 0-1
  /** Share of orders that did not come from an ad click, 0-1; null when there are no orders. */
  nonAdOrderShare: number | null;
  adClickOrders: number;
  teamVisitorsExcluded: number;
  sources: SourceRow[];
  topPages: { path: string; views: number }[];
  topViewedChapters: { slug: string; name: string; views: number }[];
  topAddedChapters: { name: string; adds: number }[];
  topReferrers: { host: string; sessions: number }[];
  /** Legacy shape: visitors per source group. */
  trafficSources: { source: string; sessions: number }[];
  dailyTrend: { date: string; visitors: number; addToCarts: number; purchases: number }[];
};

function chapterName(slug: string | null) {
  if (!slug) return "(unknown)";
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}


const PAGE = 1000;

/** Supabase returns at most 1000 rows per request, so page through until a short page. */
async function fetchAllEvents(sinceIso: string, untilIso: string): Promise<RawEvent[]> {
  const supabase = getSupabaseServerClient();
  const out: RawEvent[] = [];
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await supabase
      .from("tracking_events")
      .select("event_name, session_key, chapter_slug, value, path, referrer_host, ad_brief_id, utm_source, created_at")
      .gte("created_at", sinceIso)
      .lt("created_at", untilIso)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as RawEvent[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Which of these visitors were already seen before the window (returning). Chunked to keep URLs short. */
async function priorVisitors(keys: string[], sinceIso: string): Promise<Set<string>> {
  const supabase = getSupabaseServerClient();
  const seen = new Set<string>();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const { data } = await supabase
      .from("tracking_events")
      .select("session_key")
      .in("session_key", chunk)
      .lt("created_at", sinceIso)
      .limit(PAGE);
    for (const r of data ?? []) if (r.session_key) seen.add(r.session_key);
  }
  return seen;
}

/**
 * Computes every number on /admin/analytics from the same tracking_events
 * log the ad/growth reports already trust, one source of truth instead of a
 * second pipeline that could drift. Revenue and order counts come from
 * `orders` (real money; test and cancelled orders left out). Everything about
 * visitors comes from tracking_events. Team traffic (anyone who opened an
 * /admin page) is left out, and test orders never write a Purchase event.
 */
export async function computeWebsiteAnalytics(sinceIso: string, untilIso: string): Promise<WebsiteAnalytics> {
  const supabase = getSupabaseServerClient();

  const allEvents = await fetchAllEvents(sinceIso, untilIso);

  const orderQuery = (cols: string) =>
    supabase.from("orders").select(cols).eq("is_test", false).gte("created_at", sinceIso).lt("created_at", untilIso).neq("status", "cancelled");
  type OrderLite = { total: number | null; order_source?: string | null; attributed_ad_brief_id?: string | null };
  let orderRows: OrderLite[] = [];
  {
    const full = await orderQuery("total, order_source, attributed_ad_brief_id");
    if (full.error) {
      const base = await orderQuery("total");
      orderRows = (base.data ?? []) as unknown as OrderLite[];
    } else {
      orderRows = (full.data ?? []) as unknown as OrderLite[];
    }
  }

  // Team visitors: any browser that opened an /admin page in the window.
  const teamKeys = new Set<string>();
  {
    const pathsByKey = new Map<string, string[]>();
    for (const ev of allEvents) {
      if (!ev.session_key || !ev.path) continue;
      const list = pathsByKey.get(ev.session_key) ?? [];
      list.push(ev.path);
      pathsByKey.set(ev.session_key, list);
    }
    for (const [k, paths] of pathsByKey) if (isTeamVisitor(paths)) teamKeys.add(k);
  }

  const events = allEvents.filter((e) => !e.session_key || !teamKeys.has(e.session_key));

  // wa-<orderId> keys are synthetic: a WhatsApp order's Purchase event, not a browser visit.
  const isSynthetic = (k: string | null) => !!k && k.startsWith("wa-");

  const byVisitor = new Map<string, RawEvent[]>();
  for (const ev of events) {
    if (!ev.session_key || isSynthetic(ev.session_key)) continue;
    const list = byVisitor.get(ev.session_key) ?? [];
    list.push(ev);
    byVisitor.set(ev.session_key, list);
  }

  const visitors = byVisitor.size;
  const prior = await priorVisitors([...byVisitor.keys()], sinceIso);
  const pageviews = events.filter((e) => e.event_name === "PageView" && !isSynthetic(e.session_key)).length;

  let visits = 0;
  let bounced = 0;
  let newVisitors = 0;
  let returningVisitors = 0;
  let viewedProduct = 0;
  let addedToCart = 0;
  let startedCheckout = 0;
  let paid = 0;
  let abandonedCart = 0;

  const sourceOfVisitor = new Map<string, { group: SourceGroup; adClick: boolean }>();
  const sourceVisitors = new Map<SourceGroup, number>();

  for (const [key, evs] of byVisitor) {
    visits += splitVisits(evs.map((e) => new Date(e.created_at).getTime()));
    if (prior.has(key)) returningVisitors++;
    else newVisitors++;

    const names = new Set(evs.map((e) => e.event_name));
    const pv = evs.filter((e) => e.event_name === "PageView").length;
    if (isBounce({ pageViews: pv, addedToCart: names.has("AddToCart"), startedCheckout: names.has("InitiateCheckout"), purchased: names.has("Purchase") })) bounced++;
    if (names.has("ViewContent")) viewedProduct++;
    if (names.has("AddToCart")) addedToCart++;
    if (names.has("InitiateCheckout")) startedCheckout++;
    if (names.has("Purchase")) paid++;
    if (names.has("AddToCart") && !names.has("Purchase")) abandonedCart++;

    // Entry point = first PageView, but an ad id on any event of the visitor still marks an ad click.
    const first = evs.find((e) => e.event_name === "PageView") ?? evs[0];
    const adClick = evs.some((e) => !!e.ad_brief_id);
    const g = groupSource({ ad_brief_id: adClick ? "ad" : null, utm_source: first.utm_source ?? evs.find((e) => e.utm_source)?.utm_source, referrer_host: first.referrer_host });
    sourceOfVisitor.set(key, g);
    sourceVisitors.set(g.group, (sourceVisitors.get(g.group) ?? 0) + 1);
  }

  // Orders and revenue per source from Purchase events.
  const sourceOrders = new Map<string, { orders: number; revenue: number; ad: number }>();
  let eventOrders = 0;
  let eventRevenue = 0;
  for (const ev of events) {
    if (ev.event_name !== "Purchase") continue;
    let group: SourceGroup | "Not tracked";
    let ad = false;
    if (isSynthetic(ev.session_key)) group = "WhatsApp";
    else if (ev.session_key && sourceOfVisitor.has(ev.session_key)) {
      const g = sourceOfVisitor.get(ev.session_key)!;
      group = g.group;
      ad = g.adClick;
    } else group = "Not tracked";
    const row = sourceOrders.get(group) ?? { orders: 0, revenue: 0, ad: 0 };
    row.orders++;
    row.revenue += ev.value ?? 0;
    if (ad) row.ad++;
    sourceOrders.set(group, row);
    eventOrders++;
    eventRevenue += ev.value ?? 0;
  }

  const revenue = orderRows.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const orderCount = orderRows.length;
  // Orders the tracking log missed (ad blocker, older orders) are shown honestly as "Not tracked".
  if (orderCount > eventOrders) {
    const row = sourceOrders.get("Not tracked") ?? { orders: 0, revenue: 0, ad: 0 };
    row.orders += orderCount - eventOrders;
    row.revenue += Math.max(0, revenue - eventRevenue);
    sourceOrders.set("Not tracked", row);
  }
  const attributedAd = orderRows.filter((o) => !!o.attributed_ad_brief_id).length;
  const sessionAd = [...sourceOrders.values()].reduce((s, r) => s + r.ad, 0);
  const adClickOrders = Math.min(orderCount, Math.max(attributedAd, sessionAd));

  const sources: SourceRow[] = ([...sourceOrders.keys(), ...sourceVisitors.keys()] as (SourceGroup | "Not tracked")[])
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((source) => {
      const v = source === "Not tracked" ? 0 : sourceVisitors.get(source) ?? 0;
      const o = sourceOrders.get(source) ?? { orders: 0, revenue: 0, ad: 0 };
      return { source, visitors: v, orders: o.orders, revenue: o.revenue, conversionRate: v > 0 ? o.orders / v : 0, adClickOrders: o.ad };
    })
    .sort((a, b) => b.visitors - a.visitors || b.orders - a.orders);

  const pageCounts = new Map<string, number>();
  const viewedChapterCounts = new Map<string, number>();
  const addedChapterCounts = new Map<string, number>();
  const referrerCounts = new Map<string, Set<string>>();
  const dailyMap = new Map<string, { visitors: Set<string>; addToCarts: number; purchases: number }>();

  for (const ev of events) {
    if (ev.event_name === "PageView" && ev.path && !isSynthetic(ev.session_key)) {
      pageCounts.set(ev.path, (pageCounts.get(ev.path) ?? 0) + 1);
    }
    if (ev.event_name === "ViewContent" && ev.chapter_slug) {
      viewedChapterCounts.set(ev.chapter_slug, (viewedChapterCounts.get(ev.chapter_slug) ?? 0) + 1);
    }
    if (ev.event_name === "AddToCart") {
      const name = chapterName(ev.chapter_slug);
      addedChapterCounts.set(name, (addedChapterCounts.get(name) ?? 0) + 1);
    }
    if (ev.event_name === "PageView" && ev.referrer_host) {
      const set = referrerCounts.get(ev.referrer_host) ?? new Set<string>();
      if (ev.session_key) set.add(ev.session_key);
      referrerCounts.set(ev.referrer_host, set);
    }
    const day = dayKey(ev.created_at);
    const bucket = dailyMap.get(day) ?? { visitors: new Set<string>(), addToCarts: 0, purchases: 0 };
    if (ev.session_key && !isSynthetic(ev.session_key)) bucket.visitors.add(ev.session_key);
    if (ev.event_name === "AddToCart") bucket.addToCarts++;
    if (ev.event_name === "Purchase") bucket.purchases++;
    dailyMap.set(day, bucket);
  }

  const { steps, biggestDrop } = buildFunnel({ visitors, viewedProduct, addedToCart, startedCheckout, paid });

  return {
    visitors,
    visits,
    sessions: visitors,
    pageviews,
    bounceRate: visitors > 0 ? bounced / visitors : 0,
    newVisitors,
    returningVisitors,
    funnel: { sessions: visitors, viewedProduct, addedToCart, initiatedCheckout: startedCheckout, purchased: paid },
    funnelSteps: steps,
    biggestDrop,
    cartAbandonmentRate: addedToCart > 0 ? abandonedCart / addedToCart : 0,
    revenue,
    orders: orderCount,
    averageOrderValue: orderCount > 0 ? revenue / orderCount : 0,
    revenuePerVisitor: visitors > 0 ? revenue / visitors : 0,
    conversionRate: visitors > 0 ? orderCount / visitors : 0,
    nonAdOrderShare: orderCount > 0 ? (orderCount - adClickOrders) / orderCount : null,
    adClickOrders,
    teamVisitorsExcluded: teamKeys.size,
    sources,
    topPages: [...pageCounts.entries()].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 10),
    topViewedChapters: [...viewedChapterCounts.entries()]
      .map(([slug, views]) => ({ slug, name: chapterName(slug), views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    topAddedChapters: [...addedChapterCounts.entries()].map(([name, adds]) => ({ name, adds })).sort((a, b) => b.adds - a.adds).slice(0, 8),
    topReferrers: [...referrerCounts.entries()].map(([host, set]) => ({ host, sessions: set.size })).sort((a, b) => b.sessions - a.sessions).slice(0, 8),
    trafficSources: [...sourceVisitors.entries()].map(([source, n]) => ({ source, sessions: n })).sort((a, b) => b.sessions - a.sessions),
    dailyTrend: [...dailyMap.entries()]
      .map(([date, b]) => ({ date, visitors: b.visitors.size, addToCarts: b.addToCarts, purchases: b.purchases }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
