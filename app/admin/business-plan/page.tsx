"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePlanFromDrivers,
  DRIVER_FIELDS,
  type BusinessPlanDrivers,
  type ComputedPlan,
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

export default function BusinessPlanPage() {
  const [quarterStart, setQuarterStart] = useState(() => currentQuarterStart());
  const [drivers, setDrivers] = useState<BusinessPlanDrivers | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetching from the API on quarter change, not derived state
    setLoading(true);
    setError(null);
    setDirty(false);
    fetch(`/api/admin/business-plan?quarterStart=${quarterStart}`)
      .then((res) => res.json())
      .then((data) => setDrivers(data.drivers))
      .catch(() => setError("Could not load the plan"))
      .finally(() => setLoading(false));
  }, [quarterStart]);

  // Live, client-side mirror of the server's formula — instant preview on
  // every edit, no round trip. The Save button re-runs the same function
  // server-side and that response, not this one, is what's stored.
  const computed: ComputedPlan | null = useMemo(() => (drivers ? computePlanFromDrivers(drivers) : null), [drivers]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/business-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarterStart }),
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

  function updateDriver(key: keyof Omit<BusinessPlanDrivers, "months" | "rationale">, value: number) {
    if (!drivers) return;
    setDrivers({ ...drivers, [key]: value });
    setDirty(true);
  }

  function updateMonthOrders(index: 0 | 1 | 2, value: number) {
    if (!drivers) return;
    const months = [...drivers.months] as BusinessPlanDrivers["months"];
    months[index] = { orders: value };
    setDrivers({ ...drivers, months });
    setDirty(true);
  }

  const monthLabels = useMemo(() => {
    const [y, m] = quarterStart.split("-").map(Number);
    return [0, 1, 2].map((i) => new Date(y, m - 1 + i, 1).toLocaleDateString("en-IN", { month: "long" }));
  }, [quarterStart]);

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 pt-28 pb-24 md:px-12">
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
        <div className="mt-10 border border-ink/30 p-6 text-center">
          <p className="text-body-s text-secondary-text">No plan yet for {quarterLabel(quarterStart)}.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 border border-ink px-6 py-3 font-sans text-body-s font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-60"
          >
            {generating ? "Researching & Generating…" : "Generate Benchmark Plan"}
          </button>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr]">
          {/* Drivers */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">Drivers</h2>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-caption text-secondary-text underline disabled:opacity-60"
              >
                {generating ? "Regenerating…" : "Regenerate from scratch"}
              </button>
            </div>

            <div className="mt-4 border border-ink/30 p-4">
              <p className="font-sans text-body-s font-bold uppercase tracking-[0.03em] text-ink">
                Orders per month (ramp)
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {monthLabels.map((label, i) => (
                  <div key={label}>
                    <label className="block text-caption text-secondary-text">{label}</label>
                    <input
                      type="number"
                      value={drivers.months[i as 0 | 1 | 2].orders}
                      onChange={(e) => updateMonthOrders(i as 0 | 1 | 2, Number(e.target.value))}
                      className="mt-1 w-full border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-caption text-secondary-text">{drivers.rationale.ordersRamp}</p>
            </div>

            {DRIVER_FIELDS.map((field) => (
              <div key={field.key} className="mt-4 border border-ink/30 p-4">
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

            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="mt-6 w-full border border-ink py-3 font-sans text-body-s font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
            >
              {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
            </button>
          </div>

          {/* Computed P&L */}
          <div>
            <h2 className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">Computed P&amp;L</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Orders", "orders", false],
                      ["  of which Pay With A Post", "barterOrders", false],
                      ["  of which COD", "codOrders", false],
                      ["Revenue", "revenue", true],
                      ["COGS", "cogs", true],
                      ["Paid Marketing / CAC", "cac", true],
                      ["Admin & Tech", "adminTech", true],
                      ["Payment Gateway Fees", "paymentGatewayFees", true],
                      ["COD Handling Fees", "codHandlingFees", true],
                      ["RTO Cost", "rtoCost", true],
                      ["Shipping Cost", "shippingCost", true],
                      ["Packaging Cost", "packagingCost", true],
                      ["Pay With A Post Cost", "postBarterCost", true],
                      ["Fixed Costs", "fixedCost", true],
                      ["Platform Fee", "platformFee", true],
                      ["Total Costs", "totalCosts", true],
                      ["Profit", "profit", true],
                    ] as [string, keyof ComputedPlan["months"][0], boolean][]
                  ).map(([label, key, isMoney]) => (
                    <tr
                      key={key}
                      className={`border-b border-ink/10 ${
                        key === "profit" || key === "revenue" ? "font-bold text-ink" : "text-secondary-text"
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-caption text-secondary-text">
              Quarter profit margin: {computed.totals.revenue > 0 ? ((computed.totals.profit / computed.totals.revenue) * 100).toFixed(1) : "0.0"}%
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
