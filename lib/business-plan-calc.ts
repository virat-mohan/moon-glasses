// Pure, dependency-free math — safe to import from both server API routes
// AND the client admin page (for instant live-recompute on every edit,
// with no round trip). Never import anything server-only (supabase,
// settings) into this file.

export type FixedCostLine = { id: string; label: string; amountRupees: number };

/** One SKU material/price tier — series+price+skuCount are real catalog ground truth; the two %s are researched/editable. */
export type CategoryDriver = {
  series: "Plastic" | "Metal";
  label: string;
  priceRupees: number;
  skuCount: number;
  shareOfOrdersPct: number;
  /** Product/manufacturing cost only — packaging is its own separate line below. */
  productCostPct: number;
};

/** One target city/market — its own volume ramp and CAC, since both vary a lot by geography. */
export type CityDriver = {
  name: string;
  monthlyOrders: [number, number, number];
  cacRupeesPerOrder: number;
  rationale: string;
};

/** Deterministic policy choices the human sets up front — never researched. */
export type ShippingPolicy = {
  prepaidMode: "free" | "charged";
  prepaidChargeRupees: number;
  codEnabled: boolean;
  codMode: "free" | "charged";
  codChargeRupees: number;
};

export type BusinessPlanDrivers = {
  /** Step-1 setup, provided before generation. */
  targetCities: string[];
  shippingPolicy: ShippingPolicy;

  categories: CategoryDriver[];
  cities: CityDriver[];

  packagingCostPerOrderRupees: number;
  adminTechPct: number;
  /** % of non-barter (cash) orders that are COD; the rest are prepaid. Only applies if shippingPolicy.codEnabled. */
  codSharePct: number;
  /** Charged only on the prepaid share of cash orders. */
  paymentGatewayFeePct: number;
  /** Charged only on the COD share of cash orders. */
  codHandlingFeePct: number;
  /** % of COD orders that RTO — COD RTO is far higher than prepaid. */
  rtoRatePct: number;
  rtoCostPerOrderRupees: number;
  /** Non-delivery-report risk cost — failed COD delivery attempts, re-attempt/holding cost. */
  ndrCostPerOrderRupees: number;
  /** Real courier cost to the business, charged regardless of shippingPolicy. */
  shippingCostPerOrderRupees: number;
  /** Share of ALL orders fulfilled via "Pay With A Post" (see lib/post-barter.ts) instead of cash. */
  postBarterSharePct: number;
  /** Named, addable fixed monthly line items — performance marketing retainer, freelancers, tooling, etc. */
  fixedCostLines: FixedCostLine[];

  /** One short cited paragraph per driver group — never dressed up as researched when it wasn't. */
  rationale: {
    categoryMix: string;
    adminTech: string;
    codShare: string;
    paymentGatewayFee: string;
    codHandlingFee: string;
    rtoRate: string;
    rtoCost: string;
    ndrCost: string;
    shippingCost: string;
    packagingCost: string;
    postBarter: string;
    fixedCosts: string;
  };
};

/** Metadata driving the generic admin UI grid — one tile per scalar driver (categories/cities/fixedCostLines render as their own dedicated sections). */
export const DRIVER_FIELDS: {
  key: keyof Pick<
    BusinessPlanDrivers,
    | "packagingCostPerOrderRupees"
    | "adminTechPct"
    | "codSharePct"
    | "paymentGatewayFeePct"
    | "codHandlingFeePct"
    | "rtoRatePct"
    | "rtoCostPerOrderRupees"
    | "ndrCostPerOrderRupees"
    | "shippingCostPerOrderRupees"
    | "postBarterSharePct"
  >;
  label: string;
  unit: "%" | "₹";
  rationaleKey: keyof BusinessPlanDrivers["rationale"];
  /** Only meaningful / shown when COD is enabled in the shipping policy. */
  codOnly?: boolean;
}[] = [
  { key: "packagingCostPerOrderRupees", label: "Packaging Cost Per Order", unit: "₹", rationaleKey: "packagingCost" },
  { key: "adminTechPct", label: "Admin & Tech Overhead (% of revenue)", unit: "%", rationaleKey: "adminTech" },
  { key: "shippingCostPerOrderRupees", label: "Courier Cost Per Order (real, to us)", unit: "₹", rationaleKey: "shippingCost" },
  { key: "postBarterSharePct", label: "Pay With A Post Share Of Orders", unit: "%", rationaleKey: "postBarter" },
  { key: "codSharePct", label: "COD Share Of Cash Orders", unit: "%", rationaleKey: "codShare", codOnly: true },
  { key: "paymentGatewayFeePct", label: "Payment Gateway Fee (on prepaid)", unit: "%", rationaleKey: "paymentGatewayFee" },
  { key: "codHandlingFeePct", label: "COD Handling Fee (on COD)", unit: "%", rationaleKey: "codHandlingFee", codOnly: true },
  { key: "rtoRatePct", label: "RTO Rate (of COD orders)", unit: "%", rationaleKey: "rtoRate", codOnly: true },
  { key: "rtoCostPerOrderRupees", label: "RTO Cost Per Returned Order", unit: "₹", rationaleKey: "rtoCost", codOnly: true },
  { key: "ndrCostPerOrderRupees", label: "NDR Risk Cost Per COD Order", unit: "₹", rationaleKey: "ndrCost", codOnly: true },
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
  productRevenue: number;
  shippingRevenue: number;
  revenue: number;
  productCost: number;
  packagingCost: number;
  cogs: number;
  grossProfit: number;
  cac: number;
  adminTech: number;
  paymentGatewayFees: number;
  codHandlingFees: number;
  rtoCost: number;
  ndrCost: number;
  shippingCost: number;
  postBarterCost: number;
  fixedCost: number;
  platformFee: number;
  totalOpex: number;
  profit: number;
};

