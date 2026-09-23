import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getAllChapters } from "@/lib/chapters-dynamic";
import type { BusinessPlanDrivers } from "@/lib/business-plan-calc";

export { computePlanFromDrivers, DRIVER_FIELDS, type BusinessPlanDrivers, type MonthPlan, type ComputedPlan } from "@/lib/business-plan-calc";

// ============================================================
// Forward-looking, driver-based quarterly benchmark P&L — distinct from
// lib/pnl.ts (which reports what actually happened). This module lets
// Claude research the market and propose DRIVERS (not totals), which a
// human then edits; computePlanFromDrivers is the single place money is
// ever calculated from those drivers, called identically at generation
// time and every time a driver is edited, so the two can never drift.
//
// A future variance report (forecast vs. lib/pnl.ts actuals for the same
// months) is a natural extension of this table — quarter_start already
// keys a plan to real calendar months for exactly that purpose — but is
// not built yet.
// ============================================================

// ---- Deterministic grounding (fetched BEFORE any model call) ----

async function fetchCatalogSummary() {
  const chapters = await getAllChapters();
  const prices = chapters.map((c) => c.price).filter((p): p is number => typeof p === "number" && p > 0);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  return { productCount: chapters.length, minPrice: min, maxPrice: max, avgPrice: avg };
}

/** Real trailing-90-day performance, if any — a live store's own history beats a researched benchmark. */
async function fetchActualBaseline() {
  const supabase = getSupabaseServerClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("subtotal, payment_type, is_post_barter, rto_processed_at, created_at")
    .gte("created_at", since)
    .neq("status", "cancelled");

  const rows = orders ?? [];
  if (rows.length < 10) {
    return { hasData: false as const, orderCount: rows.length };
  }

  const codRows = rows.filter((o) => o.payment_type === "cod_advance");
  const barterRows = rows.filter((o) => o.is_post_barter);
  const avgSubtotal = Math.round(rows.reduce((s, o) => s + (o.subtotal ?? 0), 0) / rows.length);
  const codShare = rows.length ? Math.round((codRows.length / rows.length) * 1000) / 10 : 0;
  const barterShare = rows.length ? Math.round((barterRows.length / rows.length) * 1000) / 10 : 0;
  const rtoOfCod = codRows.length
    ? Math.round((codRows.filter((o) => o.rto_processed_at).length / codRows.length) * 1000) / 10
    : 0;

  return {
    hasData: true as const,
    orderCount: rows.length,
    ordersPerMonth: Math.round((rows.length / 90) * 30),
    avgOrderValueRupees: avgSubtotal,
    codSharePctOfAllOrders: codShare,
    postBarterSharePct: barterShare,
    rtoRatePctOfCod: rtoOfCod,
  };
}

function extractDriversFromToolUse(content: { type: string; name?: string; input?: unknown }[]): BusinessPlanDrivers {
  const toolUse = content.find((b) => b.type === "tool_use" && b.name === "submit_business_plan_drivers");
  if (!toolUse) {
    throw new Error("Claude did not call submit_business_plan_drivers — no structured drivers returned");
  }
  return toolUse.input as BusinessPlanDrivers;
}

const SUBMIT_TOOL = {
  name: "submit_business_plan_drivers",
  description:
    "Submit the final set of benchmark P&L drivers for the next 3 months, each with a one-paragraph cited rationale. Call this exactly once, after any research, as your final action.",
  input_schema: {
    type: "object" as const,
    properties: {
      months: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "object", properties: { orders: { type: "number" } }, required: ["orders"] },
        description: "Orders for month 1, 2, 3 of the quarter — a realistic ramp, not a flat number.",
      },
      aovRupees: { type: "number" },
      cogsPct: { type: "number" },
      cacPct: { type: "number" },
      adminTechPct: { type: "number" },
      codSharePct: { type: "number" },
      paymentGatewayFeePct: { type: "number" },
      codHandlingFeePct: { type: "number" },
      rtoRatePct: { type: "number" },
      rtoCostPerOrderRupees: { type: "number" },
      shippingCostPerOrderRupees: { type: "number" },
      packagingCostPerOrderRupees: { type: "number" },
      fixedMonthlyCostRupees: { type: "number" },
      postBarterSharePct: { type: "number" },
      rationale: {
        type: "object",
        properties: {
          ordersRamp: { type: "string" },
          aov: { type: "string" },
          cogs: { type: "string" },
          cac: { type: "string" },
          adminTech: { type: "string" },
          codShare: { type: "string" },
          paymentGatewayFee: { type: "string" },
          codHandlingFee: { type: "string" },
          rtoRate: { type: "string" },
          rtoCost: { type: "string" },
          shippingCost: { type: "string" },
          packagingCost: { type: "string" },
          postBarter: { type: "string" },
        },
        required: [
          "ordersRamp",
          "aov",
          "cogs",
          "cac",
          "adminTech",
          "codShare",
          "paymentGatewayFee",
          "codHandlingFee",
          "rtoRate",
          "rtoCost",
          "shippingCost",
          "packagingCost",
          "postBarter",
        ],
      },
    },
    required: [
      "months",
      "aovRupees",
      "cogsPct",
      "cacPct",
      "adminTechPct",
      "codSharePct",
      "paymentGatewayFeePct",
      "codHandlingFeePct",
      "rtoRatePct",
      "rtoCostPerOrderRupees",
      "shippingCostPerOrderRupees",
      "packagingCostPerOrderRupees",
      "fixedMonthlyCostRupees",
      "postBarterSharePct",
      "rationale",
    ],
  },
};

