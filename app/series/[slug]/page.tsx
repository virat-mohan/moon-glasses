import { notFound } from "next/navigation";
import Image from "next/image";
import { seriesOrder } from "@/lib/series";
import { chapterImageSrc } from "@/lib/chapters";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export function generateStaticParams() {
  return seriesOrder.map((s) => ({ slug: s.slug }));
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = seriesOrder.find((s) => s.slug === slug);
  if (!series) notFound();

  const allChapters = await getAllChapters();
  const chapters = allChapters.filter((c) => c.series === series.name);
  const hero = chapters[0];
  const inventory = await getInventoryMap();

  return (
    <>
      <section className="bg-charcoal md:relative md:flex md:min-h-[60vh] md:items-end md:overflow-hidden">
        <div className="relative aspect-[4/5] overflow-hidden md:absolute md:inset-0 md:aspect-auto">
          {hero && (
            <Image
              src={chapterImageSrc(hero.folder, hero.sideImage)}
              alt={series.name}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 hidden bg-gradient-to-t from-black/70 via-black/10 to-transparent md:block" />
        </div>
        {/* Mobile: text stacked below the image, never over it — the wide
            desktop crop leaves empty space for the overlay, but the taller
            mobile crop fills the frame with the cap itself. */}
        <div className="px-6 py-8 md:hidden">
          <p className="text-caption uppercase tracking-[0.08em] text-white/70">Story Series</p>
          <h1 className="mt-2 font-display text-display-m text-white">{series.name}</h1>
          <p className="mt-3 max-w-md text-body text-white/85">{series.blurb}</p>
        </div>
        <div className="relative z-10 hidden md:block md:px-16 md:py-16">
          <p className="text-caption uppercase tracking-[0.08em] text-white/70">Story Series</p>
          <h1 className="mt-2 font-display text-display-m text-white">{series.name}</h1>
          <p className="mt-3 max-w-md text-body text-white/85">{series.blurb}</p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1440px] px-6 py-16 md:px-12">
        <Breadcrumb items={[{ label: "Collection", href: "/" }, { label: series.name }]} />
        <p className="mb-6 mt-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
          Available Chapters
        </p>
        <div className="grid grid-cols-2 gap-0.5 md:grid-cols-5">
          {chapters.map((chapter, i) => (
            <CollectionItem
              key={chapter.slug}
              chapter={chapter}
              index={i}
              stockLabel={stockLabelFor(inventory[chapter.slug])}
            />
          ))}
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
