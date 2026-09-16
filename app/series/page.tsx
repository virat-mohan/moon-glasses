import { SeriesCard } from "@/components/series/SeriesCard";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { seriesOrder } from "@/lib/series";
import { getAllChapters } from "@/lib/chapters-dynamic";

export default async function SeriesIndexPage() {
  const chapters = await getAllChapters();

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.08em] text-secondary-text">
          Story Series
        </p>
        <h1 className="mt-2 font-display text-heading-xl text-charcoal">
          Every world has a story.
        </h1>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          {seriesOrder.map((s, i) => {
            const rep = chapters.find((c) => c.series === s.name);
            if (!rep) return null;
            return (
              <SeriesCard
                key={s.slug}
                name={s.name}
                slug={s.slug}
                blurb={s.blurb}
                representative={rep}
                index={i}
              />
            );
          })}
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
