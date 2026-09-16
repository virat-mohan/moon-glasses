import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const metadata = { title: "Shipping Policy — Moonglasses" };

export default function ShippingPolicyPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Legal</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Shipping Policy</h1>
        <p className="mt-4 text-caption text-secondary-text">Last updated 15 August 2026</p>

        <div className="mt-10 space-y-8 font-sans text-body-s leading-relaxed text-ink">
          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Where We Ship</h2>
            <p className="mt-3">We currently ship anywhere within India.</p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Shipping Charges</h2>
            <p className="mt-3">
              Shipping is calculated live at checkout based on your delivery pincode and charged at cost —
              we don&apos;t add a markup on top of what our courier partners charge.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Processing &amp; Delivery Time</h2>
            <p className="mt-3">
              Orders are packed and handed to our courier partner within 1–2 business days of payment.
              Delivery typically takes 4–7 business days depending on your location, via our courier
              network (Shiprocket).
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Order Tracking</h2>
            <p className="mt-3">
              Once your order ships, you&apos;ll receive a tracking link by email and/or WhatsApp so you can
              follow it to your door.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Delays</h2>
            <p className="mt-3">
              Occasionally, weather, courier disruptions, or remote locations can delay a delivery beyond
              our estimate. If your order is significantly delayed, contact us and we&apos;ll chase it up on
              your behalf.
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
