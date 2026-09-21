import Link from "next/link";

/**
 * Points shoppers at the creator program (/creator/apply) — a SEPARATE
 * mechanic from checkout's own Pay With A Post barter option
 * (PayWithAPostBanner/BarterPostUrlForm, which pays for an already-placed
 * order with a post made afterward). This one is pre-purchase: drop your
 * Instagram handle, get scored/approved (lib/creator-scoring.ts), sign the
 * agreement at /creator/agreement/[id], and the product ships to you free
 * — no payment at all. Kept as its own small teaser rather than merged into
 * the Pay With A Post copy so shoppers don't confuse the two offers.
 */
export function CreatorTeaser({ className = "" }: { className?: string }) {
  return (
    <div className={`border border-divider bg-surface-alt px-5 py-4 text-center ${className}`}>
      <p className="font-sans text-body-s text-ink">
        Want the pair for free? Drop your Instagram before you post — we&rsquo;ll tell you how.
      </p>
      <p className="mt-1 text-caption text-secondary-text">
        5,000+ followers can pick a pair, sign a quick agreement, and we&rsquo;ll ship it to you —
        no payment.
      </p>
      <Link
        href="/creator/apply"
        className="mt-3 inline-block font-sans text-caption font-bold uppercase tracking-[0.1em] text-tan-gold underline underline-offset-4 hover:text-ink"
      >
        Apply As A Creator
      </Link>
    </div>
  );
}
