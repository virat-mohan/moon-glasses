import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { OrderStatusCell } from "@/components/admin/OrderStatusCell";
import { BankSmsPanel } from "@/components/admin/BankSmsPanel";
import { ShipmentStatusCell } from "@/components/admin/ShipmentStatusCell";
import { ShipmentCell } from "@/components/admin/ShipmentCell";
import { RefundActions } from "@/components/admin/RefundActions";
import { OpsDigestCard } from "@/components/admin/OpsDigestCard";
import { MarkUpiPaidButton } from "@/components/admin/MarkUpiPaidButton";

// This page reads live, frequently-changing order data and needs Supabase
// env vars — never prerender it at build time.
export const dynamic = "force-dynamic";

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  not_shipped: "Not Shipped",
  processing: "Processing",
  ready_to_ship: "Ready To Ship",
  pickup_pending: "Pickup Pending",
};

/**
 * "processing"/"ready_to_ship"/"pickup_pending" are our own local statuses,
 * written by lib/order-shipping.ts before Shiprocket has any real tracking
 * data yet (their tracking API stays empty until the courier actually scans
 * the parcel). Anything else is whatever raw status string Shiprocket's own
 * tracking API/webhook reported (see lib/shiprocket-status.ts) — title-cased
 * as a reasonable fallback rather than requiring every possible courier
 * status string to be hand-mapped here.
 */
