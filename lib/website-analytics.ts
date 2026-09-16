import { getSupabaseServerClient } from "@/lib/supabase";
import { chapters } from "@/lib/chapters";

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

const SOCIAL_HOST_RE = /instagram\.com|facebook\.com|fb\.com/i;
const WHATSAPP_HOST_RE = /wa\.me|whatsapp\.com/i;
const SEARCH_HOST_RE = /google\.|bing\.|duckduckgo\.|yahoo\./i;

/**
 * Classifies a session's traffic source from its first PageView. `ab`
 * (a launched-campaign landing param, see app/api/admin/ad-briefs/launch)
 * is the strongest signal — it's ours, not a guess — so it wins over
 * referrer/utm even if both are present. utm_source covers channels whose
 * referrer gets stripped in-app (WhatsApp in particular).
 */
function classifyTrafficSource(ev: Pick<RawEvent, "ad_brief_id" | "utm_source" | "referrer_host">): string {
  if (ev.ad_brief_id) return "Paid Ad (Meta)";
  const utm = ev.utm_source?.toLowerCase();
  if (utm === "whatsapp") return "WhatsApp";
  if (utm && ["meta", "facebook", "instagram", "fb", "ig"].includes(utm)) return "Meta (Organic/Social)";
  if (utm) return `Other (utm: ${ev.utm_source})`;
  const host = ev.referrer_host;
  if (!host) return "Direct";
  if (WHATSAPP_HOST_RE.test(host)) return "WhatsApp";
  if (SOCIAL_HOST_RE.test(host)) return "Meta (Organic/Social)";
  if (SEARCH_HOST_RE.test(host)) return "Organic Search";
  return "Other Referral";
}

export type WebsiteAnalytics = {
  sessions: number;
  pageviews: number;
  bounceRate: number; // 0-1
  newSessions: number;
  returningSessions: number;
  funnel: {
    sessions: number;
    viewedProduct: number;
    addedToCart: number;
    initiatedCheckout: number;
    purchased: number;
  };
  cartAbandonmentRate: number; // 0-1, of sessions that added to cart
  revenue: number;
  orders: number;
  averageOrderValue: number;
  revenuePerSession: number;
  topPages: { path: string; views: number }[];
  topViewedChapters: { slug: string; name: string; views: number }[];
  topAddedChapters: { name: string; adds: number }[];
  topReferrers: { host: string; sessions: number }[];
  trafficSources: { source: string; sessions: number }[];
  dailyTrend: { date: string; sessions: number; addToCarts: number; purchases: number }[];
};

