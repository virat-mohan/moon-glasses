import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const metadata = { title: "Refund & Cancellation Policy — Moonglasses" };

export default function RefundPolicyPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Legal</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="mt-4 text-caption text-secondary-text">Last updated 16 September 2026</p>

        <div className="mt-10 space-y-8 font-sans text-body-s leading-relaxed text-ink">
          <p>
            We want you to love your Chapter. If something&apos;s not right, here&apos;s how cancellations,
            returns, and refunds work.
          </p>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Cancellations</h2>
            <p className="mt-3">
              You can cancel an order for a full refund any time before it&apos;s shipped. Once an order has
              shipped, it can no longer be cancelled — you&apos;re welcome to return it instead (see below).
              To cancel, message us on WhatsApp at +91 00000 00000 or email hello@moon-glasses.store with
              your order number.
            </p>
            <p className="mt-3">
              For Cash on Delivery orders, the advance amount paid at checkout to confirm the order is
              non-refundable on cancellation, as it covers courier charges already incurred.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Returns &amp; Exchanges</h2>
            <p className="mt-3">
              We accept returns and exchanges within 7 days of delivery, as long as the cap is unused,
              unworn, and in its original condition with tags attached. To start a return, email us at
              hello@moon-glasses.store with your order number and the reason for return — we&apos;ll confirm
              pickup or return-shipping instructions.
            </p>
            <p className="mt-3">
              Caps marked as final sale, or damaged through normal wear, are not eligible for return.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Damaged or Incorrect Items</h2>
            <p className="mt-3">
              If your order arrives damaged, defective, or isn&apos;t what you ordered, contact us within 48
              hours of delivery with photos of the item — we&apos;ll arrange a free replacement or a full
              refund, and cover the return shipping cost.
            </p>
          </section>

          <section>
            <h2 className="font-display text-heading-s uppercase text-ink">Refunds</h2>
            <p className="mt-3">
              Once we receive and inspect a returned item, we&apos;ll process your refund to the original
              payment method within 5–7 business days. Miles earned on a refunded order are deducted from
              your balance.
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
