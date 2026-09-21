"use client";

import { useEffect, useState } from "react";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default function AdminPostBarterPage() {
  const [orders, setOrders] = useState<BarterOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/post-barter")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []))
      .finally(() => setLoading(false));
  }, []);

  const pending = orders.filter((o) => !o.barter_qualified_at);
  const qualified = orders.filter((o) => o.barter_qualified_at);

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Pay With A Post</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Orders paid for with an Instagram post instead of currency. Ships automatically once a
        customer&apos;s code clears its required-orders line — nothing to approve manually.
      </p>

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
