import type { Metadata } from "next";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { getLimitedSeriesChapters } from "@/lib/chapters-dynamic";
import { LIMITED_SERIES_PRICING } from "@/lib/limited-series";

export const metadata: Metadata = {
  title: "Limited Series",
  description:
    "MOON GLASSES Limited Series — small-batch drops in deliberately short supply. Once a run sells out, it's gone for good.",
};

export const revalidate = 3600;

export default async function LimitedSeriesPage() {
  const [limitedSeries, inventory] = await Promise.all([getLimitedSeriesChapters(), getInventoryMap()]);

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-28 md:px-12 md:pt-36">
        <p className="text-caption uppercase tracking-[0.15em] text-paint-orange">Small-Batch · Once Gone, Gone</p>
        <h1 className="mt-2 font-display text-display-m uppercase text-ink">Limited Series.</h1>
        <p className="mt-3 max-w-lg font-sans text-body-s text-secondary-text">
          A separate line from the core collection — deliberately short runs, never restocked. ₹1,749
          acetate, ₹2,149 metal. When a colourway sells out here, it doesn&apos;t come back.
        </p>

        {limitedSeries.length === 0 ? (
          <div className="mt-16 max-w-md border-t border-divider pt-10">
            <p className="font-display text-heading-s uppercase text-ink">Dropping Soon.</p>
            <p className="mt-3 font-sans text-body-s text-secondary-text">
              The first Limited Series run hasn&apos;t launched yet. Join the list below and we&apos;ll
              email you the moment it does — with first access before it sells out.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-0 md:grid-cols-4">
            {limitedSeries.map((chapter, i) => (
              <CollectionItem
                key={chapter.slug}
                chapter={chapter}
                index={i}
                stockLabel={stockLabelFor(inventory[chapter.slug])}
              />
            ))}
          </div>
        )}

        <p className="mt-10 border-t border-divider pt-6 font-sans text-micro uppercase tracking-[0.05em] text-secondary-text">
          Plastic ₹{LIMITED_SERIES_PRICING.Plastic.toLocaleString("en-IN")} · Metal ₹
          {LIMITED_SERIES_PRICING.Metal.toLocaleString("en-IN")} · No restocks
        </p>
      </main>

      <div className="mt-24">
        <NewsletterBlock />
        <FooterEditorial />
      </div>
    </>
  );
}