function formatShipmentStatus(raw: string) {
  if (SHIPMENT_STATUS_LABELS[raw]) return SHIPMENT_STATUS_LABELS[raw];
  return raw
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

type Tone = "gold" | "cobalt" | "orange" | "muted" | "green";
const TONE_CLASS: Record<Tone, string> = {
  gold: "bg-tan-gold/20 text-tan-gold",
  cobalt: "bg-[#2f4a7a]/30 text-[#9fb6e0]",
  orange: "bg-paint-orange/15 text-paint-orange",
  muted: "bg-ink/10 text-secondary-text",
  green: "bg-[#1f6b3a]/30 text-[#8fd6a8]",
};

/** One plain-English status per order, derived from payment + Shiprocket's live shipping status. */
function orderView(o: {
  status: string;
  payment_type: string | null;
  payment_status: string | null;
  shipment_status: string | null;
  is_post_barter: boolean | null;
  barter_qualified_at: string | null;
  barter_tier: string | null;
}): { label: string; tone: Tone; sub?: string } {
  const ship = (o.shipment_status ?? "not_shipped").toLowerCase();
  if (o.status === "cancelled" || /cancel/.test(ship)) return { label: "Cancelled", tone: "muted" };
  if (o.payment_type === "upi_qr" && o.payment_status !== "paid") return { label: "Awaiting payment", tone: "orange" };
  if (o.is_post_barter && o.barter_tier === "sell_first" && !o.barter_qualified_at)
    return { label: "Waiting for posts", tone: "orange" };
  if (/rto/.test(ship)) return { label: "Returning (RTO)", tone: "orange", sub: formatShipmentStatus(o.shipment_status ?? "") };
  if (/undeliver|ndr|failed/.test(ship)) return { label: "Delivery issue", tone: "orange", sub: formatShipmentStatus(o.shipment_status ?? "") };
  if (/delivered/.test(ship)) return { label: "Delivered", tone: "green" };
  if (/out for delivery/.test(ship)) return { label: "Out for delivery", tone: "cobalt" };
  if (/transit|picked|shipped|dispatch/.test(ship)) return { label: "In transit", tone: "cobalt", sub: formatShipmentStatus(o.shipment_status ?? "") };
  if (["processing", "ready_to_ship", "pickup_pending", "pickup scheduled", "manifested"].some((k) => ship.includes(k)))
    return { label: "Awaiting pickup", tone: "gold" };
  if (ship === "not_shipped") return { label: "Paid · to ship", tone: "gold" };
  return { label: formatShipmentStatus(o.shipment_status ?? ""), tone: "cobalt" };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminOrdersPage() {
  let orders: {
    id: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    total: number;
    subtotal: number;
    discount_amount: number;
    payment_type: string | null;
    payment_status: string | null;
    balance_due: number | null;
    status: string;
    shipment_status: string | null;
    refund_status: string | null;
    is_gift: boolean;
    gift_note: string | null;
    shiprocket_order_id: string | null;
    shiprocket_shipment_id: string | null;
    shiprocket_awb_code: string | null;
    shiprocket_label_url: string | null;
    courier_name: string | null;
    razorpay_payment_id: string | null;
    refunded_amount: number | null;
    return_shipment_id: string | null;
    is_post_barter: boolean | null;
    barter_tier: string | null;
    barter_coupon_code: string | null;
    barter_required_orders: number | null;
    barter_qualified_at: string | null;
  }[] = [];
  let configError = false;

  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, total, subtotal, discount_amount, payment_type, payment_status, balance_due, status, shipment_status, refund_status, is_gift, gift_note, shiprocket_order_id, shiprocket_shipment_id, shiprocket_awb_code, shiprocket_label_url, courier_name, razorpay_payment_id, refunded_amount, return_shipment_id, is_post_barter, barter_tier, barter_coupon_code, barter_required_orders, barter_qualified_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    orders = data ?? [];
  } catch {
    configError = true;
  }

  if (configError) {
    return (
      <main className="mx-auto w-full max-w-[1400px] px-6 pt-28 pb-24 md:px-12">
        <h1 className="font-display text-heading-l uppercase text-ink">Orders</h1>
        <p className="mt-4 text-body-s text-paint-orange">
          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren&apos;t set in this environment yet — add
          them in Vercel under Project Settings → Environment Variables, then redeploy.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 pt-28 pb-24 md:px-12">
      <OpsDigestCard />

      <div className="flex items-center justify-between">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">
          Orders ({orders?.length ?? 0})
        </h1>
        <Link
          href="/admin/orders/new"
          className="border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
        >
          + Add Manual Order
        </Link>
      </div>

      <form action="/api/admin/orders/print-labels" method="GET" target="_blank" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-secondary-text">
            Shipping status updates itself from Shiprocket (instantly, plus a check every 30 min).
          </p>
          <button
            type="submit"
            className="border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
          >
            Print Selected Labels (2 Per A4)
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-divider text-micro uppercase tracking-[0.08em] text-secondary-text">
                <th className="w-8 py-2"></th>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Shipping</th>
                <th className="py-2 text-right">More</th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => {
                const view = orderView(o);
                return (
                  <tr key={o.id} className="border-b border-divider align-top">
                    <td className="py-3">
                      {(o.shiprocket_label_url || o.shiprocket_shipment_id) && o.status !== "cancelled" && (
                        <input type="checkbox" name="ids" value={o.id} className="mt-1 h-4 w-4 accent-ink" />
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-sans text-body-s text-ink">{o.customer_name}</p>
                      <p className="text-micro text-secondary-text">
                        #{o.id.slice(0, 8).toUpperCase()} · {formatDate(o.created_at)}
                      </p>
                      <p className="text-micro text-secondary-text">{o.customer_phone}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-sans text-body-s text-ink">₹{o.total?.toLocaleString("en-IN")}</p>
                      {o.discount_amount ? (
                        <p className="text-micro text-tan-gold">−₹{o.discount_amount.toLocaleString("en-IN")} off</p>
                      ) : null}
                      {o.is_gift && <p className="text-micro text-secondary-text">Gift</p>}
                    </td>
                    <td className="py-3 pr-4 text-caption">
                      {o.payment_type === "upi_qr" ? (
                        o.payment_status === "paid" ? (
                          <span className="text-tan-gold">UPI · Paid</span>
                        ) : o.status === "cancelled" ? (
                          <span className="text-secondary-text">UPI · Unpaid</span>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-bold text-paint-orange">UPI · Unpaid</span>
                            <MarkUpiPaidButton orderId={o.id} />
                          </div>
                        )
                      ) : o.payment_type === "cod_advance" ? (
                        <span className="font-bold text-paint-orange">COD · ₹{o.balance_due?.toLocaleString("en-IN")} due</span>
                      ) : o.is_post_barter ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={o.barter_qualified_at ? "text-tan-gold" : "font-bold text-paint-orange"}>
                            Pay With A Post · {o.barter_tier === "gift_first" ? "Gift First" : "Sell First"}
                          </span>
                          {o.barter_coupon_code && (
                            <span className="text-micro text-secondary-text">
                              Code {o.barter_coupon_code}
                              {o.barter_tier === "sell_first" && !o.barter_qualified_at ? ` · needs ${o.barter_required_orders}` : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-secondary-text">Prepaid</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block px-2 py-0.5 text-micro font-bold uppercase tracking-[0.05em] ${TONE_CLASS[view.tone]}`}>
                        {view.label}
                      </span>
                      {view.sub && <p className="mt-1 text-micro text-secondary-text">{view.sub}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      {o.status === "cancelled" && !o.shiprocket_shipment_id ? (
                        <span className="text-micro text-secondary-text">—</span>
                      ) : (
                        <ShipmentCell
                          orderId={o.id}
                          shiprocketOrderId={o.shiprocket_order_id}
                          shipmentId={o.shiprocket_shipment_id}
                          awbCode={o.shiprocket_awb_code}
                          courierName={o.courier_name}
                        />
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <details className="relative inline-block text-left">
                        <summary className="cursor-pointer list-none border border-divider px-2 py-1 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink">
                          More
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 w-64 space-y-3 border border-divider bg-[var(--moon-black)] p-3 shadow-lg">
                          <Link href={`/invoice/${o.id}`} target="_blank" className="block text-caption text-ink underline">
                            View invoice
                          </Link>
                          {o.is_post_barter && (
                            <Link href={`/barter/${o.id}`} className="block text-caption text-ink underline">
                              Customer&apos;s Pay With A Post page
                            </Link>
                          )}
                          {o.is_gift && <p className="text-caption text-secondary-text">Gift note: {o.gift_note || "—"}</p>}
                          <div>
                            <p className="mb-1 text-micro uppercase text-secondary-text">Order status (manual)</p>
                            <OrderStatusCell orderId={o.id} field="status" value={o.status} />
                          </div>
                          <div>
                            <p className="mb-1 text-micro uppercase text-secondary-text">Shipping status (manual)</p>
                            <ShipmentStatusCell orderId={o.id} currentLabel={formatShipmentStatus(o.shipment_status ?? "not_shipped")} />
                          </div>
                          <div>
                            <p className="mb-1 text-micro uppercase text-secondary-text">
                              Refund: {(o.refund_status ?? "none").replace(/_/g, " ")}
                            </p>
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
                      </details>
                    </td>
                  </tr>
                );
              })}
              {(!orders || orders.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-body-s text-secondary-text">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
      <BankSmsPanel />
    </main>
  );
}
