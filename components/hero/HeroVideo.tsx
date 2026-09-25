import Link from "next/link";
import { CountdownTimer } from "@/components/countdown/CountdownTimer";
import { getDropDateIso, formatDropDateLabel } from "@/lib/dropDate";

/**
 * Full-bleed cinematic hero — near-100vh, minimal headline anchored low.
 * Always renders public/images/brand/hero.jpg directly rather than
 * fs-checking for it first: that check is unreliable on Vercel's
 * serverless functions (public/ assets aren't always traced into the
 * function bundle even though they're deployed fine to the CDN), so it was
 * silently failing in production and leaving the hero blank.
 */
export async function Hero() {
  const dropDateIso = await getDropDateIso();
  const isLive = Date.now() >= new Date(dropDateIso).getTime();

  return (
    <section className="relative -mx-6 mb-20 flex min-h-[100vh] flex-col items-center justify-end overflow-hidden pb-24 md:-mx-12">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/images/brand/hero.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <p className="font-sans text-body-s uppercase tracking-[0.15em] text-white/70">
          Light Tints. Good Vibes.
        </p>

        {!isLive && (
          <div className="mt-10">
            <CountdownTimer targetIso={dropDateIso} label={`Drops ${formatDropDateLabel(dropDateIso)}`} />
          </div>
        )}

        <div className="mt-10">
          {isLive ? (
            <a
              href="#shop"
              className="py-4 font-sans text-body-s uppercase tracking-[0.15em] text-white transition-colors duration-200 hover:text-[var(--moon-gold)]"
            >
              Shop The Collection
            </a>
          ) : (
            <Link
              href="/preorder"
              className="py-4 font-sans text-body-s uppercase tracking-[0.15em] text-white transition-colors duration-200 hover:text-[var(--moon-gold)]"
            >
              Reserve Yours — Pay ₹500
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
