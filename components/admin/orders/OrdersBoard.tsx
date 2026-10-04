"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  FILTER_CHIPS,
  chipCounts,
  filterOrders,
  firstName,
  formatShipmentStatus,
  inr,
  isFreeOrder,
  itemsSummary,
  moneyLines,
  orderBucket,
  paidHow,
  paymentPill,
  shipPill,
  shortId,
  sourceOf,
  timeAgo,
  type AdminOrderRow,
  type OrderFilter,
  type Pill,
} from "@/lib/admin-orders";
import { OrderStatusCell } from "@/components/admin/OrderStatusCell";
import { ShipmentStatusCell } from "@/components/admin/ShipmentStatusCell";
import { ShipmentCell } from "@/components/admin/ShipmentCell";
import { RefundActions } from "@/components/admin/RefundActions";
import { MarkUpiPaidButton } from "@/components/admin/MarkUpiPaidButton";
import { SendPaymentLinkButton } from "@/components/admin/SendPaymentLinkButton";

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 768px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
}

function PillView({ pill }: { pill: Pill }) {
  return (
    <span className="ord-pill" data-tone={pill.tone}>
      {pill.label}
    </span>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Chips({ o }: { o: AdminOrderRow }) {
  return (
    <>
      {o.is_test && (
        <span className="ord-pill" data-tone="test" title="Test order: nothing ships, no stock used, not in reports">
          TEST
        </span>
      )}
      <span className="ord-chip">{sourceOf(o)}</span>
    </>
  );
}

function TotalView({ o }: { o: AdminOrderRow }) {
  return (
    <span className="ord-total">
      {inr(o.total)}
      {isFreeOrder(o) && <span className="ord-pill" data-tone="green">free code</span>}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ord-sec">
      <h3 className="ord-sec-title">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ord-kv">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function OrderDetail({ o }: { o: AdminOrderRow }) {
  const cancelled = o.status === "cancelled";
  const upiUnpaid = o.payment_type === "upi_qr" && o.payment_status !== "paid" && !cancelled;
  const bucket = orderBucket(o);
  const address = [o.delivery_address, o.delivery_city, o.delivery_state].filter(Boolean).join(", ");
  const sp = shipPill(o);
  const awbLink = o.shiprocket_awb_code ? `https://shiprocket.co/tracking/${o.shiprocket_awb_code}` : null;
  const timeline: { label: string; value: string; done: boolean }[] = [
    { label: "Order placed", value: when(o.created_at), done: true },
    {
      label: "Paid",
      value: isFreeOrder(o) ? "Free order, nothing to pay" : o.payment_status === "paid" || (o.is_post_barter && !!o.barter_qualified_at) ? "Yes (time is not recorded)" : "Not yet",
      done: isFreeOrder(o) || o.payment_status === "paid" || !!o.barter_qualified_at,
    },
    {
      label: "Shipped",
      value: o.shiprocket_shipment_id ? `Booked with ${o.courier_name ?? "courier"}` : "Not yet",
      done: !!o.shiprocket_shipment_id,
    },
    {
      label: "Delivered",
      value: o.delivered_at ? when(o.delivered_at) : bucket === "delivered" ? "Yes" : "Not yet",
      done: !!o.delivered_at || bucket === "delivered",
    },
  ];

  return (
    <div className="ord-panel">
      <div className="ord-actions">
        <h3 className="ord-sec-title">What you can do</h3>
        <div className="ord-actions-grid">
          {upiUnpaid && <MarkUpiPaidButton orderId={o.id} />}
          {upiUnpaid && <SendPaymentLinkButton orderId={o.id} />}
          {!o.shiprocket_shipment_id && !cancelled && (
            <ShipmentCell
              orderId={o.id}
              shiprocketOrderId={o.shiprocket_order_id}
              shipmentId={o.shiprocket_shipment_id}
              awbCode={o.shiprocket_awb_code}
              courierName={o.courier_name}
            />
          )}
          <RefundActions
            orderId={o.id}
            total={o.total}
            refundedAmount={o.refunded_amount ?? 0}
            hasRazorpayPayment={!!o.razorpay_payment_id}
            returnShipmentId={o.return_shipment_id}
            status={o.status}
            shipmentStatus={o.shipment_status ?? "not_shipped"}
          />
        </div>
      </div>

      <div className="ord-grid">
        <Section title="Customer">
          <dl>
            <Row label="Name" value={o.customer_name} />
            <Row label="Phone" value={<a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a>} />
            <Row label="Email" value={o.customer_email ? <a href={`mailto:${o.customer_email}`}>{o.customer_email}</a> : "Not given"} />
          </dl>
        </Section>

        <Section title="Delivery">
          <dl>
            <Row label="Address" value={address || "Not recorded"} />
            <Row label="Pincode" value={o.delivery_pincode || "Not recorded"} />
            {o.is_gift && <Row label="Gift note" value={o.gift_note || "Gift, no note"} />}
          </dl>
        </Section>

        <Section title="Items">
          <ul className="ord-items">
            {o.items.length === 0 && <li className="ord-muted">No items recorded.</li>}
            {o.items.map((i) => (
              <li key={i.slug}>
                <p className="ord-val">
                  {i.qty} × {i.name} <span className="ord-muted">({inr(i.unitPrice)} each)</span>
                </p>
                {i.warehouseLine && <p className="ord-muted">Warehouse sees: {i.warehouseLine}</p>}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Money">
          <dl>
            {moneyLines(o).map((l) => (
              <div key={l.label} className={`ord-kv${l.strong ? " ord-kv--strong" : ""}`}>
                <dt>{l.label}</dt>
                <dd>{l.amount}</dd>
              </div>
            ))}
            <Row label="How paid" value={paidHow(o)} />
            {o.upi_utr && <Row label="UTR" value={o.upi_utr} />}
            {o.payment_type === "cod_advance" && <Row label="Still to collect" value={inr(o.balance_due ?? 0)} />}
            {o.is_post_barter && o.barter_coupon_code && <Row label="Pay With A Post code" value={o.barter_coupon_code} />}
          </dl>
        </Section>

        <Section title="Shipping">
          <dl>
            <Row label="Status" value={<PillView pill={sp} />} />
            {o.shipment_status && o.shipment_status !== "not_shipped" && <Row label="Courier says" value={formatShipmentStatus(o.shipment_status)} />}
            <Row label="Courier" value={o.courier_name ?? "Not booked yet"} />
            <Row label="AWB" value={o.shiprocket_awb_code ?? "None yet"} />
            {awbLink && <Row label="Tracking" value={<a href={awbLink} target="_blank" rel="noreferrer">Open tracking page</a>} />}
            {o.shiprocket_label_url && <Row label="Label" value={<a href={o.shiprocket_label_url} target="_blank" rel="noreferrer">Open shipping label</a>} />}
          </dl>
          {o.shiprocket_shipment_id && (
            <ShipmentCell
              orderId={o.id}
              shiprocketOrderId={o.shiprocket_order_id}
              shipmentId={o.shiprocket_shipment_id}
              awbCode={o.shiprocket_awb_code}
              courierName={o.courier_name}
            />
          )}
          <p className="ord-muted">Shipping status follows Shiprocket by itself (instantly, plus a check every 30 minutes).</p>
        </Section>

        <Section title="Source">
          <dl>
            <Row label="Came from" value={sourceOf(o)} />
            {o.is_test && <Row label="Test order" value="Nothing ships, no stock used, left out of reports" />}
            <Row label="Documents" value={<Link href={`/invoice/${o.id}`} target="_blank">View invoice</Link>} />
            {o.is_post_barter && <Row label="Customer page" value={<Link href={`/barter/${o.id}`}>Pay With A Post page</Link>} />}
          </dl>
        </Section>

        <Section title="Timeline">
          <ol className="ord-timeline">
            {timeline.map((t) => (
              <li key={t.label} data-done={t.done}>
                <span className="ord-tl-dot" aria-hidden />
                <span className="ord-val">{t.label}</span>
                <span className="ord-muted">{t.value}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <details className="ord-adv">
        <summary>Fix a status by hand (rarely needed)</summary>
        <p className="ord-muted">These only change the label we show. They do not move money or contact the courier.</p>
        <div className="ord-adv-grid">
          <div>
            <p className="ord-label">Order status</p>
            <OrderStatusCell orderId={o.id} field="status" value={o.status} />
          </div>
          <div>
            <p className="ord-label">Shipping status</p>
            <ShipmentStatusCell orderId={o.id} currentLabel={formatShipmentStatus(o.shipment_status ?? "not_shipped")} />
          </div>
          <div>
            <p className="ord-label">Refund</p>
            <p className="ord-val">{(o.refund_status ?? "none").replace(/_/g, " ")}</p>
          </div>
        </div>
      </details>
    </div>
  );
}

function todayIst() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function OrdersBoard({ rows, now }: { rows: AdminOrderRow[]; now?: number }) {
  const desktop = useIsDesktop();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const counts = useMemo(() => chipCounts(rows), [rows]);
  const shown = useMemo(() => filterOrders(rows, { filter, query, from, to }), [rows, filter, query, from, to]);
  const [clock] = useState(() => now ?? Date.now());
  const filtering = filter !== "all" || query || from || to;

  function toggle(id: string) {
    setOpen((cur) => (cur === id ? null : id));
  }

  return (
    <div className="ord-board">
      <div className="ord-chips" role="tablist" aria-label="Filter orders">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={filter === c.key}
            className="ord-fchip"
            onClick={() => setFilter(c.key)}
          >
            {c.label} <b>{counts[c.key]}</b>
          </button>
        ))}
      </div>

      <div className="ord-tools">
        <input
          type="search"
          inputMode="search"
          placeholder="Search name, phone or order id"
          aria-label="Search orders"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ord-input ord-search"
        />
        <label className="ord-date">
          From
          <input type="date" value={from} max={to || todayIst()} onChange={(e) => setFrom(e.target.value)} className="ord-input" />
        </label>
        <label className="ord-date">
          To
          <input type="date" value={to} min={from || undefined} max={todayIst()} onChange={(e) => setTo(e.target.value)} className="ord-input" />
        </label>
        {filtering && (
          <button
            type="button"
            className="ord-btn"
            onClick={() => {
              setFilter("all");
              setQuery("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </button>
        )}
        <button type="submit" form="labels-form" className="ord-btn ord-btn--push">
          Print selected labels (2 per A4)
        </button>
      </div>
      <form id="labels-form" action="/api/admin/orders/print-labels" method="GET" target="_blank" />
      <p className="ord-muted ord-count">
        Showing {shown.length} of {rows.length} recent orders. Tick the box on an order to print its label.
      </p>

      {shown.length === 0 ? (
        <div className="ord-empty">
          <p className="ord-val">{rows.length === 0 ? "No orders yet." : "No orders match these filters."}</p>
          <p className="ord-muted">{rows.length === 0 ? "New orders appear here as soon as they are placed." : "Try another status, or clear the search and dates."}</p>
        </div>
      ) : desktop ? (
        <div className="ord-tablewrap">
          <table className="ord-table">
            <thead>
              <tr>
                <th className="ord-c-check"><span className="sr-only">Print label</span></th>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Shipping</th>
                <th>Source</th>
                <th><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const isOpen = open === o.id;
                const canLabel = (o.shiprocket_label_url || o.shiprocket_shipment_id) && o.status !== "cancelled";
                return (
                  <FragmentRow key={o.id}>
                    <tr className="ord-row" data-open={isOpen}>
                      <td className="ord-c-check">
                        {canLabel && <input type="checkbox" name="ids" value={o.id} form="labels-form" aria-label={`Print label for ${shortId(o.id)}`} className="ord-check" />}
                      </td>
                      <td>
                        <button type="button" className="ord-rowbtn" aria-expanded={isOpen} onClick={() => toggle(o.id)}>
                          <b>{shortId(o.id)}</b>
                          <span className="ord-muted" suppressHydrationWarning>{timeAgo(o.created_at, clock)}</span>
                        </button>
                      </td>
                      <td>{firstName(o.customer_name)}</td>
                      <td>{itemsSummary(o.items)}</td>
                      <td><TotalView o={o} /></td>
                      <td><PillView pill={paymentPill(o)} /></td>
                      <td><PillView pill={shipPill(o)} /></td>
                      <td className="ord-chipcell"><Chips o={o} /></td>
                      <td>
                        <button type="button" className="ord-btn" aria-expanded={isOpen} onClick={() => toggle(o.id)}>
                          {isOpen ? "Hide details" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="ord-detail-row">
                        <td colSpan={9}><OrderDetail o={o} /></td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="ord-cards">
          {shown.map((o) => {
            const isOpen = open === o.id;
            const canLabel = (o.shiprocket_label_url || o.shiprocket_shipment_id) && o.status !== "cancelled";
            return (
              <li key={o.id} className="ord-card" data-open={isOpen}>
                <div className="ord-card-top">
                  {canLabel && <input type="checkbox" name="ids" value={o.id} form="labels-form" aria-label={`Print label for ${shortId(o.id)}`} className="ord-check" />}
                  <button type="button" className="ord-cardbtn" aria-expanded={isOpen} onClick={() => toggle(o.id)}>
                    <span className="ord-card-line1">
                      <b>{firstName(o.customer_name)}</b>
                      <TotalView o={o} />
                    </span>
                    <span className="ord-card-line2">
                      <span>{shortId(o.id)}</span>
                      <span suppressHydrationWarning>{timeAgo(o.created_at, clock)}</span>
                    </span>
                    <span className="ord-card-items">{itemsSummary(o.items)}</span>
                    <span className="ord-card-pills">
                      <PillView pill={paymentPill(o)} />
                      <PillView pill={shipPill(o)} />
                      <Chips o={o} />
                    </span>
                    <span className="ord-card-more">{isOpen ? "Hide details" : "Tap for details"}</span>
                  </button>
                </div>
                {isOpen && <OrderDetail o={o} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
