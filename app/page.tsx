import Image from "next/image";
import Link from "next/link";
import { MobileCatalogue } from "@/components/collection/MobileCatalogue";
import { CatalogueGrid } from "@/components/collection/CatalogueCard";
import { CollectionExplorer } from "@/components/collection/CollectionExplorer";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { DiscountPromoBanner } from "@/components/ui/DiscountPromoBanner";
import { Hero } from "@/components/hero/HeroVideo";
import { EditorialSplit } from "@/components/hero/EditorialSplit";
import { PayWithAPostBanner } from "@/components/hero/PayWithAPostBanner";
import { isPostBarterEnabled } from "@/lib/post-barter";
import { isLaunchSoon } from "@/lib/launch";
import { getCoreCollectionChapters, getLimitedSeriesChapters } from "@/lib/chapters-dynamic";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { getExplorerPosts } from "@/lib/community";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";
import { getStoreRating } from "@/lib/reviews";
import { getSetting } from "@/lib/settings";
import { pinFirst } from "@/lib/catalogue";
import { REVIEW_COPY } from "@/lib/review-core";
import { chapters, groupByStyle, styleRimLens } from "@/lib/chapters";

function chapterName(slug: string) {
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

export const revalidate = 3600;

// Current Vibe only appears once real interest exists: at least four pairs
// each viewed this many times in the last week. Until then the homepage is
// just the Limited Series and The Collection (no padded-out placeholder row).
const VIBE_MIN_WEEKLY_VIEWS = 25;
const VIBE_SIZE = 4;

/** The most-viewed pairs over the last week, or nothing while traffic is too thin to mean anything. */
async function getCurrentVibe<T extends { slug: string }>(collection: T[]): Promise<T[]> {
  try {
    const analytics = await computeWebsiteAnalytics(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    );
    const viewed = analytics.topViewedChapters
      .filter((v) => v.views >= VIBE_MIN_WEEKLY_VIEWS)
      .map((v) => collection.find((c) => c.slug === v.slug))
      .filter((c): c is T => !!c);
    return viewed.length >= VIBE_SIZE ? viewed.slice(0, VIBE_SIZE) : [];
  } catch (err) {
    console.error("Homepage: failed to compute Current Vibe", err);
    return [];
  }
}

function buildPillars(shapeCount: number, colourwayCount: number) {
  return [
    { title: "UV400 Protected", copy: "Real lens protection on every pair, not just a tint." },
    { title: "Plastic Or Metal", copy: "The Collection from ₹1,499, the Limited Series from ₹1,999. Inclusive of taxes and shipping." },
    { title: "Fashion-First", copy: "Shapes and lens colours built to be seen, not just worn." },
    {
      title: "Core Collection",
      copy: `${shapeCount} shape${shapeCount === 1 ? "" : "s"}, ${colourwayCount} colourway${colourwayCount === 1 ? "" : "s"} — the everyday lineup.`,
    },
  ];
}

export default async function Home() {
  const storeRating = await getStoreRating();
  const [coreChapters, postBarterEnabled, launchSoon] = await Promise.all([
    getCoreCollectionChapters(),
    isPostBarterEnabled(),
    isLaunchSoon(),
  ]);
  const collection = groupByStyle(coreChapters);
  // Computed live from what's actually published, rather than a hardcoded
  // "five shapes, 16 colourways" — that line went stale the moment a shape
  // or colourway was added via Master Inventory without anyone remembering
  // to update this copy by hand.
  const shapeCount = new Set(coreChapters.map((c) => styleRimLens(c).style)).size;
  const colourwayCount = coreChapters.length;
  const inventory = await getInventoryMap();

  const explorerPosts = await getExplorerPosts();
  const limitedChapters = await getLimitedSeriesChapters();

  const toItem = (chapter: (typeof collection)[number]) => ({
    chapter,
    stockLabel: stockLabelFor(inventory[chapter.slug]),
  });
  // Sorted into shape groups so the Limited Edition Drop can be filtered like The Collection.
  const limitedFirst = await getSetting("LIMITED_FIRST_SLUG");
  const limitedItems = pinFirst(groupByStyle(limitedChapters).map(toItem), limitedFirst);

  const vibeItems = (await getCurrentVibe([...collection, ...limitedChapters])).map(toItem);
  const collectionItems = collection.map(toItem);

  return (
    <>
      <Hero />

      <main className="mx-auto w-full max-w-[1440px] px-6 md:px-12">
        <div className="flex justify-center pb-16">
          <DiscountPromoBanner />
        </div>

        <p className="pb-6 text-center font-sans text-caption text-secondary-text">All prices are inclusive of taxes and shipping.</p>
        {limitedChapters.length > 0 && (
          <section className="border-b border-divider pb-16 pt-8">
            <p className="mb-3 text-caption uppercase tracking-[0.12em] text-secondary-text">
              Once its gone, its gone
            </p>
            <h2 className="mb-8 font-display text-display-m uppercase text-ink md:mb-10">Limited Edition Drop</h2>
            <CollectionExplorer items={limitedItems} modelFirst />
          </section>
        )}

        {vibeItems.length > 0 && (
          <section className="border-b border-divider pb-16 pt-8">
            <p className="mb-3 text-caption uppercase tracking-[0.12em] text-secondary-text">Yours and ours</p>
            <h2 className="mb-8 font-display text-display-m uppercase text-ink md:mb-10">Current Vibe</h2>
            <div className="md:hidden">
              <MobileCatalogue items={vibeItems} />
            </div>
            <div className="hidden md:block">
              <CatalogueGrid items={vibeItems} columnsClassName="md:grid-cols-4" />
            </div>
          </section>
        )}

        <section id="shop" className="scroll-mt-20 pb-16 pt-12 md:pb-24 md:pt-16">
          <h2 className="font-display text-display-m uppercase text-ink">The Collection</h2>
          <p className="mt-3 max-w-md font-sans text-body-s text-secondary-text">
            The core edit — the pairs we keep coming back to.
          </p>
          <p className="mt-1 hidden max-w-md font-sans text-caption text-secondary-text/70 md:block">
            {shapeCount} shape{shapeCount === 1 ? "" : "s"}, {colourwayCount} colourway
            {colourwayCount === 1 ? "" : "s"}, across two materials.
          </p>

          <div className="mt-8 md:mt-10">
            <CollectionExplorer items={collectionItems} modelFirst />
          </div>
        </section>

        {(postBarterEnabled || launchSoon) && <PayWithAPostBanner launchSoon={launchSoon} />}

        <div className="hidden md:block">
          <EditorialSplit
            image="/images/brand/editorial-01.jpg"
            eyebrow="Made For After Dark"
            title="Fashion First"
            copy="The pair for gigs, sets, night outs — light tints for the perfect after dark fashion accessory."
          />
        </div>

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

        <section className="hidden grid-cols-2 gap-8 border-t border-divider py-24 md:grid md:grid-cols-4">
          {buildPillars(shapeCount, colourwayCount).map((p) => (
            <div key={p.title}>
              <p className="text-body-s text-ink">{p.title}</p>
              <p className="mt-2 text-caption text-secondary-text">{p.copy}</p>
            </div>
          ))}
        </section>
      </main>

      {storeRating && (
        <p className="mx-auto w-full max-w-[1440px] px-6 py-10 text-center font-sans text-base text-ink md:px-12">
          <span className="text-tan-gold">★</span> {REVIEW_COPY.homeStrip(storeRating.average.toFixed(1), storeRating.count)}
        </p>
      )}
      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
