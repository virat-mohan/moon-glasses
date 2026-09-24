"use client";

import { useEffect, useState } from "react";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";
import { PostBarterToggle } from "@/components/admin/PostBarterToggle";

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
  barter_post_source: "story" | "mention" | "collab" | null;
  barter_post_detected_at: string | null;
  barter_qualified_at: string | null;
  total: number;
  orders_so_far: number;
  delivered_at: string | null;
  barter_charge_deadline_at: string | null;
  barter_charge_link_sent_at: string | null;
  barter_charged_at: string | null;
};

type LeaderboardRow = {
  handle: string | null;
  tier: "gift_first" | "sell_first";
  followerCount: number | null;
  code: string | null;
  ordersDriven: number;
  qualified: boolean;
};

type Mention = {
  id: string;
  kind: "story" | "mention" | "collab";
  ig_username: string | null;
  permalink: string | null;
  media_ref: string | null;
  caption: string | null;
  matched_order_id: string | null;
  reposted_at: string | null;
  created_at: string;
};

const SOURCE_LABEL = { story: "Story mention", mention: "Caption mention", collab: "Collab post" } as const;

type Stats = {
  postedCount: number;
  autoDetectedCount: number;
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
  const [mentions, setMentions] = useState<Mention[]>([]);
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
        setMentions(data.mentions ?? []);
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

      <PostBarterToggle />

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
          <StatCard
            label="Posted (auto-detected)"
            value={`${stats.postedCount.toLocaleString("en-IN")} (${stats.autoDetectedCount.toLocaleString("en-IN")})`}
          />
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-display text-heading-s uppercase text-ink">Instagram Mentions</h2>
        <p className="mt-1 text-caption text-secondary-text">
          Stories and posts that mention @moonglassesonline, picked up automatically. Stories are saved the moment they
          arrive, since Instagram deletes them after 24 hours.
        </p>
        {mentions.length === 0 ? (
          <p className="mt-3 text-caption text-secondary-text">Nothing picked up yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-divider">
            <table className="w-full text-left text-caption">
              <thead className="border-b border-divider text-secondary-text">
                <tr>
                  <th className="p-3 font-normal">When</th>
                  <th className="p-3 font-normal">Who</th>
                  <th className="p-3 font-normal">Type</th>
                  <th className="p-3 font-normal">Matched order</th>
                  <th className="p-3 font-normal">Proof</th>
                  <th className="p-3 font-normal" />
                </tr>
              </thead>
              <tbody>
                {mentions.map((m) => (
                  <tr key={m.id} className="border-b border-divider last:border-b-0">
                    <td className="p-3 text-secondary-text">{formatDate(m.created_at)}</td>
                    <td className="p-3 text-ink">{m.ig_username ? `@${m.ig_username}` : "unknown"}</td>
                    <td className="p-3 text-ink">{SOURCE_LABEL[m.kind]}</td>
                    <td className="p-3">{m.matched_order_id ? <span className="text-tan-gold">Yes</span> : <span className="text-secondary-text">No barter order</span>}</td>
                    <td className="p-3">
                      {m.permalink || m.media_ref ? (
                        <a href={m.permalink ?? m.media_ref ?? undefined} target="_blank" rel="noreferrer" className="text-ink underline">
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {m.kind === "story" && m.media_ref && <RepostButton mention={m} onDone={load} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
      ) : null}
      {order.barter_post_url && order.barter_post_source ? (
        <p className="text-caption text-tan-gold">
          Auto-detected · {SOURCE_LABEL[order.barter_post_source]}
          {order.barter_post_detected_at ? ` · ${formatDate(order.barter_post_detected_at)}` : ""}
        </p>
      ) : order.barter_post_url ? (
        <p className="text-caption text-secondary-text">Link submitted by customer</p>
      ) : (
        <p className="mt-1 text-caption text-secondary-text">No post link submitted yet.</p>
      )}
      {order.barter_tier === "gift_first" && !order.barter_post_url && <DeadlineStatus order={order} />}
    </div>
  );
}

function DeadlineStatus({ order }: { order: BarterOrder }) {
  if (order.barter_charged_at) {
    return <p className="mt-1 text-caption text-tan-gold">Charged full price ✓ ({formatDate(order.barter_charged_at)})</p>;
  }
  if (order.barter_charge_link_sent_at) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <p className="text-caption text-paint-orange">
          Deadline missed — charge link sent {formatDate(order.barter_charge_link_sent_at)}
        </p>
        <MarkBarterChargedButton orderId={order.id} />
      </div>
    );
  }
  if (order.barter_charge_deadline_at) {
    const passed = new Date(order.barter_charge_deadline_at) < new Date();
    return (
      <p className={`mt-1 text-caption ${passed ? "text-paint-orange" : "text-secondary-text"}`}>
        {passed ? "Deadline passed — " : "Must post by "}
        {new Date(order.barter_charge_deadline_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
      </p>
    );
  }
  if (!order.delivered_at) {
    return <p className="mt-1 text-caption text-secondary-text">Not yet delivered — 12h window starts on delivery.</p>;
  }
  return null;
}

function MarkBarterChargedButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "confirming" | "done" | "error">("idle");

  async function confirm() {
    if (!window.confirm("Confirm you've actually seen this payment land in your account?")) return;
    setState("confirming");
    try {
      const res = await fetch(`/api/admin/post-barter/${orderId}/mark-charged`, { method: "POST" });
      if (!res.ok) throw new Error();
      setState("done");
      window.location.reload();
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <span className="text-micro text-tan-gold">Charged ✓</span>;

  return (
    <button
      onClick={confirm}
      disabled={state === "confirming"}
      className="border border-ink px-2 py-1 font-sans text-micro font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
    >
      {state === "confirming" ? "Confirming…" : state === "error" ? "Retry Mark Charged" : "Mark Charged"}
    </button>
  );
}

function RepostButton({ mention, onDone }: { mention: Mention; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (mention.reposted_at) return <span className="text-tan-gold">Reposted</span>;
  return (
    <span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/admin/instagram/repost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mentionId: mention.id }),
          });
          const d = await res.json().catch(() => null);
          setBusy(false);
          if (!res.ok) setError(d?.error ?? "Repost failed");
          else onDone();
        }}
        className="border border-ink px-2 py-1 uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
      >
        {busy ? "Posting…" : "Repost to our Story"}
      </button>
      {error && <span className="ml-2 text-paint-orange">{error}</span>}
    </span>
  );
}
