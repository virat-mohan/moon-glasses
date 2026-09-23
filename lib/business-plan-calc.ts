// Pure, dependency-free math — safe to import from both server API routes
// AND the client admin page (for instant live-recompute on every edit,
// with no round trip). Never import anything server-only (supabase,
// settings) into this file.

export type BusinessPlanDrivers = {
  /** A realistic 3-month ramp, not flat. */
  months: [{ orders: number }, { orders: number }, { orders: number }];
  aovRupees: number;
  cogsPct: number;
  cacPct: number;
  adminTechPct: number;
  /** % of non-barter (cash) orders that are COD; the rest are prepaid. */
  codSharePct: number;
  /** Charged only on the prepaid share of cash orders. */
  paymentGatewayFeePct: number;
  /** Charged only on the COD share of cash orders. */
  codHandlingFeePct: number;
  /** % of COD orders that RTO — COD RTO is far higher than prepaid. */
  rtoRatePct: number;
  rtoCostPerOrderRupees: number;
  shippingCostPerOrderRupees: number;
  packagingCostPerOrderRupees: number;
  fixedMonthlyCostRupees: number;
  /** Share of ALL orders fulfilled via "Pay With A Post" (see lib/post-barter.ts) instead of cash. */
  postBarterSharePct: number;
  /** One short cited paragraph per driver group — never dressed up as researched when it wasn't. */
  rationale: {
    ordersRamp: string;
    aov: string;
    cogs: string;
    cac: string;
    adminTech: string;
    codShare: string;
    paymentGatewayFee: string;
    codHandlingFee: string;
    rtoRate: string;
    rtoCost: string;
    shippingCost: string;
    packagingCost: string;
    postBarter: string;
  };
};

/** Metadata driving the generic admin UI — one row per driver. */
export const DRIVER_FIELDS: {
  key: keyof Omit<BusinessPlanDrivers, "months" | "rationale">;
  label: string;
  unit: "%" | "₹";
  rationaleKey: keyof BusinessPlanDrivers["rationale"];
}[] = [
  { key: "aovRupees", label: "Average Order Value", unit: "₹", rationaleKey: "aov" },
  { key: "cogsPct", label: "Cost of Goods (% of revenue)", unit: "%", rationaleKey: "cogs" },
  { key: "cacPct", label: "Paid Marketing / CAC (% of revenue)", unit: "%", rationaleKey: "cac" },
  { key: "adminTechPct", label: "Admin & Tech Overhead (% of revenue)", unit: "%", rationaleKey: "adminTech" },
  { key: "codSharePct", label: "COD Share Of Cash Orders", unit: "%", rationaleKey: "codShare" },
  { key: "paymentGatewayFeePct", label: "Payment Gateway Fee (on prepaid)", unit: "%", rationaleKey: "paymentGatewayFee" },
  { key: "codHandlingFeePct", label: "COD Handling Fee (on COD)", unit: "%", rationaleKey: "codHandlingFee" },
  { key: "rtoRatePct", label: "RTO Rate (of COD orders)", unit: "%", rationaleKey: "rtoRate" },
  { key: "rtoCostPerOrderRupees", label: "RTO Cost Per Returned Order", unit: "₹", rationaleKey: "rtoCost" },
  { key: "shippingCostPerOrderRupees", label: "Shipping Cost Per Order", unit: "₹", rationaleKey: "shippingCost" },
  { key: "packagingCostPerOrderRupees", label: "Packaging Cost Per Order", unit: "₹", rationaleKey: "packagingCost" },
  { key: "fixedMonthlyCostRupees", label: "Fixed Monthly Platform/Tooling Cost", unit: "₹", rationaleKey: "postBarter" },
  { key: "postBarterSharePct", label: "Pay With A Post Share Of Orders", unit: "%", rationaleKey: "postBarter" },
];

// This store runs its own direct-to-consumer storefront — no marketplace or
// SaaS platform takes a revenue share off orders, so this is genuinely zero
// rather than something to research. A future brand on shared platform
// infrastructure would set this from that brand's real fee schedule instead.
const PLATFORM_FEE_PCT = 0;

