"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { chapters, chapterImageSrc } from "@/lib/chapters";

type MapPin = {
  chapterSlug: string;
  blurb: string;
  x: number;
  y: number;
};

function chapterFor(slug: string) {
  return chapters.find((c) => c.slug === slug);
}

// Real-world locations tied to each Chapter's story — a scattered collection
// across the map. Coordinates are calibrated against the actual landmasses
// drawn in world-map-clay.png, not literal lat/long.
const PINS: MapPin[] = [
  { chapterSlug: "city-slicker", blurb: "New York — a new skyline and a coffee you haven't tried yet.", x: 26.82, y: 42.53 },
  { chapterSlug: "city-slicker-black", blurb: "Tokyo — same city energy, hours later, once the lights take over.", x: 82.09, y: 45.55 },
  { chapterSlug: "moonglasses-ocean", blurb: "Off the coast of Western Australia — where the sky and the sea stop being two things.", x: 78, y: 72.71 },
  { chapterSlug: "moonglasses-sky", blurb: "Further along the Australian coast — head in the clouds, energy immaculate.", x: 87.73, y: 74.16 },
  { chapterSlug: "moonglasses-black", blurb: "New Delhi — where the whole brand actually started.", x: 68.09, y: 45.67 },
  { chapterSlug: "moonglasses-snow", blurb: "The Swiss Alps — mornings your breath shows before your coffee does.", x: 49.82, y: 38.79 },
  { chapterSlug: "moonglasses-orange", blurb: "The Arabian Sea, just off Goa — a small flash of colour that says keep going.", x: 66.91, y: 52.55 },
  { chapterSlug: "beachn", blurb: "California — golden hour, zero plans for tomorrow.", x: 13.64, y: 36.98 },
  { chapterSlug: "sunshine", blurb: "London, on the rare afternoon Hyde Park actually gets sun — no itinerary, just the deck chairs and the light.", x: 46.18, y: 34.69 },
  { chapterSlug: "tropical-blue", blurb: "The Brazilian coastline — too warm, too green, too good to be real.", x: 34.36, y: 70.17 },
  { chapterSlug: "tropical-pink", blurb: "The southern tip of India, near Sri Lanka — the tropical energy, dialled all the way up.", x: 66.73, y: 57.62 },
  { chapterSlug: "dunes-yellow", blurb: "Rajasthan — the last good hour before noon in the desert.", x: 66.18, y: 49.17 },
  { chapterSlug: "dunes-maroon", blurb: "The Sahara — golden hour, but make it desert.", x: 52.82, y: 51.22 },
  { chapterSlug: "peaking", blurb: "Around Everest — the view that finally quiets your legs.", x: 69.27, y: 42.29 },
  { chapterSlug: "wildling", blurb: "South Africa — the last light before the forest goes properly dark.", x: 56.73, y: 62.81 },
  { chapterSlug: "junglee", blurb: "Bangkok — a little feral, a little free, gloriously lost for an afternoon.", x: 74.18, y: 55.09 },
];

function PinGlyph({ active }: { active: boolean }) {
  const fill = active ? "#e6c68f" : "#ffffff";
  return (
    <span className="relative flex h-[30px] w-4 items-end justify-center">
      <span
        className="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-black/40 blur-[1.5px] transition-opacity duration-200"
        style={{ opacity: active ? 0.9 : 0.5 }}
      />
      <svg
        viewBox="0 0 14 28"
        className={`relative h-[30px] w-4 drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)] transition-transform duration-200 ${
          active ? "pin-bouncing" : ""
        }`}
        style={active ? undefined : { transform: "scale(1)" }}
      >
        <line x1="7" y1="15" x2="7" y2="28" stroke={fill} strokeWidth="1.5" />
        <circle cx="7" cy="7.5" r="6.75" fill={fill} stroke="#2a2a2a" strokeWidth="2" />
      </svg>
    </span>
  );
}

export function ExploreGlobe() {
  const router = useRouter();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const activePin = PINS.find((p) => p.chapterSlug === activeSlug) ?? null;
  const activeChapter = activePin ? chapterFor(activePin.chapterSlug) : null;

  return (
    <section id="pick-your-world" className="scroll-mt-24 py-24 md:py-30">
      <div className="mx-auto max-w-[560px] text-center">
        <p className="text-caption uppercase tracking-[0.08em] text-secondary-text">
          Explore by Terrain
        </p>
        <p className="mt-3 font-display text-heading-xl uppercase leading-[0.95] text-ink md:text-display-m">
          Pick Your World.
        </p>
        <p className="mx-auto mt-4 max-w-md text-body-s text-secondary-text">
          Every Chapter starts with a real place — a coastline, a summit, a city that never quite
          goes to sleep. Moonglasses is a travel and lifestyle brand first: the caps just happen to
          be where those journeys end up living. Hover a pin to see where it's from.
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-[1200px] flex-col gap-8 px-6 md:flex-row md:items-center md:gap-10 md:px-0">
        <div className="relative w-full md:w-[54%]" style={{ aspectRatio: "4928 / 3712" }}>
          <Image
            src="/images/globe/world-map-clay.png"
            alt="World map"
            fill
            sizes="(min-width: 900px) 750px, 100vw"
            className="object-contain"
          />

          {PINS.map((pin) => (
            <button
              key={pin.chapterSlug}
              type="button"
              onMouseEnter={() => setActiveSlug(pin.chapterSlug)}
              onFocus={() => setActiveSlug(pin.chapterSlug)}
              onClick={() => {
                if (activeSlug === pin.chapterSlug) {
                  router.push(`/chapter/${pin.chapterSlug}`);
                } else {
                  setActiveSlug(pin.chapterSlug);
                }
              }}
              className="absolute -translate-x-1/2 -translate-y-full cursor-pointer"
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              aria-label={chapterFor(pin.chapterSlug)?.name ?? pin.chapterSlug}
            >
              <PinGlyph active={activeSlug === pin.chapterSlug} />
            </button>
          ))}
        </div>

        <div className="w-full md:w-[46%] md:pl-6">
          {activePin && activeChapter ? (
            <Link href={`/chapter/${activeChapter.slug}`} className="group block">
              <div className="relative aspect-[4/5] w-full max-w-[380px] overflow-visible md:mx-0 mx-auto">
                <Image
                  src={chapterImageSrc(activeChapter.folder, activeChapter.sideImage)}
                  alt={activeChapter.name}
                  fill
                  sizes="380px"
                  className="object-contain drop-shadow-[0_18px_28px_rgba(20,14,8,0.35)] transition-transform duration-500 ease-out group-hover:scale-105"
                />
              </div>
              <p className="mt-5 font-display text-heading-m uppercase text-ink">
                {activeChapter.name}
              </p>
              <p className="mt-2 max-w-sm text-body-s text-secondary-text">{activePin.blurb}</p>
              <p className="mt-4 text-caption uppercase tracking-[0.1em] text-ink underline underline-offset-4">
                View this Chapter
              </p>
            </Link>
          ) : (
            <div className="max-w-sm text-center md:text-left">
              <p className="font-display text-heading-m uppercase text-secondary-text/60">
                Hover a Pin
              </p>
              <p className="mt-2 text-body-s text-secondary-text">
                Sixteen Chapters, sixteen real places. Move over the map to see where each one
                comes from.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
