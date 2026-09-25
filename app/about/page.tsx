import Image from "next/image";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function AboutPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <div className="max-w-2xl">
          <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
            The Moon Way — Two Founders, A Small Edit, Only The Pairs We Would Actually Wear
          </p>
          <h1 className="mt-3 font-display text-heading-xl uppercase leading-[0.95] text-ink md:text-display-m">
            See A Brighter You.
          </h1>

          <div className="mt-8 space-y-6 text-body text-ink">
            <p>
              We started Moon Glasses because we like light tints, that&rsquo;s our vibe and if
              you&rsquo;re here we believe it&rsquo;s yours too.
            </p>
            <p>The idea is simple, fewer choices, the kinds you try and keep reaching for.</p>
            <p>
              There are two of us behind Moon Glasses, and we keep the edit small for a reason:
              every pair has to feel like something we would actually wear.
            </p>
            <p>No big fashion speech. Just good-looking glasses with an easy mood.</p>
            <p>If it made the cut, it&rsquo;s here. Just like you did.</p>
          </div>
        </div>

        <p className="mt-24 border-t border-divider pt-16 text-caption uppercase tracking-[0.15em] text-secondary-text">
          The People Behind Moonglasses
        </p>

        <div className="mt-8 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
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
            <p className="mt-1 text-caption uppercase tracking-[0.1em] text-secondary-text">
              Founder &amp; Inspiration
            </p>

            <div className="mt-8 space-y-6 text-body text-ink">
              <p>
                MOON GLASSES exists because of three things I love — music, people and the
                outdoors.
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
                — Anun Dhawan, Founder &amp; Inspiration
              </footer>
            </blockquote>

            <div className="mt-10 border-t border-divider pt-8">
              <p className="text-center text-micro uppercase tracking-[0.15em] text-secondary-text">
                Good Music And Vibes Always!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 border-t border-divider pt-10 sm:grid-cols-[420px_1fr] sm:items-center sm:gap-10">
          <div className="relative aspect-[4/5] w-full max-w-[420px] overflow-hidden bg-surface-alt">
            <Image
              src="/images/team/virat-mohan.png"
              alt="Virat Mohan, Co-Founder & AI Enabler of MOON GLASSES"
              fill
              sizes="420px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-display text-heading-m text-ink">Virat Mohan</p>
            <p className="mt-1 text-caption uppercase tracking-[0.1em] text-secondary-text">
              Co-Founder And AI Enabler
            </p>
            <p className="mt-4 text-body-s text-ink">Powering D2C businesses with AI.</p>
            <a
              href="https://www.viratmohan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-caption uppercase tracking-[0.1em] text-ink underline underline-offset-4 transition-colors hover:text-[var(--moon-gold)]"
            >
              viratmohan.com
            </a>
          </div>
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