export async function generateBusinessPlanDrivers(quarterStart: string): Promise<BusinessPlanDrivers> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it in /admin/settings first");
  }

  // 1. Deterministic grounding — fetched before any model call, never guessed at.
  const [catalog, baseline] = await Promise.all([fetchCatalogSummary(), fetchActualBaseline()]);

  const baselineBlock = baseline.hasData
    ? `ACTUAL RECENT PERFORMANCE (trailing 90 days, ${baseline.orderCount} real orders — use this as your grounded starting point, and only deviate from it where your research gives a specific reason, e.g. a planned ramp):
- Orders/month (recent run-rate): ${baseline.ordersPerMonth}
- Average order value: ₹${baseline.avgOrderValueRupees}
- COD share of all orders: ${baseline.codSharePctOfAllOrders}%
- "Pay With A Post" share of all orders: ${baseline.postBarterSharePct}%
- RTO rate of COD orders: ${baseline.rtoRatePctOfCod}%`
    : `No meaningful order history yet (${baseline.orderCount} orders in the last 90 days) — treat this as a new/early-stage store and rely on researched category benchmarks instead of an internal baseline.`;

  const prompt = `You are building a 3-month benchmark P&L forecast for MOON GLASSES, a direct-to-consumer sunglasses brand selling in India (₹1,499 price point, sold via its own website — moon-glasses.store — not a marketplace). The quarter being forecast starts ${quarterStart}.

OUR PRODUCT CATALOG (real, from our own database — ground truth, not for you to estimate):
- ${catalog.productCount} SKUs, priced ₹${catalog.minPrice}–₹${catalog.maxPrice} (average ₹${catalog.avgPrice})

${baselineBlock}

Use web search to ground the drivers below in real, current data: Indian D2C eyewear/fashion category sizing and growth rates, competitor pricing and CAC benchmarks, India COD-vs-prepaid order share and COD RTO rate benchmarks for fashion/apparel e-commerce, typical Indian payment gateway fees (Razorpay/Paytm-type), typical courier/shipping cost per order for a ~150-250g package within India, and typical D2C packaging cost per order. Cite what you find in each rationale. If you can't find solid data for a specific driver, say so explicitly in that driver's rationale and state you're using a general industry benchmark instead — never present a guess as if it were researched.

One additional real mechanic unique to this store: "Pay With A Post" — instead of paying, a shopper with a real Instagram following gets the product for free in exchange for posting about it and driving referral orders via their own coupon code. Estimate what share of total orders will realistically go through this mechanic given the baseline above (or, if no baseline, a conservative estimate for a new program), and note its cost is the full retail value of the product given away (already handled in our own cost model — you're only responsible for estimating the SHARE of orders, in postBarterSharePct).

Then call submit_business_plan_drivers exactly once with your final drivers and rationale. Do not output final rupee totals or profit numbers yourself — only the drivers. A human will edit these and a deterministic formula computes the P&L from them.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        // Tool type as of today (2026-09-23) per Anthropic's docs — verify
        // this hasn't changed before relying on it in production.
        { type: "web_search_20250305", name: "web_search", max_uses: 6 },
        SUBMIT_TOOL,
      ],
      tool_choice: { type: "auto" },
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  return extractDriversFromToolUse(data.content ?? []);
}

// ---- Storage ----

export async function getBusinessPlan(quarterStart: string): Promise<BusinessPlanDrivers | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("business_plans")
    .select("drivers")
    .eq("quarter_start", quarterStart)
    .maybeSingle();
  return (data?.drivers as BusinessPlanDrivers) ?? null;
}

export async function saveBusinessPlan(quarterStart: string, drivers: BusinessPlanDrivers) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("business_plans")
    .upsert({ quarter_start: quarterStart, drivers, updated_at: new Date().toISOString() }, { onConflict: "quarter_start" });
  if (error) throw error;
}
