"use client";

import { useEffect, useState } from "react";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";

type BarterOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  barter_tier: "gift_first" | "sell_first";
  barter_instagram_handle: string | null;
  barter_follower_count: number | null;
  barter_coupon_code: string | null;
  barter_required_orders: number;
  barter_post_url: string | null;
  barter_qualified_at: string | null;
  total: number;
  orders_so_far: number;
};

type LeaderboardRow = {
  handle: string | null;
  tier: "gift_first" | "sell_first";
  followerCount: number | null;
  code: string | null;
  ordersDriven: number;
  qualified: boolean;
};

type Stats = {
  from: string | null;
  to: string | null;
  totalBarterers: number;
  tierCounts: { sell_first: number; gift_first: number };
  qualifiedCount: number;
  redeemedOrderCount: number;
  revenueTotal: number;
  feeRatePercent: number;
  feeAmount: number;
  leaderboard: LeaderboardRow[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

function rupees(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AdminPostBarterPage() {
  const [orders, setOrders] = useState<BarterOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setLoading(true);
    fetch(`/api/admin/post-barter?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders ?? []);
        setStats(data.stats ?? null);
      })
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- refetching from the API on filter change, not derived state
  useEffect(load, [from, to]);

  const pending = orders.filter((o) => !o.barter_qualified_at);
  const qualified = orders.filter((o) => o.barter_qualified_at);

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 text-heading-l uppercase">
        <PayWithAPostMark />
      </h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Orders paid for with an Instagram post instead of currency. Ships automatically once a
        customer&apos;s code clears its required-orders line — nothing to approve manually.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 border border-divider bg-surface-alt p-4">
        <label className="flex flex-col gap-1 text-caption text-secondary-text">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-caption text-secondary-text">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </label>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="border border-ink/30 px-3 py-1.5 font-sans text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            Clear — All Time
          </button>
        )}
      </div>

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Used This Range" value={stats.totalBarterers.toLocaleString("en-IN")} />
          <StatCard
            label="Under 5,000 / 5,000+"
            value={`${stats.tierCounts.sell_first} / ${stats.tierCounts.gift_first}`}
          />
          <StatCard label="Paid Orders Via Codes" value={stats.redeemedOrderCount.toLocaleString("en-IN")} />
          <StatCard label="Revenue Via Codes" value={rupees(stats.revenueTotal)} />
          <StatCard
            label={`Platform Service Fee (${stats.feeRatePercent}%)`}
            value={rupees(stats.feeAmount)}
            highlight
          />
          <StatCard label="Qualified & Shipped" value={stats.qualifiedCount.toLocaleString("en-IN")} />
        </div>
      )}

      {stats && stats.leaderboard.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-heading-s uppercase text-ink">Leaderboard — By Orders Driven</h2>
          <div className="mt-4 overflow-x-auto border border-divider">
            <table className="w-full text-left text-caption">
              <thead>
                <tr className="border-b border-divider text-secondary-text">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Handle</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Followers</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Orders Driven</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.leaderboard.map((row, i) => (
                  <tr key={`${row.code}-${i}`} className="border-b border-divider/50 last:border-0">
                    <td className="px-3 py-2 text-secondary-text">{i + 1}</td>
                    <td className="px-3 py-2 text-ink">@{row.handle}</td>
                    <td className="px-3 py-2">
                      <span className={row.tier === "gift_first" ? "text-tan-gold" : "text-secondary-text"}>
                        {row.tier === "gift_first" ? "Gift first" : "Sell first"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-secondary-text">
                      {row.followerCount?.toLocaleString("en-IN") ?? "?"}
                    </td>
                    <td className="px-3 py-2 text-ink">{row.code}</td>
                    <td className="px-3 py-2 font-bold text-ink">{row.ordersDriven}</td>
                    <td className="px-3 py-2 text-secondary-text">{row.qualified ? "Qualified" : "In progress"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading…</p>
      ) : (
        <>
          <Section title={`Awaiting Orders (${pending.length})`}>
            {pending.length === 0 ? (
              <p className="text-body-s text-secondary-text">Nothing pending.</p>
            ) : (
              pending.map((o) => <BarterRow key={o.id} order={o} />)
            )}
          </Section>

          <Section title={`Qualified & Shipped (${qualified.length})`}>
            {qualified.length === 0 ? (
              <p className="text-body-s text-secondary-text">None yet.</p>
            ) : (
              qualified.map((o) => <BarterRow key={o.id} order={o} />)
            )}
          </Section>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border p-4 ${highlight ? "border-tan-gold bg-surface-alt" : "border-divider"}`}>
      <p className="text-micro uppercase tracking-[0.1em] text-secondary-text">{label}</p>
      <p className={`mt-1.5 font-display text-heading-s ${highlight ? "text-tan-gold" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-heading-s uppercase text-ink">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function BarterRow({ order }: { order: BarterOrder }) {
  return (
    <div className="border-t border-divider pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-s font-bold text-ink">
          {order.customer_name} · @{order.barter_instagram_handle} ·{" "}
          {order.barter_follower_count?.toLocaleString("en-IN") ?? "?"} followers
        </p>
        <p className="text-caption text-secondary-text">{formatDate(order.created_at)}</p>
      </div>
      <p className="mt-1 text-caption">
        <span className={order.barter_tier === "gift_first" ? "text-tan-gold" : "text-secondary-text"}>
          {order.barter_tier === "gift_first" ? "Gift first" : "Sell first"}
        </span>
        <span className="text-secondary-text">
          {" "}
          · Code <strong className="text-ink">{order.barter_coupon_code}</strong> · {order.orders_so_far} /{" "}
          {order.barter_required_orders} orders ·{" "}
        </span>
        {order.barter_qualified_at ? (
          <span className="text-tan-gold">
            {order.barter_tier === "gift_first" ? "Shipped on trust" : "Qualified & shipped"}
          </span>
        ) : (
          <span className="text-secondary-text">value ₹{order.total.toLocaleString("en-IN")}</span>
        )}
      </p>
      {order.barter_post_url ? (
        <a href={order.barter_post_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-caption text-ink underline">
          View post
        </a>
      ) : (
        <p className="mt-1 text-caption text-secondary-text">No post link submitted yet.</p>
      )}
    </div>
  );
}
