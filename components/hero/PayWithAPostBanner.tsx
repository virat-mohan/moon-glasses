import Link from "next/link";

/**
 * Homepage teaser for the Pay With A Post checkout mechanic — its own
 * distinct treatment rather than another EditorialSplit reusing the same
 * lifestyle photography a third or fourth time, since this is a
 * conversion-driving offer, not mood photography. Mirrors the same
 * two-tier framing used at checkout so a shopper who lands here already
 * knows exactly what to expect once they get there.
 */
export function PayWithAPostBanner() {
  return (
    <section id="pay-with-a-post" className="scroll-mt-24 border-t border-divider py-20">
      <div className="mx-auto max-w-[720px] text-center">
        <p className="font-sans text-micro uppercase tracking-[0.3em] text-tan-gold">New</p>
        <h2 className="mt-4 font-display text-display-m uppercase text-ink">Pay With A Post</h2>
        <p className="mt-4 font-sans text-body-s text-secondary-text">
          Skip the payment — post about us on Instagram instead. Choose it right at checkout, no
          separate sign-up.
        </p>

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
          <div className="border border-divider bg-surface-alt p-5">
            <p className="font-sans text-body-s font-bold uppercase tracking-[0.02em] text-ink">
              Under 5,000 Followers
            </p>
            <p className="mt-1.5 text-caption leading-relaxed text-secondary-text">
              Post first. We ship after 3 sales.
            </p>
          </div>
          <div className="border border-divider bg-surface-alt p-5">
            <p className="font-sans text-body-s font-bold uppercase tracking-[0.02em] text-ink">
              5,000+ Followers
            </p>
            <p className="mt-1.5 text-caption leading-relaxed text-secondary-text">
              We ship first. You post after.
            </p>
          </div>
        </div>

        <Link
          href="/#shop"
          className="mt-10 inline-block border border-ink bg-ink px-8 py-3.5 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
        >
          Shop &amp; Pay With A Post
        </Link>
      </div>
    </section>
  );
}
