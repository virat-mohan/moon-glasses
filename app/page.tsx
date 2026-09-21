import Image from "next/image";
import Link from "next/link";
import { TileGrid } from "@/components/collection/TileGrid";
import { CollectionExplorer } from "@/components/collection/CollectionExplorer";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { DiscountPromoBanner } from "@/components/ui/DiscountPromoBanner";
import { Hero } from "@/components/hero/HeroVideo";
import { EditorialSplit } from "@/components/hero/EditorialSplit";
import { PayWithAPostBanner } from "@/components/hero/PayWithAPostBanner";
import { getCoreCollectionChapters, getLimitedSeriesChapters } from "@/lib/chapters-dynamic";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";
import { getExplorerPosts } from "@/lib/community";
import { chapters, groupByStyle } from "@/lib/chapters";

function chapterName(slug: string) {
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

export const revalidate = 3600;

const pillars = [
  { title: "UV400 Protected", copy: "Real lens protection on every pair, not just a tint." },
  { title: "Plastic Or Metal", copy: "Acetate frames ₹1,499, metal frames ₹1,999." },
  { title: "Fashion-First", copy: "Shapes and lens colours built to be seen, not just worn." },
  { title: "Core Collection", copy: "Five shapes, sixteen colourways — the everyday lineup." },
];

export default async function Home() {
  const coreChapters = await getCoreCollectionChapters();
  const collection = groupByStyle(coreChapters);
  const inventory = await getInventoryMap();

  const explorerPosts = await getExplorerPosts();
  const limitedChapters = await getLimitedSeriesChapters();

  let trending: typeof collection = [];
  try {
    const analytics = await computeWebsiteAnalytics(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    );
    trending = analytics.topViewedChapters
      .map((v) => collection.find((c) => c.slug === v.slug))
      .filter((c): c is (typeof collection)[number] => !!c)
      .slice(0, 4);
  } catch (err) {
    console.error("Homepage: failed to compute trending chapters", err);
  }

  return (
    <>
      <Hero />

      <main className="mx-auto w-full max-w-[1440px] px-6 md:px-12">
        <div className="flex justify-center pb-16">
          <DiscountPromoBanner />
        </div>

        {limitedChapters.length > 0 && (
          <section className="border-b border-divider pb-16 pt-8">
            <p className="mb-6 text-caption uppercase tracking-[0.12em] text-secondary-text">
              Limited Series — Small-Batch · Once Gone, Gone
            </p>
            <TileGrid
              items={limitedChapters.map((chapter) => ({
                chapter,
                stockLabel: stockLabelFor(inventory[chapter.slug]),
              }))}
            />
          </section>
        )}

        {trending.length > 0 && (
          <section className="border-b border-divider pb-16 pt-8">
            <p className="mb-6 text-caption uppercase tracking-[0.12em] text-secondary-text">
              Trending Now
            </p>
            <TileGrid
              items={trending.map((chapter) => ({
                chapter,
                stockLabel: stockLabelFor(inventory[chapter.slug]),
              }))}
            />
          </section>
        )}

        <section id="shop" className="scroll-mt-20 pb-24 pt-16">
          <p className="mb-3 text-caption uppercase tracking-[0.12em] text-secondary-text">New In</p>
          <h2 className="font-display text-display-m uppercase text-ink">The Collection</h2>
          <p className="mt-3 max-w-md font-sans text-body-s text-secondary-text">
            Five shapes, 16 colourways, across two materials. ₹1,499 acetate, ₹1,999 metal.
          </p>

          <div className="mt-10">
            <CollectionExplorer
              items={collection.map((chapter) => ({
                chapter,
                stockLabel: stockLabelFor(inventory[chapter.slug]),
              }))}
            />
          </div>
        </section>

        <PayWithAPostBanner />

        <EditorialSplit
          image="/images/brand/editorial-01.jpg"
          eyebrow="Made For After Dark"
          title="Fashion First"
          copy="The pair for gigs, sets, night outs — light tints for the perfect after dark fashion accessory."
        />
        <EditorialSplit
          image="/images/brand/editorial-02.jpg"
          eyebrow="New In"
          title="Light Tints"
          copy="Wayfarer, round, rectangle, aviator and octagon — five shapes, 16 lens tints, across plastic and metal."
          ctaLabel="Discover The Collection"
          ctaHref="/#shop"
          reverse
        />
        <EditorialSplit
          image="/images/brand/editorial-01.jpg"
          eyebrow="Small-Batch · Once Gone, Gone"
          title="Limited Series"
          copy="A separate line from the core collection — deliberately short runs that never restock. Dropping soon."
          ctaLabel="See Limited Series"
          ctaHref="/limited-series"
        />

        {explorerPosts.length > 0 && (
          <section id="crew" className="scroll-mt-24 border-t border-divider py-24">
            <p className="mb-2 text-caption uppercase tracking-[0.12em] text-secondary-text">
              Worn By
            </p>
            <h2 className="font-display text-heading-l uppercase text-ink">Real People.</h2>

            <div className="mt-10 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:-mx-12 md:px-12">
              {explorerPosts.map((post) => {
                const primarySlug = post.chapterSlugs[0];
                return (
                  <div key={post.file} className="w-[45vw] flex-none snap-start sm:w-[30vw] md:w-[22vw] lg:w-[240px]">
                    <Link href={primarySlug ? `/chapter/${primarySlug}` : "/"} className="group block">
                      <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                        <Image
                          src={post.src}
                          alt={post.testimonial}
                          fill
                          sizes="(min-width: 1024px) 240px, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw"
                          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                        />
                      </div>
                    </Link>
                    <p className="mt-3 text-caption text-secondary-text">&ldquo;{post.testimonial}&rdquo;</p>
                    {primarySlug && (
                      <p className="mt-2 text-caption uppercase tracking-[0.05em] text-ink">
                        <Link href={`/chapter/${primarySlug}`} className="underline underline-offset-4">
                          {chapterName(primarySlug)}
                        </Link>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 gap-8 border-t border-divider py-24 md:grid-cols-4">
          {pillars.map((p) => (
            <div key={p.title}>
              <p className="text-body-s text-ink">{p.title}</p>
              <p className="mt-2 text-caption text-secondary-text">{p.copy}</p>
            </div>
          ))}
        </section>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
