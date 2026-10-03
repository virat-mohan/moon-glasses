"use client";

import { useEffect, useRef, useState } from "react";
import { biggestDropSentence, pctText, type RangePreset } from "@/lib/analytics-helpers";
import type { WebsiteAnalytics } from "@/lib/website-analytics";

export type AnalyticsData = WebsiteAnalytics;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => n.toLocaleString("en-IN");

export const PURPOSE = "Who visited the store, where they came from, how many reached checkout and how many bought.";

export const DEFINITIONS: { term: string; meaning: string }[] = [
  {
    term: "Visitors",
    meaning:
      "One browser or device that came to the store during the chosen dates. The same person on two devices counts twice, and clearing the browser makes them new again.",
  },
  {
    term: "Visits",
    meaning:
      "Each time a visitor comes and uses the store. If a visitor goes quiet for more than 30 minutes and comes back, that is a new visit. So Visits is always at least Visitors.",
  },
  { term: "New vs returning", meaning: "Returning visitors were already seen on this store before the chosen dates. New visitors were not." },
  {
    term: "Bounce rate",
    meaning: "The share of visitors who only saw one page and did nothing else (no cart, no checkout, no purchase).",
  },
  { term: "Conversion rate", meaning: "Orders divided by visitors. Of every 100 visitors, how many placed an order." },
  { term: "Revenue per visitor", meaning: "Revenue divided by visitors. What an average visitor is worth, including the ones who bought nothing." },
  { term: "Average order value", meaning: "Revenue divided by orders. What a typical order is worth." },
  { term: "Cart abandonment", meaning: "Of the visitors who added something to the cart, the share who never paid." },
  {
    term: "Funnel",
    meaning:
      "The steps a visitor takes to buy: visited, viewed a product, added to cart, started checkout, paid. Each % is out of the step just before it, and the callout names the step where most people leave.",
  },
  {
    term: "Traffic sources",
    meaning:
      "Where a visitor first arrived from: Instagram (including Facebook and our Meta ads), WhatsApp, Google, Direct (typed the address or an app that hides where it came from) or Other (email, creators, partners, other sites).",
  },
  {
    term: "Orders without an ad click",
    meaning: "The share of orders that did not start from one of our ads. The higher it is, the less the shop depends on paid ads.",
  },
  {
    term: "What is left out",
    meaning:
      "Test orders, cancelled orders and the team's own visits (anyone who opened an admin page) are not counted. Orders the tracking could not match to a visitor show as Not tracked.",
  },
];

function Tile({ label, value, meaning, sub, wide }: { label: string; value: string; meaning: string; sub?: string; wide?: boolean }) {
  return (
    <div className={`ana-tile${wide ? " ana-tile--wide" : ""}`}>
      <p className="ana-tile-label">{label}</p>
      <p className="ana-tile-value">{value}</p>
      {sub && <p className="ana-tile-sub">{sub}</p>}
      <p className="ana-tile-meaning">{meaning}</p>
    </div>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <aside className="ana-drawer" role="dialog" aria-modal="true" aria-label="How to read this page">
        <div className="ana-drawer-head">
          <h2 className="font-display text-heading-s uppercase text-ink">How to read this page</h2>
          <button ref={closeRef} type="button" className="ord-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="ord-muted">{PURPOSE}</p>
        <dl className="ana-defs">
          {DEFINITIONS.map((d) => (
            <div key={d.term}>
              <dt>{d.term}</dt>
              <dd>{d.meaning}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-live="polite" className="ana-skel">
      <span className="sr-only">Loading analytics…</span>
      <div className="ana-tiles">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="adm-skel" style={{ height: 120 }} />
        ))}
      </div>
      <div className="adm-skel" style={{ height: 220, marginTop: 16 }} />
      <div className="adm-skel" style={{ height: 160, marginTop: 16 }} />
    </div>
  );
}

