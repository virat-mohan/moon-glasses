import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const metadata = { title: "Privacy Policy — Moonglasses" };

export default function PrivacyPolicyPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Legal</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Privacy Policy</h1>
        <p className="mt-4 text-caption text-secondary-text">Last updated 15 August 2026</p>

        <div className="mt-10 space-y-8 font-sans text-body-s leading-relaxed text-ink">
          <p>
            Moonglasses (&quot;we&quot;, &quot;us&quot;) operates moon-glasses.store. This policy explains what
            information we collect when you use the site, why we collect it, and how it&apos;s handled.
          </p>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Information We Collect</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Contact details you give us: name, phone number, email, delivery address.</li>
              <li>Order information: items purchased, order value, payment status.</li>
              <li>
                Account information if you sign in: your phone/email, and your Good Vibes loyalty balance.
              </li>
              <li>
                Usage data: pages viewed, products browsed, and cart activity, collected via first-party
                tracking and the Meta Pixel for ad measurement.
              </li>
              <li>
                If you message us on Instagram or Facebook, we may collect your name and whatever
                contact details you share with us in that conversation.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">How We Use It</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>To process and deliver your order, and to contact you about it.</li>
              <li>To send order confirmations, shipping updates, and OTP codes by email and/or WhatsApp/SMS.</li>
              <li>To operate the Good Vibes loyalty program.</li>
              <li>
                To send marketing communications (new Products, drops, offers) — only if you&apos;ve
                opted in, and you can opt out at any time.
              </li>
              <li>To improve the site and measure the performance of our advertising.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Who We Share It With</h2>
            <p className="mt-3">
              We share the minimum necessary data with the service providers that keep the site running:
              our payment processor (Razorpay) to process payments, our shipping partner (Shiprocket) to
              deliver orders, our email/SMS/WhatsApp providers (Brevo, MSG91) to send order and account
              communications, and our database/hosting providers (Supabase, Vercel). We never sell your
              personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Cookies &amp; Tracking</h2>
            <p className="mt-3">
              We use cookies and similar technology to keep you signed in, remember your cart, and measure
              how our ads perform (via the Meta Pixel). You can control cookies through your browser
              settings.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Data Retention</h2>
            <p className="mt-3">
              We keep order records for as long as required for tax, accounting, and warranty purposes.
              You can ask us to delete your account and associated personal data at any time, subject to
              records we&apos;re legally required to retain.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Your Rights</h2>
            <p className="mt-3">
              You can ask us what personal data we hold about you, ask us to correct it, or ask us to
              delete it, by writing to us using the details below.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Contact Us</h2>
            <p className="mt-3">
              Moonglasses, Delhi, India
              <br />
              hello@moon-glasses.store · +91 00000 00000
            </p>
          </section>
        </div>
      </main>
      <FooterEditorial />
    </>
  );
}
