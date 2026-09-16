import Image from "next/image";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

const pillars = [
  { title: "Music Always" },
  { title: "Places Further" },
  { title: "Better People" },
  { title: "A Clearer You" },
];

export default function AboutPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <div className="max-w-2xl">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Our Story</p>
          <h1 className="mt-3 font-display text-heading-xl uppercase leading-[0.95] text-ink md:text-display-m">
            See A Brighter You.
          </h1>

          <div className="mt-8 space-y-6 text-body text-ink">
            <p>
              MOON GLASSES started with a simple problem: fashion eyewear that could actually keep
              up after dark — frames with real personality, lenses with real protection, built for
              a night out rather than a beach chair.
            </p>
            <p>
              Sixteen shapes across two materials at launch — acetate frames at ₹1,499, metal frames at
              ₹1,999. UV400 protected, spring-hinged for all-day comfort, designed to be the piece
              that finishes the outfit, not an afterthought.
            </p>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-12 border-t border-divider pt-16 md:grid-cols-2 md:gap-16">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-alt">
            <Image
              src="/images/team/anun-dhawan.png"
              alt="Anun Dhawan, Founder of MOON GLASSES"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover object-left"
              priority
            />
          </div>

          <div>
            <p className="font-display text-heading-m text-ink">Anun Dhawan</p>
            <p className="mt-1 text-caption uppercase tracking-[0.1em] text-secondary-text">Founder</p>

            <div className="mt-8 space-y-6 text-body text-ink">
              <p>
                MOON GLASSES exists because of three things I can&rsquo;t live without — music,
                movement, and good people.
              </p>
              <p>
                Techno&rsquo;s been my reset button for years. The noise cancels out, everything
                after 1am starts making sense, and the best stuff always happens a little outside
                the plan — a late-night set, a mountain I wasn&rsquo;t supposed to climb, a road
                trip that started as a bad idea.
              </p>
              <p>
                I built MOON for those exact moments — when the night looks a little sharper and
                you want eyewear that keeps up instead of getting in the way.
              </p>
            </div>

            <blockquote className="mt-8 border-l-2 border-[var(--moon-gold)]/50 pl-6 font-sans text-body italic text-white">
              &ldquo;Good Music, Brighter Days.&rdquo;
              <footer className="mt-3 text-caption not-italic uppercase tracking-[0.1em] text-secondary-text">
                — Anun Dhawan, Founder
              </footer>
            </blockquote>

            <div className="mt-10 grid grid-cols-2 gap-4 border-t border-divider pt-8 sm:grid-cols-4">
              {pillars.map((p) => (
                <p
                  key={p.title}
                  className="text-center text-micro uppercase tracking-[0.08em] text-secondary-text"
                >
                  {p.title}
                </p>
              ))}
            </div>
          </div>
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
