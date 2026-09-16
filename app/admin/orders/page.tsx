import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { OrderStatusCell } from "@/components/admin/OrderStatusCell";
import { ShipmentStatusCell } from "@/components/admin/ShipmentStatusCell";
import { ShipmentCell } from "@/components/admin/ShipmentCell";
import { RefundActions } from "@/components/admin/RefundActions";
import { OpsDigestCard } from "@/components/admin/OpsDigestCard";

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
  }[] = [];
  let configError = false;

  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, total, subtotal, discount_amount, payment_type, balance_due, status, shipment_status, refund_status, is_gift, gift_note, shiprocket_order_id, shiprocket_shipment_id, shiprocket_awb_code, shiprocket_label_url, courier_name, razorpay_payment_id, refunded_amount, return_shipment_id"
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
        <button
          type="submit"
          className="mb-3 border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
        >
          Print Selected Labels (2 Per A4)
        </button>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-2"></th>
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Subtotal</th>
              <th className="py-2 pr-4">Discount</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Payment</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Shipping Status</th>
              <th className="py-2 pr-4">Shipping</th>
              <th className="py-2 pr-4">Refund</th>
              <th className="py-2 pr-4">Actions</th>
              <th className="py-2 pr-4">Invoice</th>
              <th className="py-2 pr-4">Gift</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="border-b border-divider">
                <td className="py-3 pr-2">
                  {(o.shiprocket_label_url || o.shiprocket_shipment_id) && (
                    <input type="checkbox" name="ids" value={o.id} className="h-4 w-4 accent-ink" />
                  )}
                </td>
                <td className="py-3 text-caption text-secondary-text">
                  {formatDate(o.created_at)}
                </td>
                <td className="py-3 font-sans text-body-s text-ink">{o.customer_name}</td>
                <td className="py-3 text-caption text-secondary-text">{o.customer_phone}</td>
                <td className="py-3 text-caption text-secondary-text">
                  ₹{o.subtotal?.toLocaleString("en-IN")}
                </td>
                <td className="py-3 text-caption text-tan-gold">
                  {o.discount_amount ? `−₹${o.discount_amount.toLocaleString("en-IN")}` : "—"}
                </td>
                <td className="py-3 font-sans text-body-s text-ink">
                  ₹{o.total?.toLocaleString("en-IN")}
                </td>
                <td className="py-3 text-caption">
                  {o.payment_type === "cod_advance" ? (
                    <span className="font-bold text-paint-orange">
                      COD · ₹{o.balance_due?.toLocaleString("en-IN")} due
                    </span>
                  ) : (
                    <span className="text-secondary-text">Prepaid</span>
                  )}
                </td>
                <td className="py-3">
                  <OrderStatusCell orderId={o.id} field="status" value={o.status} />
                </td>
                <td className="py-3 text-caption text-secondary-text">
                  <ShipmentStatusCell orderId={o.id} currentLabel={formatShipmentStatus(o.shipment_status ?? "not_shipped")} />
                </td>
                <td className="py-3">
                  <ShipmentCell
                    orderId={o.id}
                    shiprocketOrderId={o.shiprocket_order_id}
                    shipmentId={o.shiprocket_shipment_id}
                    awbCode={o.shiprocket_awb_code}
                    courierName={o.courier_name}
                  />
                </td>
                <td className="py-3 text-caption text-secondary-text">
                  {(o.refund_status ?? "none").replace(/_/g, " ")}
                </td>
                <td className="py-3">
                  <RefundActions
                    orderId={o.id}
                    total={o.total}
                    refundedAmount={o.refunded_amount ?? 0}
                    hasRazorpayPayment={!!o.razorpay_payment_id}
                    returnShipmentId={o.return_shipment_id}
                    status={o.status}
                    shipmentStatus={o.shipment_status ?? "not_shipped"}
                  />
                </td>
                <td className="py-3">
                  <Link
                    href={`/invoice/${o.id}`}
                    target="_blank"
                    className="text-micro text-secondary-text underline"
                  >
                    View
                  </Link>
                </td>
                <td className="py-3 text-caption text-secondary-text">
                  {o.is_gift ? o.gift_note || "Yes" : "—"}
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={15} className="py-8 text-center text-body-s text-secondary-text">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </form>
    </main>
  );
}
