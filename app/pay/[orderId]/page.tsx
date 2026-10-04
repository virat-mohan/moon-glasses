import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getUpiPaymentConfig } from "@/lib/upi-payment";
import { buildUpiLink } from "@/lib/upi-links";

export const metadata: Metadata = { title: "Pay for your order · Moonglasses", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tap-to-pay for a WhatsApp order. The amount and link come from the order row, never from the URL. */
export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { data: order } = UUID.test(orderId)
    ? await getSupabaseServerClient()
        .from("orders")
        .select("id, total, payment_type, payment_status, upi_amount_paise, is_test")
        .eq("id", orderId)
        .maybeSingle()
    : { data: null };
  const config = order ? await getUpiPaymentConfig() : null;

  if (order && (order.payment_status === "paid" || Number(order.total) <= 0)) redirect(`/checkout/confirmed?order=${order.id}&paid=1`);

  if (!order || order.payment_type !== "upi_qr" || !order.upi_amount_paise || !config) {
    return (
      <main className="mx-auto w-full max-w-[480px] px-6 pb-24 pt-32 text-center">
        <h1 className="font-display text-heading-xl uppercase text-ink">Link Not Found.</h1>
        <p className="mt-4 text-body text-secondary-text">
          We couldn&apos;t find that order. The catalogue is a good place to start again, or message us on WhatsApp and we&apos;ll sort it.
        </p>
        <Link href="/catalogue" className="mt-6 inline-flex min-h-[44px] items-center border border-ink px-6 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink">
          See the catalogue
        </Link>
      </main>
    );
  }

  const amountPaise = order.upi_amount_paise as number;
  const upiLink = buildUpiLink({ upiId: config.upiId, payeeName: config.payeeName, amountPaise, orderId: order.id });
  const amount = amountPaise / 100;
  const confirmedHref =
    `/checkout/confirmed?order=${order.id}&upi=1&amount=${order.total}&upiId=${encodeURIComponent(config.upiId)}` +
    `&qr=${encodeURIComponent(config.qrImageUrl ?? "")}&link=${encodeURIComponent(upiLink)}`;

  redirect(confirmedHref);
}
