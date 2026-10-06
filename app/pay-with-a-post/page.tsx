import Link from "next/link";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";
import { getPwapRules } from "@/lib/pwap-rules";
import { getSetting } from "@/lib/settings";

export const metadata = {
  title: "Pay With A Post™",
  description: "Your next pair, paid in posts. Pick a pair, post it with your own code, and when friends order with it, your pair ships free.",
  alternates: { canonical: "/pay-with-a-post" },
};
// Numbers come from the admin rules; saving them refreshes the site, and this is a short cache besides.
export const revalidate = 600;

// A model photo for the top of the page. Brand standard: the face stays clear of text.
const HERO =
  "https://fewnyteoprmuyzfvopnb.supabase.co/storage/v1/object/public/product-images/moon-striker-gold-pink/model-zoomed.jpg?v=1";

export default async function PayWithAPostLanding() {
  const [r, support] = await Promise.all([getPwapRules(), getSetting("SUPPORT_WHATSAPP")]);

  const steps = [
    { n: "01", h: "pick a pair.", p: "choose pay with a post at checkout. you pay nothing." },
    { n: "02", h: "post it.", p: "we make your own custom image and code the moment you order. there’s nothing to enter." },
    { n: "03", h: `${r.salesToShip} friends order.`, p: `when ${r.salesToShip} people buy with your code, your pair ships free.` },
  ];

  return (
    <>
      <main className="mx-auto w-full max-w-[560px] pb-24">
        {/* Photo first, fading into black: the words sit below the face, never on it. */}
        <div className="relative w-full overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO}
            alt="A model wearing a Moonglasses aviator"
            width={1080}
            height={1350}
            fetchPriority="high"
            decoding="async"
            className="block aspect-[4/5] w-full object-cover object-top"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-black" />
        </div>

        <section className="relative px-6 pt-2 text-center">
          <p className="font-sans text-caption uppercase tracking-[0.2em] text-[var(--moon-gold)]">Pay With A Post™</p>
          <h1 className="mt-3 font-display text-[2.4rem] leading-[1.05] text-ink">your next pair, paid in posts.</h1>
          <p className="mt-3 font-display text-body-m italic text-[var(--moon-gold)]">light tints, good vibes.</p>

          <ol className="mt-10 space-y-7 text-left">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="w-9 flex-none font-sans text-body-s font-bold tracking-[0.1em] text-[var(--moon-gold)]">{s.n}</span>
                <div>
                  <p className="font-display text-heading-s text-ink">{s.h}</p>
                  <p className="mt-1 text-body-s text-secondary-text">{s.p}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-body-s text-ink">
            and it keeps going: <strong className="text-[var(--moon-gold)]">every {r.salesPerFreeCode} more, another pair on us.</strong>
          </p>

          <Link
            href="/?utm_source=pwap#shop"
            className="mt-8 flex min-h-[52px] w-full items-center justify-center bg-[var(--moon-gold)] px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110"
          >
            Order now
          </Link>

          <p className="mt-5 text-caption text-secondary-text">
            <Link href="/pay-with-a-post/terms" className="underline underline-offset-4 hover:text-ink">
              terms apply
            </Link>
            <span className="mx-2">·</span>
            <WhatsAppHelp topic="pay with a post" lines={["page: /pay-with-a-post"]} number={support} label="questions? whatsapp us" />
          </p>
        </section>
      </main>
      <FooterEditorial />
    </>
  );
}
