import { chapters } from "@/lib/chapters";
import { TryOnCamera } from "@/components/tryOn/TryOnCamera";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const metadata = { title: "Try It On" };

// All 10 launch shapes in the rotating strip.
const TRY_ON_SLUGS = [
  "moon-01-hexagonal",
  "moon-02-rectangular",
  "moon-03-aviator",
  "moon-04-wayfarer",
  "moon-05-round",
  "moon-06-wide-wayfarer",
  "moon-07-hexagonal-ii",
  "moon-08-cateye-oval",
  "moon-09-oval",
  "moon-10-wide-rectangular",
];

export default function TryOnPage() {
  const products = TRY_ON_SLUGS.map((slug) => chapters.find((c) => c.slug === slug)).filter(
    (c): c is (typeof chapters)[number] => !!c
  );

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-16 pb-24 md:px-12 md:pt-24">
        <div className="text-center">
          <p className="font-sans text-micro uppercase tracking-[0.3em] text-secondary-text">
            Live Try-On
          </p>
          <h1 className="mt-3 font-display text-heading-xl uppercase text-ink">See It On You</h1>
          <p className="mx-auto mt-3 max-w-md font-sans text-body-s text-secondary-text">
            Pick a pair below — your camera tracks your face and fits it to you in real time.
            Nothing is recorded or sent anywhere; it all runs on your device.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <TryOnCamera products={products} />
        </div>
      </main>
      <FooterEditorial />
    </>
  );
}
