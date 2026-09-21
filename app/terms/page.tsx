import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const metadata = { title: "Terms & Conditions — Moonglasses" };

export default function TermsPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Legal</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Terms &amp; Conditions</h1>
        <p className="mt-4 text-caption text-secondary-text">Last updated 15 August 2026</p>

        <div className="mt-10 space-y-8 font-sans text-body-s leading-relaxed text-ink">
          <p>
            These terms govern your use of moon-glasses.store and any purchase you make from us. By using the
            site or placing an order, you agree to them.
          </p>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">About Us</h2>
            <p className="mt-3">
              Moonglasses (GSTIN — add in Admin Settings), C-152, Industrial Phase-1, Okhla, South Delhi, Delhi,
              110020, sells premium sunglasses under the Moonglasses brand.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Products &amp; Pricing</h2>
            <p className="mt-3">
              Prices shown on the site are in Indian Rupees and inclusive of applicable GST, unless stated
              otherwise. We reserve the right to change prices, correct pricing errors, or discontinue a
              product at any time. Product photos are as accurate as possible, but slight variation in
              colour or finish may occur.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Orders &amp; Payment</h2>
            <p className="mt-3">
              An order is confirmed once payment is successfully processed via our payment partner,
              Razorpay. We reserve the right to cancel any order — for example due to a stock or pricing
              error — in which case we&apos;ll refund you in full.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Shipping, Returns &amp; Cancellations</h2>
            <p className="mt-3">
              Covered in full in our{" "}
              <a href="/shipping-policy" className="underline underline-offset-4">
                Shipping Policy
              </a>{" "}
              and{" "}
              <a href="/refund-policy" className="underline underline-offset-4">
                Refund &amp; Cancellation Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Loyalty Program (Good Vibes)</h2>
            <p className="mt-3">
              Good Vibes are earned on completed purchases and can be redeemed for a discount on a future
              order, at the rate shown in your account. Good Vibes have no cash value, can&apos;t be transferred
              between accounts, and we may adjust the earning/redemption rate or the program itself at any
              time, with changes applying to future purchases.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Intellectual Property</h2>
            <p className="mt-3">
              All content on this site — text, photos, designs, and the Moonglasses name and logo — belongs
              to Moonglasses and may not be reproduced without permission.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Limitation of Liability</h2>
            <p className="mt-3">
              To the extent permitted by law, Moonglasses&apos;s liability for any claim relating to a
              purchase is limited to the amount you paid for that order.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Governing Law</h2>
            <p className="mt-3">
              These terms are governed by the laws of India, and any dispute is subject to the exclusive
              jurisdiction of the courts of Delhi.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Contact Us</h2>
            <p className="mt-3">hello@moon-glasses.store · +91 00000 00000</p>
          </section>
        </div>
      </main>
      <FooterEditorial />
    </>
  );
}
