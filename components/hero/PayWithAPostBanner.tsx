import Link from "next/link";
import { getPwapRules } from "@/lib/pwap-rules";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";
import { GiftFirstUrgencyBadge } from "@/components/checkout/GiftFirstUrgencyBadge";

/**
 * Homepage teaser for the Pay With A Post checkout mechanic — its own
 * distinct treatment rather than another EditorialSplit reusing the same
 * lifestyle photography a third or fourth time, since this is a
 * conversion-driving offer, not mood photography. Mirrors the same
 * two-tier framing used at checkout so a shopper who lands here already
 * knows exactly what to expect once they get there.
 */
export async function PayWithAPostBanner({ launchSoon = false }: { launchSoon?: boolean }) {
  const { salesToShip, salesPerFreeCode } = await getPwapRules();
  return (
    <section id="pay-with-a-post" className="scroll-mt-24 border-t border-divider py-20">
      <div className="mx-auto max-w-[720px] text-center">
        <p className="font-sans text-micro uppercase tracking-[0.3em] text-tan-gold">{launchSoon ? "Launching with the drop" : "New"}</p>
        <h2 className="mt-4 text-heading-l md:text-display-m">
          <PayWithAPostMark />
        </h2>
        <p className="mt-4 font-sans text-body-s text-secondary-text">
          Skip the payment — post about us on Instagram instead.{" "}
          {launchSoon
            ? "It goes live the day we open orders. Get on the list to be first."
            : "Choose it right at checkout, no separate sign-up."}
        </p>

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          <div className="border border-divider bg-surface-alt p-5">
            <p className="font-sans text-body-s font-bold uppercase tracking-[0.02em] text-ink">1. Post</p>
            <p className="mt-1.5 text-caption leading-relaxed text-secondary-text">Share your Moonglasses post with your code.</p>
          </div>
          <div className="border border-divider bg-surface-alt p-5">
            <p className="font-sans text-body-s font-bold uppercase tracking-[0.02em] text-ink">2. {salesToShip} sales</p>
            <p className="mt-1.5 text-caption leading-relaxed text-secondary-text">{salesToShip} people buy with your code.</p>
          </div>
          <div className="border border-divider bg-surface-alt p-5">
            <p className="font-sans text-body-s font-bold uppercase tracking-[0.02em] text-ink">3. Free pair</p>
            <p className="mt-1.5 text-caption leading-relaxed text-secondary-text">We ship your pair. Every {salesPerFreeCode} more = another.</p>
          </div>
        </div>

        <p className="mt-5 text-center font-sans text-body-s text-ink">
          And it keeps going: <strong>every {salesPerFreeCode} more sales on your code = another pair, free.</strong>
        </p>

        {!launchSoon && <GiftFirstUrgencyBadge className="mt-6" />}

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={launchSoon ? "/#join" : "/#shop"}
            className="inline-block border border-ink bg-ink px-8 py-3.5 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
          >
            {launchSoon ? "Get on the list" : <>Shop &amp; <PayWithAPostMark /></>}
          </Link>
          <Link
            href={launchSoon ? "/#shop" : "/"}
            className="font-sans text-body-s text-secondary-text underline underline-offset-4 transition-colors duration-200 hover:text-ink"
          >
            {launchSoon ? "Browse the collection" : "Continue Shopping"}
          </Link>
        </div>
      </div>
    </section>
  );
}
