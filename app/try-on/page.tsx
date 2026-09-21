import { chapters } from "@/lib/chapters";
import { TryOnCamera } from "@/components/tryOn/TryOnCamera";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const metadata = { title: "Try It On" };

// One of each of the 6 shapes plus a couple of standout colourways.
const TRY_ON_SLUGS = [
  "moon-wayfarer-black-green",
  "moon-round-black-light-brown",
  "moon-rectangle-black-orange",
  "moon-aviator-classic-black-yellow",
  "moon-octagon-gold-grey",
  "moon-aviator-metal-black-yellow",
  "moon-rectangle-black-blue",
  "moon-octagon-black-blue",
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
