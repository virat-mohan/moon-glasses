"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerImport } from "@/components/admin/CustomerImport";

type Customer = {
  phone: string;
  name: string;
  email: string;
  orderCount: number;
  capsBought: number;
  totalSpent: number;
  lastOrderAt: string;
  miles: number;
  importedRecords: number;
  isVip: boolean;
  isAtRisk: boolean;
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [milesPerCap, setMilesPerCap] = useState(250);
  const [redemptionThreshold, setRedemptionThreshold] = useState(500);
  const [redemptionValueRupees, setRedemptionValueRupees] = useState(200);
  const [loading, setLoading] = useState(true);

  const [minSpend, setMinSpend] = useState("");
  const [minOrders, setMinOrders] = useState("");
  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [atRiskOnly, setAtRiskOnly] = useState(false);

  function load() {
    fetch("/api/admin/customers")
      .then((res) => res.json())
      .then((data) => setCustomers(data.customers ?? []))
      .finally(() => setLoading(false));

    fetch("/api/admin/loyalty-config")
      .then((res) => res.json())
      .then((data) => {
        setMilesPerCap(data.milesPerCap ?? 250);
        setRedemptionThreshold(data.redemptionThreshold ?? 500);
        setRedemptionValueRupees(data.redemptionValueRupees ?? 200);
      });
  }

  useEffect(load, []);

  async function saveLoyaltyConfig(patch: Record<string, number>) {
    await fetch("/api/admin/loyalty-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (minSpend && c.totalSpent < Number(minSpend)) return false;
      if (minOrders && c.orderCount < Number(minOrders)) return false;
      if (sinceDate && (!c.lastOrderAt || c.lastOrderAt.slice(0, 10) < sinceDate)) return false;
      if (untilDate && (!c.lastOrderAt || c.lastOrderAt.slice(0, 10) > untilDate)) return false;
      if (vipOnly && !c.isVip) return false;
      if (atRiskOnly && !c.isAtRisk) return false;
      return true;
    });
  }, [customers, minSpend, minOrders, sinceDate, untilDate, vipOnly, atRiskOnly]);

  function clearFilters() {
    setMinSpend("");
    setMinOrders("");
    setSinceDate("");
    setUntilDate("");
    setVipOnly(false);
    setAtRiskOnly(false);
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Customers</h1>
      <p className="mt-2 max-w-xl text-body-s text-secondary-text">
        Grouped by phone number — real orders merged with any imported CSV history. Miles are
        earned by anyone who&apos;s ever bought something; only customers who&apos;ve logged in via
        /account can actually redeem them at checkout.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-divider pt-6">
        <div className="flex items-center gap-3">
          <label className="text-caption text-secondary-text">Miles earned per cap bought</label>
          <input
            type="number"
            value={milesPerCap}
            onChange={(e) => setMilesPerCap(Number(e.target.value))}
            onBlur={() => saveLoyaltyConfig({ milesPerCap })}
            className="w-24 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-caption text-secondary-text">Miles per redemption</label>
          <input
            type="number"
            value={redemptionThreshold}
            onChange={(e) => setRedemptionThreshold(Number(e.target.value))}
            onBlur={() => saveLoyaltyConfig({ redemptionThreshold })}
            className="w-24 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-caption text-secondary-text">Worth ₹</label>
          <input
            type="number"
            value={redemptionValueRupees}
            onChange={(e) => setRedemptionValueRupees(Number(e.target.value))}
            onBlur={() => saveLoyaltyConfig({ redemptionValueRupees })}
            className="w-24 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
          />
        </div>
        <p className="text-caption text-secondary-text">
          e.g. every {redemptionThreshold.toLocaleString("en-IN")} Miles = ₹
          {redemptionValueRupees.toLocaleString("en-IN")} off at checkout.
        </p>
      </div>

      <CustomerImport onImported={load} />

      <div className="mt-10 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-divider pt-6">
        <div>
          <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
            Min Total Spent ₹
          </label>
          <input
            type="number"
            value={minSpend}
            onChange={(e) => setMinSpend(e.target.value)}
            className="mt-1 w-32 border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
            Min Number Of Purchases
          </label>
          <input
            type="number"
            value={minOrders}
            onChange={(e) => setMinOrders(e.target.value)}
            className="mt-1 w-32 border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
            Last Purchase After
          </label>
          <input
            type="date"
            value={sinceDate}
            onChange={(e) => setSinceDate(e.target.value)}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
            Last Purchase Before
          </label>
          <input
            type="date"
            value={untilDate}
            onChange={(e) => setUntilDate(e.target.value)}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </div>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} className="h-4 w-4 accent-ink" />
          <span className="text-micro uppercase tracking-[0.05em] text-secondary-text">VIP only</span>
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" checked={atRiskOnly} onChange={(e) => setAtRiskOnly(e.target.checked)} className="h-4 w-4 accent-ink" />
          <span className="text-micro uppercase tracking-[0.05em] text-secondary-text">At risk only</span>
        </label>
        {(minSpend || minOrders || sinceDate || untilDate || vipOnly || atRiskOnly) && (
          <button onClick={clearFilters} className="text-caption text-secondary-text underline">
            Clear Filters
          </button>
        )}
        <p className="text-caption text-secondary-text">
          Showing {filtered.length} of {customers.length}
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Segment</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Orders</th>
              <th className="py-2 pr-4">Caps Bought</th>
              <th className="py-2 pr-4">Total Spent</th>
              <th className="py-2 pr-4">Last Order</th>
              <th className="py-2 pr-4">Miles</th>
              <th className="py-2 pr-4">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-body-s text-secondary-text">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-body-s text-secondary-text">
                  {customers.length === 0 ? "No customers yet." : "No customers match these filters."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.phone} className="border-b border-divider">
                  <td className="py-3 font-sans text-body-s text-ink">{c.name || "—"}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.isVip && (
                        <span className="border border-tan-gold px-1.5 py-0.5 text-micro uppercase tracking-[0.03em] text-tan-gold">
                          VIP
                        </span>
                      )}
                      {c.isAtRisk && (
                        <span className="border border-paint-orange px-1.5 py-0.5 text-micro uppercase tracking-[0.03em] text-paint-orange">
                          At Risk
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-caption text-secondary-text">{c.phone}</td>
                  <td className="py-3 text-caption text-secondary-text">{c.email || "—"}</td>
                  <td className="py-3 text-body-s text-ink">{c.orderCount}</td>
                  <td className="py-3 text-body-s text-ink">{c.capsBought}</td>
                  <td className="py-3 text-body-s text-ink">₹{c.totalSpent.toLocaleString("en-IN")}</td>
                  <td className="py-3 text-caption text-secondary-text">{formatDate(c.lastOrderAt)}</td>
                  <td className="py-3 font-display text-body-s text-tan-gold">
                    {c.miles.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 text-micro uppercase tracking-[0.03em] text-secondary-text">
                    {c.importedRecords > 0
                      ? c.importedRecords === c.orderCount
                        ? "Data Import"
                        : "Mixed"
                      : "Site"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
