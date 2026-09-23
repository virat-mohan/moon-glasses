"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePlanFromDrivers,
  DRIVER_FIELDS,
  type BusinessPlanDrivers,
  type ComputedPlan,
  type FixedCostLine,
} from "@/lib/business-plan-calc";

function currentQuarterStart(): string {
  const now = new Date();
  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  return `${now.getFullYear()}-${String(quarterMonth + 1).padStart(2, "0")}-01`;
}

function shiftQuarter(quarterStart: string, delta: number): string {
  const [y, m] = quarterStart.split("-").map(Number);
  const d = new Date(y, m - 1 + delta * 3, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function quarterLabel(quarterStart: string): string {
  const [y, m] = quarterStart.split("-").map(Number);
  const months = [0, 1, 2].map((i) => new Date(y, m - 1 + i, 1).toLocaleDateString("en-IN", { month: "short" }));
  return `${months.join(" – ")} ${y}`;
}

function money(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function pct(part: number, whole: number) {
  if (!whole) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

const DEFAULT_SHIPPING_POLICY: BusinessPlanDrivers["shippingPolicy"] = {
  prepaidMode: "charged",
  prepaidChargeRupees: 79,
  codEnabled: false,
  codMode: "charged",
  codChargeRupees: 99,
};

export default function BusinessPlanPage() {
  const [quarterStart, setQuarterStart] = useState(() => currentQuarterStart());
  const [drivers, setDrivers] = useState<BusinessPlanDrivers | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Step-1 setup — collected before a plan exists; carried into the saved
  // drivers once generated, then editable in place from the same fields.
  const [citiesInput, setCitiesInput] = useState("Mumbai, Delhi, Bengaluru");
  const [shippingPolicy, setShippingPolicy] = useState(DEFAULT_SHIPPING_POLICY);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetching from the API on quarter change, not derived state
    setLoading(true);
    setError(null);
    setDirty(false);
    fetch(`/api/admin/business-plan?quarterStart=${quarterStart}`)
      .then((res) => res.json())
      .then((data) => {
        setDrivers(data.drivers);
        if (data.drivers) {
          setCitiesInput(data.drivers.targetCities.join(", "));
          setShippingPolicy(data.drivers.shippingPolicy);
        }
      })
      .catch(() => setError("Could not load the plan"))
      .finally(() => setLoading(false));
  }, [quarterStart]);

  // Live, client-side mirror of the server's formula — instant preview on
  // every edit, no round trip. The Save button re-runs the same function
  // server-side and that response, not this one, is what's stored.
  const computed: ComputedPlan | null = useMemo(() => (drivers ? computePlanFromDrivers(drivers) : null), [drivers]);

  async function handleGenerate() {
    const targetCities = citiesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (targetCities.length === 0) {
      setError("Add at least one target city");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/business-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarterStart, setup: { targetCities, shippingPolicy } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate plan");
      setDrivers(data.drivers);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate plan");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!drivers) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/business-plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarterStart, drivers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save plan");
      setDrivers(data.drivers);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save plan");
    } finally {
      setSaving(false);
    }
  }

  function patchDrivers(patch: Partial<BusinessPlanDrivers>) {
    if (!drivers) return;
    setDrivers({ ...drivers, ...patch });
    setDirty(true);
  }

  function updateDriver(key: (typeof DRIVER_FIELDS)[number]["key"], value: number) {
    patchDrivers({ [key]: value } as Partial<BusinessPlanDrivers>);
  }

  function updateShippingPolicy(patch: Partial<BusinessPlanDrivers["shippingPolicy"]>) {
    if (!drivers) {
      setShippingPolicy({ ...shippingPolicy, ...patch });
      return;
    }
    patchDrivers({ shippingPolicy: { ...drivers.shippingPolicy, ...patch } });
  }

  function updateCategory(index: number, patch: Partial<BusinessPlanDrivers["categories"][number]>) {
    if (!drivers) return;
    const categories = drivers.categories.map((c, i) => (i === index ? { ...c, ...patch } : c));
    patchDrivers({ categories });
  }

  function updateCity(index: number, patch: Partial<BusinessPlanDrivers["cities"][number]>) {
    if (!drivers) return;
    const cities = drivers.cities.map((c, i) => (i === index ? { ...c, ...patch } : c));
    patchDrivers({ cities });
  }

  function updateCityMonth(index: number, monthIndex: 0 | 1 | 2, value: number) {
    if (!drivers) return;
    const city = drivers.cities[index];
    const monthlyOrders = [...city.monthlyOrders] as [number, number, number];
    monthlyOrders[monthIndex] = value;
    updateCity(index, { monthlyOrders });
  }

  function addFixedCostLine() {
    if (!drivers) return;
    const line: FixedCostLine = { id: `fc-${Date.now()}`, label: "New Expense", amountRupees: 0 };
    patchDrivers({ fixedCostLines: [...drivers.fixedCostLines, line] });
  }

  function updateFixedCostLine(id: string, patch: Partial<FixedCostLine>) {
    if (!drivers) return;
    patchDrivers({ fixedCostLines: drivers.fixedCostLines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }

  function removeFixedCostLine(id: string) {
    if (!drivers) return;
    patchDrivers({ fixedCostLines: drivers.fixedCostLines.filter((l) => l.id !== id) });
  }

  const monthLabels = useMemo(() => {
    const [y, m] = quarterStart.split("-").map(Number);
    return [0, 1, 2].map((i) => new Date(y, m - 1 + i, 1).toLocaleDateString("en-IN", { month: "long" }));
  }, [quarterStart]);

  const visibleDriverFields = DRIVER_FIELDS.filter((f) => !f.codOnly || (drivers?.shippingPolicy.codEnabled ?? shippingPolicy.codEnabled));

  return (
    <main className="mx-auto w-full max-w-[1300px] px-6 pt-28 pb-24 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Business Plan (Forecast)</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuarterStart(shiftQuarter(quarterStart, -1))}
            className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            ← Prev
          </button>
          <span className="font-sans text-body-s text-ink">{quarterLabel(quarterStart)}</span>
          <button
            onClick={() => setQuarterStart(shiftQuarter(quarterStart, 1))}
            className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            Next →
          </button>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        A benchmark P&amp;L Claude researches and drafts as editable DRIVERS, not fixed totals — edit any number
        below and the whole plan recomputes live. This is a forecast, distinct from the real, actuals-based{" "}
        <a href="/admin/pnl" className="underline">
          P&amp;L
        </a>
        . A variance report comparing the two will follow once a quarter has actually played out.
      </p>

      {error && <p className="mt-4 text-body-s text-paint-orange">{error}</p>}

      {loading ? (
        <p className="mt-10 text-body-s text-secondary-text">Loading…</p>
      ) : !drivers || !computed ? (
        <div className="mt-10 max-w-xl border border-ink/30 p-6">
          <p className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">
            Step 1 — Setup for {quarterLabel(quarterStart)}
          </p>
          <p className="mt-1 text-caption text-secondary-text">
            These are business decisions, not researched — Claude uses them as fixed context.
          </p>

          <label className="mt-4 block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Target Cities (comma separated)
          </label>
          <input
            value={citiesInput}
            onChange={(e) => setCitiesInput(e.target.value)}
            placeholder="Mumbai, Delhi, Bengaluru"
            className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
          />

          <p className="mt-5 font-sans text-body-s font-bold uppercase tracking-[0.03em] text-ink">
            Shipping — Prepaid Orders
          </p>
          <div className="mt-2 flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-body-s text-ink">
              <input
                type="radio"
                checked={shippingPolicy.prepaidMode === "free"}
                onChange={() => updateShippingPolicy({ prepaidMode: "free" })}
              />
              Free
            </label>
            <label className="flex items-center gap-1.5 text-body-s text-ink">
              <input
                type="radio"
                checked={shippingPolicy.prepaidMode === "charged"}
                onChange={() => updateShippingPolicy({ prepaidMode: "charged" })}
              />
              Charged
            </label>
            {shippingPolicy.prepaidMode === "charged" && (
              <input
                type="number"
                value={shippingPolicy.prepaidChargeRupees}
                onChange={(e) => updateShippingPolicy({ prepaidChargeRupees: Number(e.target.value) })}
                className="w-24 border border-ink/30 bg-surface px-2 py-1 text-body-s text-ink outline-none focus:border-ink"
              />
            )}
          </div>

          <label className="mt-5 flex items-center gap-2 font-sans text-body-s font-bold uppercase tracking-[0.03em] text-ink">
            <input
              type="checkbox"
              checked={shippingPolicy.codEnabled}
              onChange={(e) => updateShippingPolicy({ codEnabled: e.target.checked })}
            />
            Offer Cash On Delivery
          </label>
          {shippingPolicy.codEnabled && (
            <div className="mt-2 flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-body-s text-ink">
                <input
                  type="radio"
                  checked={shippingPolicy.codMode === "free"}
                  onChange={() => updateShippingPolicy({ codMode: "free" })}
                />
                Free
              </label>
              <label className="flex items-center gap-1.5 text-body-s text-ink">
                <input
                  type="radio"
                  checked={shippingPolicy.codMode === "charged"}
                  onChange={() => updateShippingPolicy({ codMode: "charged" })}
                />
                Charged
              </label>
              {shippingPolicy.codMode === "charged" && (
                <input
                  type="number"
                  value={shippingPolicy.codChargeRupees}
                  onChange={(e) => updateShippingPolicy({ codChargeRupees: Number(e.target.value) })}
                  className="w-24 border border-ink/30 bg-surface px-2 py-1 text-body-s text-ink outline-none focus:border-ink"
                />
              )}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-6 w-full border border-ink py-3 font-sans text-body-s font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-60"
          >
            {generating ? "Researching & Generating…" : "Step 2 — Generate Benchmark Plan"}
          </button>
        </div>
      ) : (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">Setup</h2>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-caption text-secondary-text underline disabled:opacity-60"
            >
              {generating ? "Regenerating…" : "Regenerate from scratch"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-ink/30 p-4 sm:col-span-2">
              <label className="block text-caption uppercase tracking-[0.1em] text-secondary-text">Target Cities</label>
              <input
                value={citiesInput}
                onChange={(e) => {
                  setCitiesInput(e.target.value);
                  patchDrivers({ targetCities: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) });
                }}
                className="mt-1.5 w-full border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
              />
              <p className="mt-1 text-caption text-secondary-text">Changing cities needs Regenerate to re-research volume/CAC.</p>
            </div>
            <div className="border border-ink/30 p-4">
              <label className="block text-caption uppercase tracking-[0.1em] text-secondary-text">Prepaid Shipping</label>
              <div className="mt-2 flex items-center gap-3">
                <select
                  value={drivers.shippingPolicy.prepaidMode}
                  onChange={(e) => updateShippingPolicy({ prepaidMode: e.target.value as "free" | "charged" })}
                  className="border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                >
                  <option value="free">Free</option>
                  <option value="charged">Charged</option>
                </select>
                {drivers.shippingPolicy.prepaidMode === "charged" && (
                  <input
                    type="number"
                    value={drivers.shippingPolicy.prepaidChargeRupees}
                    onChange={(e) => updateShippingPolicy({ prepaidChargeRupees: Number(e.target.value) })}
                    className="w-20 border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                  />
                )}
              </div>
            </div>
            <div className="border border-ink/30 p-4">
              <label className="flex items-center gap-2 text-caption uppercase tracking-[0.1em] text-secondary-text">
                <input
                  type="checkbox"
                  checked={drivers.shippingPolicy.codEnabled}
                  onChange={(e) => updateShippingPolicy({ codEnabled: e.target.checked })}
                />
                Cash On Delivery
              </label>
              {drivers.shippingPolicy.codEnabled && (
                <div className="mt-2 flex items-center gap-3">
                  <select
                    value={drivers.shippingPolicy.codMode}
                    onChange={(e) => updateShippingPolicy({ codMode: e.target.value as "free" | "charged" })}
                    className="border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                  >
                    <option value="free">Free</option>
                    <option value="charged">Charged</option>
                  </select>
                  {drivers.shippingPolicy.codMode === "charged" && (
                    <input
                      type="number"
                      value={drivers.shippingPolicy.codChargeRupees}
                      onChange={(e) => updateShippingPolicy({ codChargeRupees: Number(e.target.value) })}
                      className="w-20 border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Categories */}
          <h2 className="mt-10 font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">
            Categories &amp; Unit Economics
          </h2>
          <p className="mt-1 text-caption text-secondary-text">{drivers.rationale.categoryMix}</p>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drivers.categories.map((cat, i) => {
              const unitProductCost = cat.priceRupees * (cat.productCostPct / 100);
              const unitPackaging = drivers.packagingCostPerOrderRupees;
              const unitMargin = cat.priceRupees - unitProductCost - unitPackaging;
              const unitMarginPct = cat.priceRupees > 0 ? (unitMargin / cat.priceRupees) * 100 : 0;
              return (
                <div key={cat.series} className="border border-ink/30 p-4">
                  <p className="font-sans text-body-s font-bold uppercase tracking-[0.03em] text-ink">
                    {cat.label} <span className="text-secondary-text">({cat.skuCount} SKUs)</span>
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-caption text-secondary-text">Share of orders</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={cat.shareOfOrdersPct}
                          onChange={(e) => updateCategory(i, { shareOfOrdersPct: Number(e.target.value) })}
                          className="w-full border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                        />
                        <span className="text-body-s text-secondary-text">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-caption text-secondary-text">Product cost</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={cat.productCostPct}
                          onChange={(e) => updateCategory(i, { productCostPct: Number(e.target.value) })}
                          className="w-full border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                        />
                        <span className="text-body-s text-secondary-text">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 border-t border-ink/10 pt-2 text-caption text-secondary-text">
                    <div className="flex justify-between">
                      <span>Price / unit</span>
                      <span className="text-ink">{money(cat.priceRupees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Product cost / unit</span>
                      <span className="text-ink">{money(unitProductCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Packaging / unit</span>
                      <span className="text-ink">{money(unitPackaging)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Contribution margin / unit</span>
                      <span className="text-ink">
                        {money(unitMargin)} ({unitMarginPct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cities */}
          <h2 className="mt-10 font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">
            Cities — Volume &amp; CAC
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drivers.cities.map((city, i) => (
              <div key={city.name} className="border border-ink/30 p-4">
                <p className="font-sans text-body-s font-bold uppercase tracking-[0.03em] text-ink">{city.name}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {monthLabels.map((label, mi) => (
                    <div key={label}>
                      <label className="block text-caption text-secondary-text">{label.slice(0, 3)}</label>
                      <input
                        type="number"
                        value={city.monthlyOrders[mi as 0 | 1 | 2]}
                        onChange={(e) => updateCityMonth(i, mi as 0 | 1 | 2, Number(e.target.value))}
                        className="w-full border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <label className="block text-caption text-secondary-text">CAC per order (₹)</label>
                  <input
                    type="number"
                    value={city.cacRupeesPerOrder}
                    onChange={(e) => updateCity(i, { cacRupeesPerOrder: Number(e.target.value) })}
                    className="w-full border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
                <p className="mt-2 text-caption text-secondary-text">{city.rationale}</p>
              </div>
            ))}
          </div>

          {/* Other scalar drivers */}
          <h2 className="mt-10 font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">Other Drivers</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleDriverFields.map((field) => (
              <div key={field.key} className="border border-ink/30 p-4">
                <label className="block font-sans text-body-s font-bold uppercase tracking-[0.03em] text-ink">
                  {field.label}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  {field.unit === "₹" && <span className="text-body-s text-secondary-text">₹</span>}
                  <input
                    type="number"
                    value={drivers[field.key] as number}
                    onChange={(e) => updateDriver(field.key, Number(e.target.value))}
                    className="w-full max-w-[160px] border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                  />
                  {field.unit === "%" && <span className="text-body-s text-secondary-text">%</span>}
                </div>
                <p className="mt-2 text-caption text-secondary-text">{drivers.rationale[field.rationaleKey]}</p>
              </div>
            ))}
          </div>

          {/* Fixed costs */}
          <h2 className="mt-10 font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">
            Fixed Monthly Costs
          </h2>
          <p className="mt-1 text-caption text-secondary-text">{drivers.rationale.fixedCosts}</p>
          <div className="mt-3 border border-ink/30">
            {drivers.fixedCostLines.map((line) => (
              <div key={line.id} className="flex items-center gap-3 border-b border-ink/10 p-3 last:border-b-0">
                <input
                  value={line.label}
                  onChange={(e) => updateFixedCostLine(line.id, { label: e.target.value })}
                  className="flex-1 border border-ink/30 bg-surface px-3 py-2 text-body-s text-ink outline-none focus:border-ink"
                />
                <div className="flex items-center gap-1">
                  <span className="text-body-s text-secondary-text">₹</span>
                  <input
                    type="number"
                    value={line.amountRupees}
                    onChange={(e) => updateFixedCostLine(line.id, { amountRupees: Number(e.target.value) })}
                    className="w-28 border border-ink/30 bg-surface px-3 py-2 text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
                <button
                  onClick={() => removeFixedCostLine(line.id)}
                  className="text-caption text-paint-orange underline"
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={addFixedCostLine}
              type="button"
              className="w-full border-t border-ink/10 py-2.5 text-caption uppercase tracking-[0.05em] text-secondary-text hover:text-ink"
            >
              + Add Expense Line
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="mt-8 w-full max-w-md border border-ink py-3 font-sans text-body-s font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </button>

          {/* Computed P&L */}
          <h2 className="mt-12 font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">Computed P&amp;L</h2>
          <div className="mt-4 overflow-x-auto border border-ink/30">
            <table className="w-full text-body-s">
              <thead>
                <tr className="border-b border-ink/20 text-left text-caption uppercase tracking-[0.05em] text-secondary-text">
                  <th className="px-3 py-2">Line</th>
                  {monthLabels.map((l) => (
                    <th key={l} className="px-3 py-2 text-right">
                      {l}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Quarter</th>
                  <th className="px-3 py-2 text-right">% Rev</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Orders", "orders", false],
                    ["  of which Pay With A Post", "barterOrders", false],
                    ["  of which COD", "codOrders", false],
                    ["Product Revenue", "productRevenue", true],
                    ["Shipping Revenue", "shippingRevenue", true],
                    ["Total Revenue", "revenue", true],
                    ["Product Cost", "productCost", true],
                    ["Packaging Cost", "packagingCost", true],
                    ["Total COGS", "cogs", true],
                    ["Gross Profit", "grossProfit", true],
                    ["Customer Acquisition (city CAC)", "cac", true],
                    ["Admin & Tech", "adminTech", true],
                    ["Payment Gateway Fees", "paymentGatewayFees", true],
                    ["COD Handling Fees", "codHandlingFees", true],
                    ["RTO Cost", "rtoCost", true],
                    ["NDR Risk Cost", "ndrCost", true],
                    ["Courier / Shipping Cost", "shippingCost", true],
                    ["Pay With A Post Cost", "postBarterCost", true],
                    ["Fixed Costs", "fixedCost", true],
                    ["Platform Fee", "platformFee", true],
                    ["Total Operating Expenses", "totalOpex", true],
                    ["Net Profit", "profit", true],
                  ] as [string, keyof ComputedPlan["months"][0], boolean][]
                ).map(([label, key, isMoney]) => (
                  <tr
                    key={key}
                    className={`border-b border-ink/10 ${
                      ["profit", "revenue", "grossProfit"].includes(key) ? "font-bold text-ink" : "text-secondary-text"
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{label}</td>
                    {computed.months.map((m, i) => (
                      <td key={i} className="px-3 py-2 text-right tabular-nums">
                        {isMoney ? money(m[key]) : Math.round(m[key]).toLocaleString("en-IN")}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isMoney
                        ? money(computed.totals[key])
                        : Math.round(computed.totals[key]).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-secondary-text">
                      {isMoney ? pct(computed.totals[key], computed.totals.revenue) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-caption text-secondary-text">
            Quarter net margin: {pct(computed.totals.profit, computed.totals.revenue)}
          </p>
        </div>
      )}
    </main>
  );
}
