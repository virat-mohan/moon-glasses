import Image from "next/image";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getUpiPaymentConfig } from "@/lib/upi-payment";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";

export const dynamic = "force-dynamic";

/**
 * Reached from the payment-link email/WhatsApp sent by
 * app/api/cron/barter-charge-sweep when a gift_first order missed its
 * 12-hour-post-after-delivery deadline (accepted as a binding term at
 * checkout — see barter_terms_accepted_at). No live payment gateway is
 * active, so this mirrors the standalone UPI QR flow (lib/upi-payment.ts)
 * rather than a real payment-link API: the shopper pays by QR, then an
 * admin confirms it landed (see /admin/post-barter's "Mark Charged").
 */
export default async function BarterChargePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_name, total, is_post_barter, barter_tier, barter_charged_at, payment_status")
    .eq("id", orderId)
    .eq("is_post_barter", true)
    .maybeSingle();
  if (!order) notFound();

  const alreadyCharged = order.barter_charged_at || order.payment_status === "paid";
  const upiConfig = await getUpiPaymentConfig();

  return (
    <main className="mx-auto w-full max-w-[560px] px-6 pt-32 pb-24 text-center md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        <PayWithAPostMark />
      </p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Hi, {order.customer_name}</h1>

      {alreadyCharged ? (
        <div className="mt-8 border border-divider p-6">
          <p className="text-body-s text-ink">This has already been settled — thanks.</p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-body-s text-secondary-text">
            Your order shipped on trust, and the 12-hour window to post about it after delivery (agreed to
            at checkout) has passed without a post link being submitted. As agreed, here&apos;s the payment
            for the full order value.
          </p>

          {upiConfig ? (
            <div className="mt-8 flex flex-col items-center gap-3 border border-divider p-6">
              <Image
                src={upiConfig.qrImageUrl}
                alt="Scan to pay via UPI"
                width={220}
                height={264}
                className="border border-ink/20"
              />
              <p className="text-caption text-secondary-text">UPI ID: {upiConfig.upiId}</p>
              <p className="font-display text-heading-s text-ink">₹{order.total.toLocaleString("en-IN")}</p>

              <div className="mt-6 w-full border-t border-divider pt-5">
                <p className="text-body-s font-bold text-ink">Already paid?</p>
                <p className="mt-1.5 text-caption text-secondary-text">
                  Send us a quick WhatsApp with your order details so we can confirm it and close this out.
                </p>
                <a
                  href={`https://wa.me/919318311657?text=${encodeURIComponent(
                    `Hi! I've just paid ₹${order.total.toLocaleString("en-IN")} for my Pay With A Post order (Order #${order.id.slice(0, 8).toUpperCase()}) since I missed the 12-hour posting window. Please confirm — thanks!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block border border-ink px-6 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
                >
                  Notify Us On WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-body-s text-secondary-text">
              Payment isn&apos;t set up on this link yet — reach out to us on WhatsApp and we&apos;ll sort
              it directly.
            </p>
          )}

          <p className="mt-6 text-caption text-secondary-text">
            Posted already, or about to? Drop the link on your order page and this charge won&apos;t go
            through.
          </p>
        </>
      )}
    </main>
  );
}
