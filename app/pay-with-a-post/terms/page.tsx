import Link from "next/link";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";
import { getSetting } from "@/lib/settings";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { getBrandProfile } from "@/lib/brand";
import { getPwapRules } from "@/lib/pwap-rules";

export const metadata = { title: "Pay With A Post™ Terms" };
// Built from the live rules (Admin › Pay With A Post › Rules), so a rule
// change shows here at once.
export const dynamic = "force-dynamic";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default async function PayWithAPostTermsPage() {
  const [r, brand] = await Promise.all([getPwapRules(), getBrandProfile()]);
  const updated = new Date(r.updatedAt ?? "2026-10-02").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const name = brand.brandName;
  const handle = brand.instagramHandle;

  return (
    <>
      <main className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Legal</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Pay With A Post™ Terms</h1>
        <p className="mt-4 text-caption text-secondary-text">Last updated {updated}</p>

        <div className="mt-8 border-2 border-[var(--moon-gold)] p-5 font-sans text-body-s text-ink">
          <p className="font-bold uppercase tracking-[0.05em]">In short</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Pick a pair and choose Pay With A Post at checkout. You pay nothing.</li>
            <li>We make your own custom image and code the moment you order. There&apos;s nothing to enter.</li>
            <li>
              Post it. When <strong>{r.salesToShip}</strong> people buy with your code, your pair ships free.
            </li>
            <li>
              Every <strong>{r.salesPerFreeCode}</strong> more sales = a free code for another pair (worth up to{" "}
              {rupees(r.freeCodeValueRupees)}, valid {r.freeCodeValidDays} days).
            </li>
          </ul>
          <Link
            href="/?utm_source=pwap#shop"
            className="mt-5 flex min-h-[48px] w-full items-center justify-center bg-[var(--moon-gold)] px-8 py-3.5 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110 sm:inline-flex sm:w-auto"
          >
            Order now
          </Link>
        </div>

        <div className="mt-10 space-y-8 font-sans text-body-s leading-relaxed text-ink">
          <Section title="1. What it is">
            Pay With A Post™ lets you order a pair from {name} and pay for it with an Instagram post instead of
            money. These terms apply on top of our{" "}
            <Link href="/terms" className="underline underline-offset-4">
              Terms &amp; Conditions
            </Link>
            . By choosing Pay With A Post at checkout you agree to them.
          </Section>

          <Section title="2. Who can take part">
            Anyone in India aged 18 or over with a public Instagram account. One active Pay With A Post order per
            person at a time (per phone number, email and Instagram account). Once your pair has shipped you can
            start a new one.
          </Section>

          <Section title="3. How your pair is earned">
            You get a personal code and a post image. Post it on Instagram (feed or story) with your code. Your
            pair ships free once <strong>{r.salesToShip}</strong> qualifying orders are placed with your code. You
            can make up to <strong>{r.maxPostsPerOrder}</strong> posts per order, each with its own code; friends
            who order with any of them count toward the same pair, once per friend order.
            {r.friendDiscountRupees > 0
              ? ` Friends get ${rupees(r.friendDiscountRupees)} off with your code.`
              : " Friends pay the normal price; the code tracks that they came from you."}
          </Section>

          <Section title="4. What counts as a sale">
            A qualifying order is paid in full, not cancelled, and placed by someone else: orders with your own
            phone number or email don&apos;t count. Orders that are returned or refunded, or that we find to be
            fake or arranged, are removed from your count.
          </Section>

          <Section title="5. Free codes">
            After your pair ships, every <strong>{r.salesPerFreeCode}</strong> more qualifying sales on your code
            earns a free code, sent on WhatsApp and email. Each code takes up to{" "}
            {rupees(r.freeCodeValueRupees)} off one order, works once, is valid for {r.freeCodeValidDays} days and
            has no cash value. Keep it private: whoever uses it first gets the pair. Pairs paid with a post, including pairs bought with a free code, don&apos;t earn Good Vibes loyalty points.
          </Section>

          {r.shipFirstEnabled && (
            <Section title="6. We ship first (large accounts)">
              Accounts with {r.shipFirstMinFollowers.toLocaleString("en-IN")}+ real followers may get their pair
              before posting, subject to a daily limit ({r.shipFirstDailyCap} a day) and once per account every{" "}
              {r.shipFirstCooldownDays} days. Followers are checked on Instagram; accounts that look bought are
              moved to the standard route. You must post within the time agreed at checkout, or pay for the pair
              using the link we send.
            </Section>
          )}

          <Section title={`${r.shipFirstEnabled ? 7 : 6}. Your post`}>
            Your post must be your own, honest and lawful, and must show you received the product free: add
            #gifted or Instagram&apos;s &ldquo;Paid partnership&rdquo; label, as ASCI guidelines require. Please
            tag {handle} or add us as a collaborator. You let {name} reshare your post on its own channels with
            credit to you.
          </Section>

          <Section title={`${r.shipFirstEnabled ? 8 : 7}. Shipping, returns and changes`}>
            Pairs earned this way ship free within India. Because they&apos;re free they can&apos;t be returned
            for a refund, but a pair that arrives damaged or faulty is replaced under our{" "}
            <Link href="/refund-policy" className="underline underline-offset-4">
              Refund Policy
            </Link>
            . We may update these numbers or end the programme at any time; an order you&apos;ve already placed
            keeps the target it started with.
          </Section>

          <Section title={`${r.shipFirstEnabled ? 9 : 8}. Misuse`}>
            We can cancel an order, code or free code if we see self-buying, fake or duplicate accounts, bought
            engagement, or any attempt to game the count. Our decision on what counts is final. These terms are
            governed by Indian law and the courts of New Delhi.
          </Section>
        </div>
        <p className="mt-10">
          <WhatsAppHelp
            label="stuck posting or with your code? whatsapp us"
            topic="pay with a post"
            lines={["page: /pay-with-a-post/terms"]}
            number={await getSetting("SUPPORT_WHATSAPP")}
          />
        </p>
      </main>
      <FooterEditorial />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-heading-s uppercase text-ink">{title}</h2>
      <p className="mt-3">{children}</p>
    </section>
  );
}
