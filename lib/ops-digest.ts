import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { sendEmail, ORDER_NOTIFICATION_RECIPIENTS } from "@/lib/email";
import { chapters } from "@/lib/chapters";
import { getAccountInsightsDaily } from "@/lib/meta-insights";
import { computePlanFromDrivers, type BusinessPlanDrivers } from "@/lib/business-plan-calc";
import {
  addDays,
  buildDigest,
  istDay,
  istDayStartIso,
  renderDigestEmail,
  type Digest,
  type DigestInput,
  type MonthTarget,
  type RawEvent,
  type RawItem,
  type RawOrder,
  type RawReturn,
} from "@/lib/ops-digest-core";

export type { Digest } from "@/lib/ops-digest-core";

const BRAND = { name: "Moonglasses", siteUrl: "https://moon-glasses.store" };
const LOOKBACK_DAYS = 35;
const PAGE = 1000;
const ORDER_COLUMNS =
  "id, created_at, total, status, payment_status, payment_type, shipment_status, shiprocket_awb_code, delivery_pincode, delivery_city, delivered_at, rto_processed_at";

/** Supabase caps a select at 1000 rows; page through so a busy month isn't silently truncated. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** This month's target from the stored quarterly business plan, if one covers this month. */
async function loadMonthTarget(day: string): Promise<MonthTarget | null> {
  const supabase = getSupabaseServerClient();
  const monthStart = `${day.slice(0, 8)}01`;
  const { data } = await supabase
    .from("business_plans")
    .select("quarter_start, drivers")
    .lte("quarter_start", monthStart)
    .order("quarter_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.drivers) return null;
  const q = String(data.quarter_start);
  const idx = (Number(monthStart.slice(0, 4)) - Number(q.slice(0, 4))) * 12 + (Number(monthStart.slice(5, 7)) - Number(q.slice(5, 7)));
  if (idx < 0 || idx > 2) return null;
  try {
    const month = computePlanFromDrivers(data.drivers as BusinessPlanDrivers).months[idx];
    const revenue = Math.round(month.revenue);
    const orders = Math.round(month.orders);
    if (!revenue && !orders) return null;
    return { revenue: revenue || null, orders: orders || null, source: `Business plan (quarter from ${q})` };
  } catch (err) {
    console.error("Could not read business plan target", err);
    return null;
  }
}

/** Distinct PageView sessions per IST day, or null if the site has never logged one. */
async function loadSessions(sinceIso: string): Promise<Record<string, number> | null> {
  const supabase = getSupabaseServerClient();
  const rows = await fetchAll<{ session_key: string | null; created_at: string }>((a, b) =>
    supabase.from("tracking_events").select("session_key, created_at").eq("event_name", "PageView").gte("created_at", sinceIso).order("created_at").range(a, b)
  );
  if (rows.length === 0) {
    const { count } = await supabase.from("tracking_events").select("id", { count: "exact", head: true }).eq("event_name", "PageView");
    return count ? {} : null;
  }
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.session_key) continue;
    const d = istDay(r.created_at);
    if (!sets.has(d)) sets.set(d, new Set());
    sets.get(d)!.add(r.session_key);
  }
  return Object.fromEntries([...sets].map(([d, s]) => [d, s.size]));
}

/** Meta spend per day, or null when Meta ads aren't connected. */
async function loadAdSpend(yesterday: string): Promise<Record<string, number> | null> {
  const [token, account] = await Promise.all([getSetting("META_ACCESS_TOKEN"), getSetting("META_AD_ACCOUNT_ID")]);
  if (!token || !account) return null;
  const rows = await getAccountInsightsDaily(addDays(yesterday, -7), yesterday);
  return Object.fromEntries(rows.map((r) => [r.date, r.spend]));
}

