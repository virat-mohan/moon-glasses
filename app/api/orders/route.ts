import { NextResponse } from "next/server";
import { WHATSAPP_ORDERS_DISABLED_MESSAGE } from "@/lib/checkout-rules";

// The old WhatsApp-order route took client-supplied prices and created an
// order with no payment. Storefront orders are UPI only now (founder decision,
// 2 Oct 2026): every order goes through /api/checkout/upi/create-order, which
// prices server-side. Admin manual orders use /api/admin/orders/manual, not
// this route, so nothing legitimate still calls it.
export async function POST() {
  return NextResponse.json({ error: WHATSAPP_ORDERS_DISABLED_MESSAGE }, { status: 410 });
}
