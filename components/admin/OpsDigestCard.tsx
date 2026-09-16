"use client";

import { useEffect, useState } from "react";

type Digest = {
  newOrders: number;
  revenue: number;
  refundsProcessed: number;
  rtoInitiated: number;
  newLeads: { id: string; name: string | null; source: string }[];
  lowStock: { name: string; stock: number }[];
  threshold: number;
};

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function OpsDigestCard() {
  const [from, setFrom] = useState(yesterdayStr);
  const [to, setTo] = useState(todayStr);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/admin/ops-digest?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((data) => setDigest(data))
      .finally(() => setLoading(false));
  }

  // Re-fetches on every date-range change (not just on mount, unlike the
  // load-once-on-mount pattern elsewhere in admin/*), so the loading flag
  // genuinely needs to flip back to true here — an intentional exception to
  // the usual "don't setState synchronously in an effect" guidance.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [from, to]);

  return (
    <section className="mb-10 border border-divider p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-heading-s uppercase text-ink">Ops Digest</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-caption text-secondary-text">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-divider bg-surface px-2 py-1 text-body-s text-ink"
            />
          </label>
          <label className="flex items-center gap-2 text-caption text-secondary-text">
            To
            <input
              type="date"
              value={to}
              min={from}
              max={todayStr()}
              onChange={(e) => setTo(e.target.value)}
              className="border border-divider bg-surface px-2 py-1 text-body-s text-ink"
            />
          </label>
        </div>
      </div>

      {loading || !digest ? (
        <p className="mt-4 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-micro uppercase tracking-[0.05em] text-secondary-text">Orders</p>
            <p className="mt-1 font-sans text-body-l text-ink">{digest.newOrders}</p>
            <p className="text-caption text-secondary-text">₹{digest.revenue.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-micro uppercase tracking-[0.05em] text-secondary-text">Refunds / RTO</p>
            <p className="mt-1 font-sans text-body-l text-ink">
              {digest.refundsProcessed} / {digest.rtoInitiated}
            </p>
            <p className="text-caption text-secondary-text">refunded / initiated</p>
          </div>
          <div>
            <p className="text-micro uppercase tracking-[0.05em] text-secondary-text">New Leads</p>
            <p className="mt-1 font-sans text-body-l text-ink">{digest.newLeads.length}</p>
            {digest.newLeads.length > 0 && (
              <p className="text-caption text-secondary-text">
                {digest.newLeads.map((l) => l.name ?? "Unnamed").join(", ")}
              </p>
            )}
          </div>
          <div>
            <p className="text-micro uppercase tracking-[0.05em] text-secondary-text">
              Low Stock (≤ {digest.threshold})
            </p>
            <p className="mt-1 font-sans text-body-l text-ink">{digest.lowStock.length}</p>
            {digest.lowStock.length > 0 && (
              <p className="text-caption text-paint-orange">
                {digest.lowStock.map((c) => `${c.name} (${c.stock})`).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