function chapterName(slug: string | null) {
  if (!slug) return "(unknown)";
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Computes every number on /admin/analytics from the same tracking_events
 * log the ad/growth reports already trust — deliberately one source of
 * truth instead of a second pipeline that could drift from it. Revenue/AOV
 * comes from `orders` (the money is real there, not from a Purchase event
 * that could be missed by an ad blocker) but everything session-shaped
 * comes from tracking_events.
 */
export async function computeWebsiteAnalytics(sinceIso: string, untilIso: string): Promise<WebsiteAnalytics> {
  const supabase = getSupabaseServerClient();

  const [{ data: eventsData }, { data: priorSessionRows }, { data: orders }] = await Promise.all([
    supabase
      .from("tracking_events")
      .select("event_name, session_key, chapter_slug, value, path, referrer_host, ad_brief_id, utm_source, created_at")
      .gte("created_at", sinceIso)
      .lt("created_at", untilIso)
      .order("created_at", { ascending: true }),
    // Only need to know WHICH session keys existed before this window, to
    // classify new vs. returning — not their full event history.
    supabase.from("tracking_events").select("session_key").lt("created_at", sinceIso).not("session_key", "is", null),
    supabase.from("orders").select("total, created_at").gte("created_at", sinceIso).lt("created_at", untilIso).neq("status", "cancelled"),
  ]);

  const events = (eventsData ?? []) as RawEvent[];
  const priorSessionKeys = new Set((priorSessionRows ?? []).map((r) => r.session_key));

  const bySession = new Map<string, RawEvent[]>();
  for (const ev of events) {
    if (!ev.session_key) continue;
    const list = bySession.get(ev.session_key) ?? [];
    list.push(ev);
    bySession.set(ev.session_key, list);
  }

  const sessions = bySession.size;
  const pageviews = events.filter((e) => e.event_name === "PageView").length;

  let bounced = 0;
  let newSessions = 0;
  let returningSessions = 0;
  let viewedProductSessions = 0;
  let addedToCartSessions = 0;
  let initiatedCheckoutSessions = 0;
  let purchasedSessions = 0;
  let abandonedCartSessions = 0;

  for (const [sessionKey, sessionEvents] of bySession) {
    if (sessionEvents.length === 1 && sessionEvents[0].event_name === "PageView") bounced++;
    if (priorSessionKeys.has(sessionKey)) returningSessions++;
    else newSessions++;

    const names = new Set(sessionEvents.map((e) => e.event_name));
    if (names.has("ViewContent")) viewedProductSessions++;
    if (names.has("AddToCart")) addedToCartSessions++;
    if (names.has("InitiateCheckout")) initiatedCheckoutSessions++;
    if (names.has("Purchase")) purchasedSessions++;
    if (names.has("AddToCart") && !names.has("Purchase")) abandonedCartSessions++;
  }

  const sourceCounts = new Map<string, number>();
  for (const sessionEvents of bySession.values()) {
    // Events are already ordered ascending, so the first PageView in this
    // session's slice is genuinely its entry point.
    const firstPageView = sessionEvents.find((e) => e.event_name === "PageView");
    const source = classifyTrafficSource(firstPageView ?? { ad_brief_id: null, utm_source: null, referrer_host: null });
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const pageCounts = new Map<string, number>();
  const viewedChapterCounts = new Map<string, number>(); // keyed by chapter_slug
  const addedChapterCounts = new Map<string, number>();
  const referrerCounts = new Map<string, Set<string>>();
  const dailyMap = new Map<string, { sessions: Set<string>; addToCarts: number; purchases: number }>();

  for (const ev of events) {
    if (ev.event_name === "PageView" && ev.path) {
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
    const bucket = dailyMap.get(day) ?? { sessions: new Set<string>(), addToCarts: 0, purchases: 0 };
    if (ev.session_key) bucket.sessions.add(ev.session_key);
    if (ev.event_name === "AddToCart") bucket.addToCarts++;
    if (ev.event_name === "Purchase") bucket.purchases++;
    dailyMap.set(day, bucket);
  }

  const revenue = (orders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);
  const orderCount = (orders ?? []).length;

  return {
    sessions,
    pageviews,
    bounceRate: sessions > 0 ? bounced / sessions : 0,
    newSessions,
    returningSessions,
    funnel: {
      sessions,
      viewedProduct: viewedProductSessions,
      addedToCart: addedToCartSessions,
      initiatedCheckout: initiatedCheckoutSessions,
      purchased: purchasedSessions,
    },
    cartAbandonmentRate: addedToCartSessions > 0 ? abandonedCartSessions / addedToCartSessions : 0,
    revenue,
    orders: orderCount,
    averageOrderValue: orderCount > 0 ? revenue / orderCount : 0,
    revenuePerSession: sessions > 0 ? revenue / sessions : 0,
    topPages: [...pageCounts.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    topViewedChapters: [...viewedChapterCounts.entries()]
      .map(([slug, views]) => ({ slug, name: chapterName(slug), views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    topAddedChapters: [...addedChapterCounts.entries()]
      .map(([name, adds]) => ({ name, adds }))
      .sort((a, b) => b.adds - a.adds)
      .slice(0, 8),
    topReferrers: [...referrerCounts.entries()]
      .map(([host, set]) => ({ host, sessions: set.size }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8),
    trafficSources: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, sessions: count }))
      .sort((a, b) => b.sessions - a.sessions),
    dailyTrend: [...dailyMap.entries()]
      .map(([date, b]) => ({ date, sessions: b.sessions.size, addToCarts: b.addToCarts, purchases: b.purchases }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
