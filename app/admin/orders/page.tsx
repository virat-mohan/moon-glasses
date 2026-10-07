import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { BankSmsPanel } from "@/components/admin/BankSmsPanel";
import { OpsDigestCard } from "@/components/admin/OpsDigestCard";
import { OrdersBoard } from "@/components/admin/orders/OrdersBoard";
import { warehouseItemNames } from "@/lib/warehouse-names";
import type { AdminOrderRow, OrderItemRow } from "@/lib/admin-orders";

// This page reads live, frequently-changing order data and needs Supabase
// env vars — never prerender it at build time.
export const dynamic = "force-dynamic";

const BASE_COLUMNS =
  "id, created_at, customer_name, customer_phone, total, subtotal, discount_amount, payment_type, payment_status, balance_due, status, shipment_status, refund_status, is_gift, gift_note, shiprocket_order_id, shiprocket_shipment_id, shiprocket_awb_code, shiprocket_label_url, courier_name, razorpay_payment_id, refunded_amount, return_shipment_id, is_post_barter, barter_tier, barter_coupon_code, barter_required_orders, barter_qualified_at, is_test";
// Extra detail for the order panel. If any of these columns is missing in an
// environment, we fall back to BASE_COLUMNS so the page never goes blank.
const DETAIL_COLUMNS =
  "customer_email, delivery_address, delivery_city, delivery_state, delivery_pincode, shipping_charge, coupon_code_used, coupon_discount_amount, referral_discount_amount, loyalty_discount_amount, upi_utr, order_source, delivered_at";

const ORDER_LIMIT = 200;

type RawOrder = Record<string, unknown> & { id: string };

export default async function AdminOrdersPage() {
  let rows: AdminOrderRow[] = [];
  let configError = false;

  try {
    const supabase = getSupabaseServerClient();
    let orders: RawOrder[] = [];
    const full = await supabase
      .from("orders")
      .select(`${BASE_COLUMNS}, ${DETAIL_COLUMNS}`)
      .order("created_at", { ascending: false })
      .limit(ORDER_LIMIT);
    if (full.error) {
      const base = await supabase.from("orders").select(BASE_COLUMNS).order("created_at", { ascending: false }).limit(ORDER_LIMIT);
      orders = (base.data ?? []) as unknown as RawOrder[];
    } else {
      orders = (full.data ?? []) as unknown as RawOrder[];
    }

    const ids = orders.map((o) => o.id);
    const { data: itemData } = ids.length
      ? await supabase.from("order_items").select("order_id, chapter_slug, chapter_name, unit_price, quantity").in("order_id", ids)
      : { data: [] };
    const items = (itemData ?? []) as { order_id: string; chapter_slug: string; chapter_name: string; unit_price: number; quantity: number }[];

    let supplier = new Map<string, { name: string }>();
    try {
      supplier = await warehouseItemNames(items.map((i) => ({ chapter_slug: i.chapter_slug, chapter_name: i.chapter_name })));
    } catch {
      /* warehouse line is a nicety; the order still renders without it */
    }

    const byOrder = new Map<string, OrderItemRow[]>();
    for (const i of items) {
      const long = supplier.get(i.chapter_slug)?.name ?? "";
      const m = long.match(/\((.*)\)\s*$/);
      const list = byOrder.get(i.order_id) ?? [];
      list.push({
        slug: i.chapter_slug,
        name: i.chapter_name,
        qty: i.quantity,
        unitPrice: i.unit_price,
        warehouseLine: m ? m[1] : null,
      });
      byOrder.set(i.order_id, list);
    }

    const barterIds = orders.filter((o) => (o as { is_post_barter?: boolean }).is_post_barter).map((o) => o.id);
    const kitsByOrder = new Map<string, { code: string; sales: number }[]>();
    if (barterIds.length) {
      const { data: kitRows } = await supabase.from("pwap_post_kits").select("order_id, code, sales_count, created_at").in("order_id", barterIds).order("created_at", { ascending: true });
      for (const k of kitRows ?? []) {
        const list = kitsByOrder.get(k.order_id as string) ?? [];
        list.push({ code: String(k.code), sales: Number(k.sales_count ?? 0) });
        kitsByOrder.set(k.order_id as string, list);
      }
    }

    const num = (v: unknown) => Number(v ?? 0) || 0;
    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    rows = orders.map((o) => ({
      id: o.id,
      created_at: String(o.created_at),
      customer_name: String(o.customer_name ?? ""),
      customer_phone: String(o.customer_phone ?? ""),
      customer_email: str(o.customer_email),
      delivery_address: str(o.delivery_address),
      delivery_city: str(o.delivery_city),
      delivery_state: str(o.delivery_state),
      delivery_pincode: str(o.delivery_pincode),
      total: num(o.total),
      subtotal: num(o.subtotal),
      discount_amount: num(o.discount_amount),
      shipping_charge: num(o.shipping_charge),
      coupon_code_used: str(o.coupon_code_used),
      coupon_discount_amount: num(o.coupon_discount_amount),
      referral_discount_amount: num(o.referral_discount_amount),
      loyalty_discount_amount: num(o.loyalty_discount_amount),
      payment_type: str(o.payment_type),
      payment_status: str(o.payment_status),
      balance_due: o.balance_due == null ? null : num(o.balance_due),
      status: String(o.status ?? ""),
      shipment_status: str(o.shipment_status),
      refund_status: str(o.refund_status),
      is_gift: !!o.is_gift,
      gift_note: str(o.gift_note),
      shiprocket_order_id: str(o.shiprocket_order_id),
      shiprocket_shipment_id: str(o.shiprocket_shipment_id),
      shiprocket_awb_code: str(o.shiprocket_awb_code),
      shiprocket_label_url: str(o.shiprocket_label_url),
      courier_name: str(o.courier_name),
      razorpay_payment_id: str(o.razorpay_payment_id),
      refunded_amount: o.refunded_amount == null ? null : num(o.refunded_amount),
      return_shipment_id: str(o.return_shipment_id),
      is_post_barter: o.is_post_barter == null ? null : !!o.is_post_barter,
      barter_tier: str(o.barter_tier),
      barter_coupon_code: str(o.barter_coupon_code),
      barter_required_orders: o.barter_required_orders == null ? null : num(o.barter_required_orders),
      barter_qualified_at: str(o.barter_qualified_at),
      pwap_kits: kitsByOrder.get(o.id) ?? [],
      is_test: o.is_test == null ? null : !!o.is_test,
      upi_utr: str(o.upi_utr),
      order_source: str(o.order_source),
      delivered_at: str(o.delivered_at),
      items: byOrder.get(o.id) ?? [],
    }));
  } catch {
    configError = true;
  }

  if (configError) {
    return (
      <main className="mx-auto w-full max-w-[1400px] px-4 pt-8 pb-24 md:px-12">
        <h1 className="font-display text-heading-l uppercase text-ink">Orders</h1>
        <p className="mt-4 text-body-s text-paint-orange">
          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren&apos;t set in this environment yet — add
          them in Vercel under Project Settings → Environment Variables, then redeploy.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pt-8 pb-24 md:px-12">
      <OpsDigestCard />

      <div className="ord-head">
        <div>
          <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Orders</h1>
          <p className="ord-muted">Every order, newest first. Tap an order to see the customer, items, money and shipping, and to act on it.</p>
        </div>
        <Link href="/admin/orders/new" className="ord-btn ord-btn--solid">
          + Add manual order
        </Link>
      </div>

      <OrdersBoard rows={rows} />
      <BankSmsPanel />
    </main>
  );
}