export type ComputedPlan = {
  months: [MonthPlan, MonthPlan, MonthPlan];
  totals: MonthPlan;
};

function computeMonth(monthIndex: 0 | 1 | 2, d: BusinessPlanDrivers): MonthPlan {
  const orders = d.cities.reduce((s, c) => s + c.monthlyOrders[monthIndex], 0);
  const cac = d.cities.reduce((s, c) => s + c.monthlyOrders[monthIndex] * c.cacRupeesPerOrder, 0);

  const blendedPrice = d.categories.reduce((s, c) => s + c.priceRupees * (c.shareOfOrdersPct / 100), 0);

  let productRevenue = 0;
  let productCost = 0;
  for (const cat of d.categories) {
    const catOrders = orders * (cat.shareOfOrdersPct / 100);
    productRevenue += catOrders * cat.priceRupees;
    productCost += catOrders * cat.priceRupees * (cat.productCostPct / 100);
  }

  const barterOrders = orders * (d.postBarterSharePct / 100);
  const cashOrders = orders - barterOrders;
  const codOrders = d.shippingPolicy.codEnabled ? cashOrders * (d.codSharePct / 100) : 0;
  const prepaidOrders = cashOrders - codOrders;
  const rtoOrders = codOrders * (d.rtoRatePct / 100);

  const shippingRevenue =
    (d.shippingPolicy.prepaidMode === "charged" ? prepaidOrders * d.shippingPolicy.prepaidChargeRupees : 0) +
    (d.shippingPolicy.codEnabled && d.shippingPolicy.codMode === "charged"
      ? codOrders * d.shippingPolicy.codChargeRupees
      : 0);

  const revenue = productRevenue + shippingRevenue;
  const packagingCost = orders * d.packagingCostPerOrderRupees;
  const cogs = productCost + packagingCost;
  const grossProfit = revenue - cogs;

  const adminTech = revenue * (d.adminTechPct / 100);
  const paymentGatewayFees = prepaidOrders * blendedPrice * (d.paymentGatewayFeePct / 100);
  const codHandlingFees = codOrders * blendedPrice * (d.codHandlingFeePct / 100);
  const rtoCost = rtoOrders * d.rtoCostPerOrderRupees;
  const ndrCost = codOrders * d.ndrCostPerOrderRupees;
  const shippingCost = orders * d.shippingCostPerOrderRupees;
  // The product given away in exchange for the post, at full retail value —
  // its own driver/formula per the barter mechanic's real cost structure,
  // kept separate from city-level paid CAC above.
  const postBarterCost = barterOrders * blendedPrice;
  const fixedCost = d.fixedCostLines.reduce((s, l) => s + l.amountRupees, 0);
  const platformFee = revenue * (PLATFORM_FEE_PCT / 100);

  const totalOpex =
    cac + adminTech + paymentGatewayFees + codHandlingFees + rtoCost + ndrCost + shippingCost + postBarterCost + fixedCost + platformFee;

  return {
    orders,
    barterOrders,
    cashOrders,
    codOrders,
    prepaidOrders,
    rtoOrders,
    productRevenue,
    shippingRevenue,
    revenue,
    productCost,
    packagingCost,
    cogs,
    grossProfit,
    cac,
    adminTech,
    paymentGatewayFees,
    codHandlingFees,
    rtoCost,
    ndrCost,
    shippingCost,
    postBarterCost,
    fixedCost,
    platformFee,
    totalOpex,
    profit: grossProfit - totalOpex,
  };
}

const MONTH_PLAN_KEYS: (keyof MonthPlan)[] = [
  "orders",
  "barterOrders",
  "cashOrders",
  "codOrders",
  "prepaidOrders",
  "rtoOrders",
  "productRevenue",
  "shippingRevenue",
  "revenue",
  "productCost",
  "packagingCost",
  "cogs",
  "grossProfit",
  "cac",
  "adminTech",
  "paymentGatewayFees",
  "codHandlingFees",
  "rtoCost",
  "ndrCost",
  "shippingCost",
  "postBarterCost",
  "fixedCost",
  "platformFee",
  "totalOpex",
  "profit",
];

/** The ONE place money is computed from drivers — called both right after generation and on every edit. */
export function computePlanFromDrivers(drivers: BusinessPlanDrivers): ComputedPlan {
  const months = [0, 1, 2].map((i) => computeMonth(i as 0 | 1 | 2, drivers)) as [MonthPlan, MonthPlan, MonthPlan];
  const totals = MONTH_PLAN_KEYS.reduce((acc, key) => {
    acc[key] = months[0][key] + months[1][key] + months[2][key];
    return acc;
  }, {} as MonthPlan);
  return { months, totals };
}
