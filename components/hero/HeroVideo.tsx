import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { CountdownTimer } from "@/components/countdown/CountdownTimer";
import { getDropDateIso, formatDropDateLabel } from "@/lib/dropDate";

/**
 * Full-bleed cinematic hero per MOON_CLAUDE_CODE_PROMPT.md section 6/7 —
 * near-100vh, minimal headline anchored low, CTA black/white depending on
 * hero luminance. Looks for public/images/brand/hero.jpg (see
 * IMAGE_PROMPTS.md for the night/urban/flash shoot spec); falls back to a
 * dark vignette so the layout is correct before that file exists.
 */
export async function Hero() {
  const dropDateIso = await getDropDateIso();
  const isLive = Date.now() >= new Date(dropDateIso).getTime();
  const hasHeroImage = fs.existsSync(path.join(process.cwd(), "public/images/brand/hero.jpg"));

  return (
    <section className="relative -mx-6 mb-20 flex min-h-[100vh] flex-col items-center justify-end overflow-hidden pb-24 md:-mx-12">
      <div
        className="absolute inset-0"
        style={
          hasHeroImage
            ? { backgroundImage: "url(/images/brand/hero.jpg)", backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "radial-gradient(120% 90% at 50% 15%, #1a1a1a 0%, #050505 70%)" }
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <p className="font-sans text-body-s uppercase tracking-[0.15em] text-white/70">
          Light Tints. Big Mood.
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
              className="border border-white px-10 py-4 font-sans text-body-s uppercase tracking-[0.15em] text-white transition-colors hover:bg-white hover:text-black"
            >
              Shop The Collection
            </a>
          ) : (
            <Link
              href="/preorder"
              className="border border-white bg-white px-10 py-4 font-sans text-body-s uppercase tracking-[0.15em] text-black transition-colors hover:bg-transparent hover:text-white"
            >
              Reserve Yours — Pay ₹500
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
