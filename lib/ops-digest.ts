import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { sendEmail, ORDER_NOTIFICATION_RECIPIENTS } from "@/lib/email";
import { chapters } from "@/lib/chapters";

export type OpsDigest = {
  newOrders: number;
  revenue: number;
  refundsProcessed: number;
  rtoInitiated: number;
  newLeads: { id: string; name: string | null; source: string }[];
  lowStock: { name: string; stock: number }[];
  threshold: number;
};

/**
 * One snapshot of the last 24 hours — orders, revenue, refund/RTO activity,
 * new leads, and current low-stock chapters. Deliberately reads only what's
 * already logged elsewhere (no new tracking columns) so this can't drift
 * from what actually happened. Used both for the emailed digest and the
 * live summary card on /admin/orders.
 */
export async function computeOpsDigest(sinceIso?: string, untilIso?: string): Promise<OpsDigest> {
  const supabase = getSupabaseServerClient();
  const since = sinceIso ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const until = untilIso ?? new Date().toISOString();

  const [{ data: orders }, { data: events }, { data: leads }, { data: inventory }, thresholdSetting] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, total")
        .gte("created_at", since)
        .lt("created_at", until)
        .neq("status", "cancelled"),
      supabase
        .from("order_events")
        .select("event_type, order_id, detail")
        .gte("created_at", since)
        .lt("created_at", until)
        .in("event_type", ["rto_initiated", "rto_refunded", "return_refunded"]),
      supabase.from("leads").select("id, name, source").gte("created_at", since).lt("created_at", until).eq("status", "new"),
      supabase.from("inventory").select("chapter_slug, stock_on_hand"),
      getSetting("LOW_STOCK_THRESHOLD_UNITS"),
    ]);

  const threshold = thresholdSetting ? Number(thresholdSetting) : 10;
  const newOrders = orders ?? [];
  const revenue = newOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);

  const rtoInitiated = (events ?? []).filter((e) => e.event_type === "rto_initiated").length;
  const refundsProcessed = (events ?? []).filter(
    (e) => e.event_type === "rto_refunded" || e.event_type === "return_refunded"
  ).length;

  const newLeads = leads ?? [];

  const lowStock = (inventory ?? [])
    .filter((i) => i.stock_on_hand <= threshold)
    .map((i) => ({
      name: chapters.find((c) => c.slug === i.chapter_slug)?.name ?? i.chapter_slug,
      stock: i.stock_on_hand,
    }))
    .sort((a, b) => a.stock - b.stock);

  return {
    newOrders: newOrders.length,
    revenue,
    refundsProcessed,
    rtoInitiated,
    newLeads,
    lowStock,
    threshold,
  };
}

/** Emails the same snapshot to the team — the scheduled/manual-trigger path. */
export async function runOpsDigest() {
  const digest = await computeOpsDigest();
  const { newOrders, revenue, refundsProcessed, rtoInitiated, newLeads, lowStock, threshold } = digest;

  const html = `
    <div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <h2 style="font-size:18px;">Moonglasses — Daily Ops Digest</h2>
      <p style="font-size:13px;color:#666;">Last 24 hours</p>

      <h3 style="font-size:15px;margin-top:20px;">Orders</h3>
      <p style="font-size:14px;">${newOrders} new order${newOrders === 1 ? "" : "s"} — ₹${revenue.toLocaleString("en-IN")} revenue</p>

      <h3 style="font-size:15px;margin-top:20px;">Refunds &amp; RTO</h3>
      <p style="font-size:14px;">${refundsProcessed} refund${refundsProcessed === 1 ? "" : "s"} processed, ${rtoInitiated} RTO${rtoInitiated === 1 ? "" : "s"} initiated</p>

      <h3 style="font-size:15px;margin-top:20px;">New Leads</h3>
      <p style="font-size:14px;">
        ${newLeads.length === 0 ? "None" : newLeads.map((l) => `${l.name ?? "Unnamed"} (${l.source})`).join(", ")}
      </p>

      <h3 style="font-size:15px;margin-top:20px;">Low Stock (≤ ${threshold} units)</h3>
      <p style="font-size:14px;">
        ${lowStock.length === 0 ? "Nothing low right now" : lowStock.map((c) => `${c.name}: ${c.stock}`).join(", ")}
      </p>
    </div>
  `;

  await Promise.all(
    ORDER_NOTIFICATION_RECIPIENTS.map((to) =>
      sendEmail(to, `Daily Ops Digest — ${newOrders} orders, ₹${revenue.toLocaleString("en-IN")}`, html)
    )
  );

  return {
    newOrders,
    revenue,
    refundsProcessed,
    rtoInitiated,
    newLeads: newLeads.length,
    lowStockCount: lowStock.length,
  };
}