/** Gathers every raw row the digest reads. Read-only: nothing is written or sent. */
export async function loadDigestInput(now = new Date()): Promise<DigestInput> {
  const supabase = getSupabaseServerClient();
  const today = istDay(now);
  const yesterday = addDays(today, -1);
  const sinceIso = istDayStartIso(addDays(today, -LOOKBACK_DAYS));

  const [orders, events, recentReturns, openReturns, inventory, thresholdSetting, sessionsByDay, adSpendByDay, target] = await Promise.all([
    fetchAll<RawOrder>((a, b) => supabase.from("orders").select(ORDER_COLUMNS).gte("created_at", sinceIso).order("created_at").range(a, b)),
    fetchAll<RawEvent>((a, b) => supabase.from("order_events").select("order_id, event_type, created_at").gte("created_at", sinceIso).order("created_at").range(a, b)),
    fetchAll<RawReturn>((a, b) => supabase.from("return_requests").select("id, order_id, status, created_at").gte("created_at", sinceIso).order("created_at").range(a, b)),
    fetchAll<RawReturn>((a, b) =>
      supabase.from("return_requests").select("id, order_id, status, created_at").in("status", ["requested", "received"]).order("created_at").range(a, b)
    ),
    supabase.from("inventory").select("chapter_slug, stock_on_hand"),
    getSetting("LOW_STOCK_THRESHOLD_UNITS"),
    loadSessions(istDayStartIso(addDays(yesterday, -7))).catch((err) => {
      console.error("Digest: sessions unavailable", err);
      return null;
    }),
    loadAdSpend(yesterday).catch((err) => {
      console.error("Digest: ad spend unavailable", err);
      return null;
    }),
    loadMonthTarget(yesterday),
  ]);

  // Orders referenced by open returns or recent events can predate the window.
  const known = new Set(orders.map((o) => o.id));
  const missing = [...new Set([...openReturns.map((r) => r.order_id), ...events.map((e) => e.order_id)])].filter((id) => !known.has(id));
  const extra: RawOrder[] = [];
  for (let i = 0; i < missing.length; i += 200) {
    const { data } = await supabase.from("orders").select(ORDER_COLUMNS).in("id", missing.slice(i, i + 200));
    extra.push(...((data ?? []) as RawOrder[]));
  }

  const ids = orders.map((o) => o.id);
  const items: RawItem[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from("order_items").select("order_id, chapter_slug, chapter_name, quantity, unit_price").in("order_id", ids.slice(i, i + 200));
    items.push(...((data ?? []) as RawItem[]));
  }

  const returns = [...new Map([...recentReturns, ...openReturns].map((r) => [r.id, r])).values()];

  return {
    now,
    brand: BRAND,
    // Older orders only feed the "needs you" rules (open returns, refund retries);
    // they fall outside every day-based window, so they can't skew the numbers.
    orders: [...orders, ...extra],
    items,
    events,
    returns,
    inventory: (inventory.data ?? []).map((i) => ({
      slug: i.chapter_slug,
      name: chapters.find((c) => c.slug === i.chapter_slug)?.name ?? i.chapter_slug,
      stock: i.stock_on_hand,
    })),
    lowStockThreshold: thresholdSetting ? Number(thresholdSetting) : 10,
    sessionsByDay,
    adSpendByDay,
    target,
  };
}

/** The digest for yesterday (IST), computed from live data. Read-only. */
export async function computeOpsDigest(now = new Date()): Promise<Digest> {
  return buildDigest(await loadDigestInput(now));
}

/** Renders the email without sending it — used by the admin preview. */
export async function previewOpsDigest(now = new Date()) {
  const digest = await computeOpsDigest(now);
  return { digest, ...renderDigestEmail(digest) };
}

/** Emails the digest to the existing recipients — the scheduled cron path. */
export async function runOpsDigest() {
  const digest = await computeOpsDigest();
  const { subject, html, text } = renderDigestEmail(digest);
  await Promise.all(ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, subject, html, undefined, { text })));
  return {
    day: digest.day,
    headline: digest.headline,
    needs: digest.needs.length,
    insights: digest.insights.length,
    recipients: ORDER_NOTIFICATION_RECIPIENTS.length,
  };
}