export type MonthPlan = {
  orders: number;
  barterOrders: number;
  cashOrders: number;
  codOrders: number;
  prepaidOrders: number;
  rtoOrders: number;
  revenue: number;
  cogs: number;
  cac: number;
  adminTech: number;
  paymentGatewayFees: number;
  codHandlingFees: number;
  rtoCost: number;
  shippingCost: number;
  packagingCost: number;
  postBarterCost: number;
  fixedCost: number;
  platformFee: number;
  totalCosts: number;
  profit: number;
};

export type ComputedPlan = {
  months: [MonthPlan, MonthPlan, MonthPlan];
  totals: MonthPlan;
};

function computeMonth(orders: number, d: BusinessPlanDrivers): MonthPlan {
  const barterOrders = orders * (d.postBarterSharePct / 100);
  const cashOrders = orders - barterOrders;
  const codOrders = cashOrders * (d.codSharePct / 100);
  const prepaidOrders = cashOrders - codOrders;
  const rtoOrders = codOrders * (d.rtoRatePct / 100);

  // Every order counts as revenue at full AOV, barter included — this
  // mirrors lib/pnl.ts's real treatment of Pay With A Post orders (full
  // retail value on the top line, offset by a cost line below) so a future
  // forecast-vs-actual diff compares like with like.
  const revenue = orders * d.aovRupees;

  const cogs = revenue * (d.cogsPct / 100);
  const cac = revenue * (d.cacPct / 100);
  const adminTech = revenue * (d.adminTechPct / 100);
  const paymentGatewayFees = prepaidOrders * d.aovRupees * (d.paymentGatewayFeePct / 100);
  const codHandlingFees = codOrders * d.aovRupees * (d.codHandlingFeePct / 100);
  const rtoCost = rtoOrders * d.rtoCostPerOrderRupees;
  const shippingCost = orders * d.shippingCostPerOrderRupees;
  const packagingCost = orders * d.packagingCostPerOrderRupees;
  // The product given away in exchange for the post, at full retail value —
  // its own driver/formula per the barter mechanic's real cost structure,
  // kept separate from generic paid-marketing CAC above.
  const postBarterCost = barterOrders * d.aovRupees;
  const fixedCost = d.fixedMonthlyCostRupees;
  const platformFee = revenue * (PLATFORM_FEE_PCT / 100);

  const totalCosts =
    cogs +
    cac +
    adminTech +
    paymentGatewayFees +
    codHandlingFees +
    rtoCost +
    shippingCost +
    packagingCost +
    postBarterCost +
    fixedCost +
    platformFee;

  return {
    orders,
    barterOrders,
    cashOrders,
    codOrders,
    prepaidOrders,
    rtoOrders,
    revenue,
    cogs,
    cac,
    adminTech,
    paymentGatewayFees,
    codHandlingFees,
    rtoCost,
    shippingCost,
    packagingCost,
    postBarterCost,
    fixedCost,
    platformFee,
    totalCosts,
    profit: revenue - totalCosts,
  };
}

const MONTH_PLAN_KEYS: (keyof MonthPlan)[] = [
  "orders",
  "barterOrders",
  "cashOrders",
  "codOrders",
  "prepaidOrders",
  "rtoOrders",
  "revenue",
  "cogs",
  "cac",
  "adminTech",
  "paymentGatewayFees",
  "codHandlingFees",
  "rtoCost",
  "shippingCost",
  "packagingCost",
  "postBarterCost",
  "fixedCost",
  "platformFee",
  "totalCosts",
  "profit",
];

/** The ONE place money is computed from drivers — called both right after generation and on every edit. */
export function computePlanFromDrivers(drivers: BusinessPlanDrivers): ComputedPlan {
  const months = drivers.months.map((m) => computeMonth(m.orders, drivers)) as [MonthPlan, MonthPlan, MonthPlan];
  const totals = MONTH_PLAN_KEYS.reduce((acc, key) => {
    acc[key] = months[0][key] + months[1][key] + months[2][key];
    return acc;
  }, {} as MonthPlan);
  return { months, totals };
}
