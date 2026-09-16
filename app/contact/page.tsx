import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata = {
  title: "Contact Us",
};

export default function ContactPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[720px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
          Contact Us
        </p>
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">
          Queries &amp; Comments
        </h1>
        <p className="mt-3 max-w-md text-body-s text-secondary-text">
          Got a question about an order, a product, or just want to say hello? Send us a note
          and we&apos;ll get back to you.
        </p>

        <div className="mt-10">
          <ContactForm />
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
