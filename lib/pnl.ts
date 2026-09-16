import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getAccountInsights } from "@/lib/meta-insights";

export function currentMonthKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" });
}

/** Computes the full P&L for one calendar month (YYYY-MM), fresh from real orders/refunds/expenses every call. */
export async function computePnl(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const rangeStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const rangeEnd = new Date(Date.UTC(year, month, 1)).toISOString();

  const supabase = getSupabaseServerClient();
  const costSetting = await getSetting("COGS_PER_CAP_RUPEES");
  const costPerCap = costSetting ? Number(costSetting) : 250;

  let grossSales = 0;
  let discountsGiven = 0;
  let refunds = 0;
  let shippingCollected = 0;

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, subtotal, discount_amount, referral_discount_amount, loyalty_discount_amount, coupon_discount_amount, shipping_charge, refunded_amount, status"
    )
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEnd)
    .neq("status", "cancelled");

  for (const o of orders ?? []) {
    grossSales += o.subtotal ?? 0;
    discountsGiven +=
      (o.discount_amount ?? 0) +
      (o.referral_discount_amount ?? 0) +
      (o.loyalty_discount_amount ?? 0) +
      (o.coupon_discount_amount ?? 0);
    refunds += o.refunded_amount ?? 0;
    shippingCollected += o.shipping_charge ?? 0;
  }

  let unitsSold = 0;
  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length > 0) {
    const { data: items } = await supabase.from("order_items").select("quantity, order_id").in("order_id", orderIds);
    unitsSold = (items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0);
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, amount")
    .gte("expense_date", rangeStart.slice(0, 10))
    .lt("expense_date", rangeEnd.slice(0, 10));

  const byCategory = new Map<string, number>();
  for (const e of expenses ?? []) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amount ?? 0));
  }

  // Marketing and WhatsApp spend are pulled in live rather than requiring a
  // manual expense entry every month — Meta ad spend from the Insights API
  // (same source the ROAS report uses), WhatsApp from a per-message cost
  // setting times however many templates actually sent this month. Both are
  // zero/skipped rather than throwing if not configured, so P&L still works
  // before either is set up.
  const rangeEndInclusive = new Date(new Date(rangeEnd).getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const metaSpend = await getAccountInsights(rangeStart.slice(0, 10), rangeEndInclusive);
  if (metaSpend.spend > 0) {
    byCategory.set("Meta Ads (auto)", (byCategory.get("Meta Ads (auto)") ?? 0) + metaSpend.spend);
  }

  const whatsappCostSetting = await getSetting("MSG91_WHATSAPP_COST_PER_MESSAGE_RUPEES");
  const whatsappCostPerMessage = whatsappCostSetting ? Number(whatsappCostSetting) : 0.87;
  const { count: whatsappMessageCount } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", rangeStart)
    .lt("sent_at", rangeEnd);
  const whatsappSpend = Math.round((whatsappMessageCount ?? 0) * whatsappCostPerMessage);
  if (whatsappSpend > 0) {
    byCategory.set("WhatsApp Messaging (auto)", (byCategory.get("WhatsApp Messaging (auto)") ?? 0) + whatsappSpend);
  }

  const expensesByCategory = Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount }));
  const expensesTotal = expensesByCategory.reduce((sum, e) => sum + e.amount, 0);

  const netSales = grossSales - discountsGiven - refunds;
  const cogs = unitsSold * costPerCap;
  const grossProfit = netSales - cogs;
  const netProfit = grossProfit - expensesTotal;

  return {
    monthKey,
    costPerCap,
    grossSales,
    discountsGiven,
    refunds,
    shippingCollected,
    unitsSold,
    cogs,
    netSales,
    grossProfit,
    expensesByCategory,
    expensesTotal,
    netProfit,
  };
}
