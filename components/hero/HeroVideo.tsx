
/**
 * Full-bleed cinematic hero — near-100vh, minimal headline anchored low.
 * Always renders public/images/brand/hero.jpg directly rather than
 * fs-checking for it first: that check is unreliable on Vercel's
 * serverless functions (public/ assets aren't always traced into the
 * function bundle even though they're deployed fine to the CDN), so it was
 * silently failing in production and leaving the hero blank.
 */
export function Hero() {
  return (
    <section className="relative mb-20 flex min-h-[100vh] w-full flex-col items-center justify-end overflow-hidden pb-24">
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
          Light tints, good vibes.
        </p>

        <div className="mt-10">
          <a
            href="#shop"
            className="py-4 font-sans text-body-s uppercase tracking-[0.15em] text-white transition-colors duration-200 hover:text-[var(--moon-gold)]"
          >
            See the edit
          </a>
        </div>
      </div>
    </section>
  );
}
