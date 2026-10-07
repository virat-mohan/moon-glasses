import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getUpiPaymentConfig } from "@/lib/upi-payment";
import { buildUpiLink } from "@/lib/upi-links";
import { PayClient } from "./PayClient";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_URL = "https://www.moon-glasses.store";

export async function generateMetadata({ params }: { params: Promise<{ orderId: string }> }): Promise<Metadata> {
  const { orderId } = await params;
  const orderRef = orderId.slice(0, 8).toUpperCase();

  let itemsSummary = "";
  if (UUID.test(orderId)) {
    try {
      const supabase = getSupabaseServerClient();
      const { data: items } = await supabase
        .from("order_items")
        .select("chapter_name, quantity")
        .eq("order_id", orderId);

      if (items && items.length > 0) {
        itemsSummary = items.map((i) => `${i.quantity}× ${i.chapter_name}`).join(", ");
      }
    } catch {}
  }

  const title = `Your Order #${orderRef} is Ready — Moonglasses`;
  const description = itemsSummary
    ? `Complete payment for ${itemsSummary}. Free Express Delivery across India.`
    : `Your Moonglasses order #${orderRef} is ready. Tap to pay securely via UPI.`;
  const ogImageUrl = `${SITE_URL}/api/og/pay?orderId=${orderId}&v=hd`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "Moonglasses",
      title,
      description,
      url: `${SITE_URL}/pay/${orderId}`,
      images: [
        {
          url: ogImageUrl,
          width: 600,
          height: 600,
          alt: `Moonglasses Order #${orderRef}`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [ogImageUrl],
    },
    robots: { index: false, follow: false },
  };
}

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

  if (order && (order.payment_status === "paid" || Number(order.total) <= 0)) {
    redirect(`/checkout/confirmed?order=${order.id}&paid=1`);
  }

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

  // On mobile devices, render PayClient which automatically triggers the direct UPI app
  // intent (Google Pay, PhonePe, Paytm) with prefilled amount in 1-tap.
  // On social crawlers, render with full OpenGraph tags.
  // On desktop browsers, redirect to the dynamic UPI QR scan screen.
  const headerList = await headers();
  const userAgent = headerList.get("user-agent") || "";
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent);
  const isCrawler = /facebookexternalhit|whatsapp|bot|spider|crawl|slurp|twitterbot|pinterest|discord/i.test(userAgent);

  if (isMobile || isCrawler) {
    return (
      <PayClient
        orderRef={order.id.slice(0, 8).toUpperCase()}
        amount={amount}
        upiId={config.upiId}
        upiLink={upiLink}
        confirmedHref={confirmedHref}
      />
    );
  }

  redirect(confirmedHref);
}
