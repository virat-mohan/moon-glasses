"use client";

import { useEffect, useState } from "react";

type Analytics = {
  sessions: number;
  pageviews: number;
  bounceRate: number;
  newSessions: number;
  returningSessions: number;
  funnel: {
    sessions: number;
    viewedProduct: number;
    addedToCart: number;
    initiatedCheckout: number;
    purchased: number;
  };
  cartAbandonmentRate: number;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  revenuePerSession: number;
  topPages: { path: string; views: number }[];
  topViewedChapters: { name: string; views: number }[];
  topAddedChapters: { name: string; adds: number }[];
  topReferrers: { host: string; sessions: number }[];
  trafficSources: { source: string; sessions: number }[];
  dailyTrend: { date: string; sessions: number; addToCarts: number; purchases: number }[];
};

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-divider p-4">
      <p className="text-micro uppercase tracking-[0.05em] text-secondary-text">{label}</p>
      <p className="mt-1.5 font-display text-heading-s text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-caption text-secondary-text">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, count, of, first }: { label: string; count: number; of: number; first?: boolean }) {
  const rate = of > 0 ? count / of : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="w-40 shrink-0 text-caption text-secondary-text">{label}</p>
      <div className="h-6 flex-1 bg-surface-alt">
        <div className="h-6 bg-ink" style={{ width: `${Math.max(rate * 100, count > 0 ? 2 : 0)}%` }} />
      </div>
      <p className="w-28 shrink-0 text-right text-caption text-ink">
        {count.toLocaleString("en-IN")} {!first && `(${pct(rate)})`}
      </p>
    </div>
  );
}

export default function WebsiteAnalyticsPage() {
  const [from, setFrom] = useState(() => daysAgoStr(6));
  const [to, setTo] = useState(todayStr);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/admin/website-analytics?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [from, to]);

  const maxTrend = data ? Math.max(1, ...data.dailyTrend.map((d) => d.sessions)) : 1;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Website Analytics</h1>
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
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        First-party — built on the same session tracking the ad funnel reports use, so this can
        never disagree with them. Not affected by ad blockers or cookie consent state.
      </p>

      {loading || !data ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Sessions" value={data.sessions.toLocaleString("en-IN")} />
            <StatTile label="Pageviews" value={data.pageviews.toLocaleString("en-IN")} />
            <StatTile label="Bounce Rate" value={pct(data.bounceRate)} sub="1-page, no interaction" />
            <StatTile
              label="New / Returning"
              value={`${data.newSessions.toLocaleString("en-IN")} / ${data.returningSessions.toLocaleString("en-IN")}`}
            />
            <StatTile label="Revenue" value={inr(data.revenue)} sub={`${data.orders} orders`} />
            <StatTile label="Avg Order Value" value={inr(data.averageOrderValue)} />
            <StatTile label="Revenue / Session" value={inr(data.revenuePerSession)} />
            <StatTile label="Cart Abandonment" value={pct(data.cartAbandonmentRate)} sub="added but never bought" />
          </div>

          <div className="mt-10 border-t border-divider pt-6">
            <h2 className="font-display text-heading-s uppercase text-ink">Conversion Funnel</h2>
            <div className="mt-4 space-y-2">
              <FunnelBar label="Sessions" count={data.funnel.sessions} of={data.funnel.sessions} first />
              <FunnelBar label="Viewed A Product" count={data.funnel.viewedProduct} of={data.funnel.sessions} />
              <FunnelBar label="Added To Cart" count={data.funnel.addedToCart} of={data.funnel.sessions} />
              <FunnelBar label="Started Checkout" count={data.funnel.initiatedCheckout} of={data.funnel.sessions} />
              <FunnelBar label="Purchased" count={data.funnel.purchased} of={data.funnel.sessions} />
            </div>
          </div>

          <div className="mt-10 border-t border-divider pt-6">
            <h2 className="font-display text-heading-s uppercase text-ink">Sessions Trend</h2>
            <div className="mt-4 flex h-40 items-end gap-1">
              {data.dailyTrend.map((d) => (
                <div key={d.date} className="group relative flex-1">
                  <div
                    className="w-full bg-ink"
                    style={{ height: `${Math.max((d.sessions / maxTrend) * 100, d.sessions > 0 ? 3 : 0)}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap border border-divider bg-surface px-2 py-1 text-micro text-ink group-hover:block">
                    {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}:{" "}
                    {d.sessions} sessions, {d.addToCarts} ATC, {d.purchases} purchases
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 border-t border-divider pt-6">
            <h2 className="font-display text-heading-s uppercase text-ink">Traffic Sources</h2>
            <p className="mt-1 max-w-2xl text-micro text-secondary-text/70">
              Paid Ad = a session that arrived via a launched campaign&apos;s own link (unambiguous).
              WhatsApp only detects tagged links (?utm_source=whatsapp) or the rare case a referrer
              survives — most WhatsApp opens strip it and will show as Direct instead.
            </p>
            <div className="mt-4 space-y-2">
              {data.trafficSources.map((s) => (
                <FunnelBar key={s.source} label={s.source} count={s.sessions} of={data.sessions} />
              ))}
              {data.trafficSources.length === 0 && <p className="text-caption text-secondary-text">No data yet.</p>}
            </div>
          </div>

          <div className="mt-10 grid gap-8 border-t border-divider pt-6 md:grid-cols-2">
            <div>
              <h2 className="font-display text-heading-s uppercase text-ink">Top Pages</h2>
              <ul className="mt-3 space-y-1.5">
                {data.topPages.length === 0 && <li className="text-caption text-secondary-text">No data yet.</li>}
                {data.topPages.map((p) => (
                  <li key={p.path} className="flex items-center justify-between border-b border-divider pb-1.5 text-body-s">
                    <span className="truncate text-ink">{p.path}</span>
                    <span className="shrink-0 text-caption text-secondary-text">{p.views}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-heading-s uppercase text-ink">Top Referrers</h2>
              <ul className="mt-3 space-y-1.5">
                {data.topReferrers.length === 0 && (
                  <li className="text-caption text-secondary-text">No external referrers — mostly direct traffic.</li>
                )}
                {data.topReferrers.map((r) => (
                  <li key={r.host} className="flex items-center justify-between border-b border-divider pb-1.5 text-body-s">
                    <span className="truncate text-ink">{r.host}</span>
                    <span className="shrink-0 text-caption text-secondary-text">{r.sessions} sessions</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-heading-s uppercase text-ink">Most Viewed Chapters</h2>
              <ul className="mt-3 space-y-1.5">
                {data.topViewedChapters.length === 0 && <li className="text-caption text-secondary-text">No data yet.</li>}
                {data.topViewedChapters.map((c) => (
                  <li key={c.name} className="flex items-center justify-between border-b border-divider pb-1.5 text-body-s">
                    <span className="text-ink">{c.name}</span>
                    <span className="text-caption text-secondary-text">{c.views}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-heading-s uppercase text-ink">Most Added To Cart</h2>
              <ul className="mt-3 space-y-1.5">
                {data.topAddedChapters.length === 0 && <li className="text-caption text-secondary-text">No data yet.</li>}
                {data.topAddedChapters.map((c) => (
                  <li key={c.name} className="flex items-center justify-between border-b border-divider pb-1.5 text-body-s">
                    <span className="text-ink">{c.name}</span>
                    <span className="text-caption text-secondary-text">{c.adds}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