function SourceCards({ rows }: { rows: AnalyticsData["sources"] }) {
  return (
    <div className="ana-sources">
      <table className="ana-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Visitors</th>
            <th>Orders</th>
            <th>Revenue</th>
            <th>Orders per 100 visitors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source}>
              <td>{r.source}</td>
              <td>{num(r.visitors)}</td>
              <td>{num(r.orders)}</td>
              <td>{inr(r.revenue)}</td>
              <td>{r.visitors > 0 ? (r.conversionRate * 100).toFixed(1) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="ana-source-cards">
        {rows.map((r) => (
          <li key={r.source}>
            <p className="ana-source-name">{r.source}</p>
            <dl>
              <div><dt>Visitors</dt><dd>{num(r.visitors)}</dd></div>
              <div><dt>Orders</dt><dd>{num(r.orders)}</dd></div>
              <div><dt>Revenue</dt><dd>{inr(r.revenue)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyticsView({
  data,
  loading,
  error,
  onRetry,
  preset,
  from,
  to,
  today,
  onPreset,
  onCustom,
}: {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  preset: RangePreset;
  from: string;
  to: string;
  today: string;
  onPreset: (p: Exclude<RangePreset, "custom">) => void;
  onCustom: (from: string, to: string) => void;
}) {
  const [help, setHelp] = useState(false);
  const [custom, setCustom] = useState(preset === "custom");
  const empty = data && data.visitors === 0 && data.orders === 0;
  const maxTrend = data ? Math.max(1, ...data.dailyTrend.map((d) => d.visitors)) : 1;
  const presets: { key: Exclude<RangePreset, "custom">; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-24 md:px-12">
      <div className="ord-head">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Website analytics</h1>
        <button type="button" className="ord-btn" onClick={() => setHelp(true)} aria-haspopup="dialog">
          ? How to read this page
        </button>
      </div>
      <p className="ana-purpose">{PURPOSE}</p>

      <div className="ana-range">
        <div className="ord-chips" role="group" aria-label="Date range">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className="ord-fchip"
              aria-pressed={preset === p.key}
              onClick={() => {
                setCustom(false);
                onPreset(p.key);
              }}
            >
              {p.label}
            </button>
          ))}
          <button type="button" className="ord-fchip" aria-pressed={preset === "custom" || custom} onClick={() => setCustom(true)}>
            Custom
          </button>
        </div>
        {(custom || preset === "custom") && (
          <div className="ord-tools">
            <label className="ord-date">
              From
              <input type="date" value={from} max={to} onChange={(e) => onCustom(e.target.value, to)} className="ord-input" />
            </label>
            <label className="ord-date">
              To
              <input type="date" value={to} min={from} max={today} onChange={(e) => onCustom(from, e.target.value)} className="ord-input" />
            </label>
          </div>
        )}
        <p className="ord-muted">
          Showing {from === to ? from : `${from} to ${to}`} (India time). Test orders and the team&apos;s own visits are left out.
        </p>
      </div>

      {error ? (
        <div className="ord-empty" role="alert">
          <p className="ord-val">Could not load analytics.</p>
          <p className="ord-muted">{error}</p>
          <button type="button" className="ord-btn ord-btn--solid" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : loading || !data ? (
        <Skeleton />
      ) : empty ? (
        <div className="ord-empty">
          <p className="ord-val">No visitors or orders in these dates.</p>
          <p className="ord-muted">Pick a longer range, or check back once people start visiting.</p>
          <button type="button" className="ord-btn ord-btn--solid" onClick={() => onPreset("30d")}>
            Show last 30 days
          </button>
        </div>
      ) : (
        <>
          <div className="ana-tiles">
            <Tile label="Visitors" value={num(data.visitors)} meaning="Separate browsers or devices that came. Same person on two devices counts twice." />
            <Tile label="Visits" value={num(data.visits)} meaning="Times visitors came to the store. Coming back after 30 quiet minutes is a new visit." />
            <Tile
              wide
              label="New / returning"
              value={`${num(data.newVisitors)} / ${num(data.returningVisitors)}`}
              meaning="New visitors never came before these dates. Returning ones did."
            />
            <Tile label="Bounce rate" value={pctText(data.bounceRate)} meaning="Visitors who saw one page and left without doing anything else." />
            <Tile label="Orders" value={num(data.orders)} sub={inr(data.revenue)} meaning="Real orders placed (not test, not cancelled) and the money they bring." />
            <Tile
              label="Conversion rate"
              value={(data.conversionRate * 100).toFixed(1) + "%"}
              meaning="Of every 100 visitors, how many placed an order."
            />
            <Tile label="Revenue per visitor" value={inr(data.revenuePerVisitor)} meaning="What the average visitor is worth, counting those who bought nothing." />
            <Tile label="Average order value" value={inr(data.averageOrderValue)} meaning="What a typical order is worth." />
            <Tile label="Cart abandonment" value={pctText(data.cartAbandonmentRate)} meaning="Of people who added to cart, the share who never paid." />
          </div>

          <section className="ana-sec">
            <h2 className="font-display text-heading-s uppercase text-ink">From visit to purchase</h2>
            <p className="ord-muted">Each step shows how many visitors got there, and the % of the step before.</p>
            <ol className="ana-funnel">
              {data.funnelSteps.map((s, i) => {
                const width = data.visitors > 0 ? Math.max((s.count / data.visitors) * 100, s.count > 0 ? 2 : 0) : 0;
                return (
                  <li key={s.key}>
                    <div className="ana-funnel-top">
                      <span className="ord-val">{s.label}</span>
                      <span className="ord-val">
                        <b>{num(s.count)}</b>
                        {i > 0 && <span className="ord-muted"> · {pctText(s.pctOfPrevious ?? 0)} of previous</span>}
                      </span>
                    </div>
                    <div className="ana-bar" aria-hidden>
                      <div className="ana-bar-fill" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="ana-callout">{biggestDropSentence(data.biggestDrop)}</p>
          </section>

          <section className="ana-sec">
            <h2 className="font-display text-heading-s uppercase text-ink">Where visitors and orders came from</h2>
            <p className="ord-muted">First place each visitor arrived from. Orders and revenue are credited to that source.</p>
            {data.sources.length === 0 ? <p className="ord-muted">No data yet.</p> : <SourceCards rows={data.sources} />}
            <div className="ana-health">
              <p className="ana-tile-label">Health check: orders without an ad click</p>
              {data.nonAdOrderShare === null ? (
                <p className="ord-muted">No orders in these dates yet.</p>
              ) : (
                <>
                  <p className="ana-tile-value">{pctText(data.nonAdOrderShare)}</p>
                  <div className="ana-bar" aria-hidden>
                    <div className="ana-bar-fill" style={{ width: `${data.nonAdOrderShare * 100}%` }} />
                  </div>
                  <p className="ord-muted">
                    {data.orders - data.adClickOrders} of {data.orders} orders did not start from an ad. Ads should be one channel, not the whole shop.
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="ana-sec">
            <h2 className="font-display text-heading-s uppercase text-ink">Visitors each day</h2>
            <p className="ord-muted">One bar per day. The number above a bar is that day&apos;s visitors.</p>
            <div className="ana-trend" role="img" aria-label="Visitors per day">
              {data.dailyTrend.map((d) => (
                <div key={d.date} className="ana-trend-col">
                  <span className="ana-trend-n">{d.visitors}</span>
                  <div className="ana-trend-bar" style={{ height: `${Math.max((d.visitors / maxTrend) * 100, d.visitors > 0 ? 3 : 0)}%` }} />
                  <span className="ana-trend-d">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="ana-lists">
            <List title="Top pages" empty="No data yet." rows={data.topPages.map((p) => [p.path, `${num(p.views)} views`])} />
            <List title="Websites that sent visitors" empty="No outside websites. Mostly direct traffic." rows={data.topReferrers.map((r) => [r.host, `${num(r.sessions)} visitors`])} />
            <List title="Most viewed models" empty="No data yet." rows={data.topViewedChapters.map((c) => [c.name, `${num(c.views)} views`])} />
            <List title="Most added to cart" empty="No data yet." rows={data.topAddedChapters.map((c) => [c.name, `${num(c.adds)} adds`])} />
          </div>
        </>
      )}

      {help && <Drawer onClose={() => setHelp(false)} />}
    </main>
  );
}

function List({ title, rows, empty }: { title: string; rows: [string, string][]; empty: string }) {
  return (
    <section className="ana-list">
      <h2 className="font-display text-heading-s uppercase text-ink">{title}</h2>
      <ul>
        {rows.length === 0 && <li className="ord-muted">{empty}</li>}
        {rows.map(([a, b]) => (
          <li key={a}>
            <span className="ana-list-a">{a}</span>
            <span className="ord-muted">{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
