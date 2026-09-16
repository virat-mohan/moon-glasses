"use client";

import { useEffect, useMemo, useState } from "react";
import { ShipmentCell } from "@/components/admin/ShipmentCell";

type LogisticsOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  delivery_pincode: string | null;
  status: string;
  shipment_status: string | null;
  shiprocket_order_id: string | null;
  shiprocket_shipment_id: string | null;
  shiprocket_awb_code: string | null;
  courier_name: string | null;
};

type Category = "needs_attention" | "not_shipped" | "in_transit" | "delivered" | "other";

const CATEGORY_LABEL: Record<Category, string> = {
  needs_attention: "Needs Attention",
  not_shipped: "Not Shipped",
  in_transit: "In Transit",
  delivered: "Delivered",
  other: "Other",
};

// Priority order matters — "undelivered" contains "delivered" as a
// substring, so RTO/NDR must be checked before the plain-delivered match.
function categorize(order: LogisticsOrder): Category {
  const s = (order.shipment_status ?? "").toLowerCase();
  if (/rto|ndr|undeliver|delivery fail|delivery attempt|not available|consignee/.test(s)) {
    return "needs_attention";
  }
  if (/delivered/.test(s)) return "delivered";
  if (/transit|shipped|picked|out for delivery|dispatch/.test(s)) return "in_transit";
  if (!order.shiprocket_shipment_id || s === "" || s === "not_shipped") return "not_shipped";
  return "other";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default function LogisticsPage() {
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("needs_attention");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/logistics")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/cron/track-sweep");
      const data = await res.json();
      setSyncResult(`Checked ${data.swept ?? 0} shipment(s) against Shiprocket.`);
      load();
    } catch {
      setSyncResult("Could not sync — try again.");
    } finally {
      setSyncing(false);
    }
  }

  const categorized = useMemo(
    () => orders.filter((o) => o.status !== "cancelled").map((o) => ({ order: o, category: categorize(o) })),
    [orders]
  );

  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      needs_attention: 0,
      not_shipped: 0,
      in_transit: 0,
      delivered: 0,
      other: 0,
    };
    categorized.forEach(({ category }) => c[category]++);
    return c;
  }, [categorized]);

  const filtered =
    activeCategory === "all" ? categorized : categorized.filter((c) => c.category === activeCategory);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Logistics</h1>
      <p className="mt-2 max-w-xl text-body-s text-secondary-text">
        Every confirmed order&apos;s shipment status in one place — &ldquo;Needs Attention&rdquo; is where
        a delivery attempt has failed (NDR) or a shipment is on its way back (RTO); that&apos;s the one
        worth checking daily, since a fast follow-up there is what actually prevents a return.
        Statuses refresh automatically once a day — click Sync below to pull the latest right now.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          onClick={syncNow}
          disabled={syncing}
          className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Shipment Status Now"}
        </button>
        {syncResult && <p className="text-caption text-secondary-text">{syncResult}</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-divider pt-6">
        <button
          onClick={() => setActiveCategory("all")}
          className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
            activeCategory === "all" ? "border-ink bg-ink text-cream" : "border-divider text-ink"
          }`}
        >
          All ({categorized.length})
        </button>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              activeCategory === cat
                ? "border-ink bg-ink text-cream"
                : cat === "needs_attention" && counts[cat] > 0
                  ? "border-paint-orange text-paint-orange"
                  : "border-divider text-ink"
            }`}
          >
            {CATEGORY_LABEL[cat]} ({counts[cat]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-body-s text-secondary-text">Nothing here.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-body-s">
            <thead>
              <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Pincode</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Shipment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ order, category }) => (
                <tr key={order.id} className="border-b border-divider/60">
                  <td className="py-2 pr-4 whitespace-nowrap text-secondary-text">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="py-2 pr-4">
                    <div>{order.customer_name}</div>
                    <div className="text-secondary-text">{order.customer_phone}</div>
                  </td>
                  <td className="py-2 pr-4">{order.delivery_pincode ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        category === "needs_attention" ? "font-bold uppercase text-paint-orange" : ""
                      }
                    >
                      {order.shipment_status ?? "Not shipped"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <ShipmentCell
                      orderId={order.id}
                      shiprocketOrderId={order.shiprocket_order_id}
                      shipmentId={order.shiprocket_shipment_id}
                      awbCode={order.shiprocket_awb_code}
                      courierName={order.courier_name}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
