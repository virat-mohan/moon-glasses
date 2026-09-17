import Image from "next/image";
import Link from "next/link";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { DiscountPromoBanner } from "@/components/ui/DiscountPromoBanner";
import { Hero } from "@/components/hero/HeroVideo";
import { EditorialSplit } from "@/components/hero/EditorialSplit";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";
import { getExplorerPosts } from "@/lib/community";
import { chapters } from "@/lib/chapters";

function chapterName(slug: string) {
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

export const revalidate = 3600;

const pillars = [
  { title: "UV400 Protected", copy: "Real lens protection on every pair, not just a tint." },
  { title: "Plastic Or Metal", copy: "₹1,499 acetate frames, ₹1,999 metal frames." },
  { title: "Fashion-First", copy: "Shapes and lens colours built to be seen, not just worn." },
  { title: "Small-Batch", copy: "16 SKUs at launch. When a colourway sells out, it's gone." },
];

export default async function Home() {
  const chapters = await getAllChapters();
  const bySeries = new Map<string, typeof chapters>();
  for (const chapter of [...chapters].reverse()) {
    const group = bySeries.get(chapter.series) ?? [];
    group.push(chapter);
    bySeries.set(chapter.series, group);
  }
  const grouped = [...bySeries.values()].flat();

  const featuredSlugs = [
    "moon-m05-aviator-pale-blue",
    "moon-p01-wayfarer-pale-blue",
    "moon-m09-broad-pale-peach",
    "moon-m01-round-pale-pink",
  ];
  const featured = featuredSlugs
    .map((slug) => grouped.find((c) => c.slug === slug))
    .filter((c): c is (typeof grouped)[number] => !!c);
  const collection = [...featured, ...grouped.filter((c) => !featuredSlugs.includes(c.slug))];
  const inventory = await getInventoryMap();

  const explorerPosts = await getExplorerPosts();

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

        {trending.length > 0 && (
          <section className="border-b border-divider pb-16 pt-8">
            <p className="mb-6 text-caption uppercase tracking-[0.12em] text-secondary-text">
              Trending Now
            </p>
            <div className="grid grid-cols-2 gap-0.5 md:grid-cols-4">
              {trending.map((chapter, i) => (
                <CollectionItem
                  key={chapter.slug}
                  chapter={chapter}
                  index={i}
                  stockLabel={stockLabelFor(inventory[chapter.slug])}
                />
              ))}
            </div>
          </section>
        )}

        <section id="shop" className="scroll-mt-20 pb-24 pt-16">
          <p className="mb-3 text-caption uppercase tracking-[0.12em] text-secondary-text">New In</p>
          <h2 className="font-display text-display-m uppercase text-ink">The Collection</h2>
          <p className="mt-3 max-w-md font-sans text-body-s text-secondary-text">
            Sixteen shapes across two materials. Plastic ₹1,499, metal ₹1,999.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-0.5 md:grid-cols-4">
            {collection.map((chapter, i) => (
              <CollectionItem
                key={chapter.slug}
                chapter={chapter}
                index={i}
                stockLabel={stockLabelFor(inventory[chapter.slug])}
              />
            ))}
          </div>
        </section>

        <EditorialSplit
          image="/images/brand/editorial-01.jpg"
          eyebrow="Made For After Dark"
          title="Fashion First"
          copy="Frames built to be seen — bold shapes, real lens colour, designed for a night out."
        />
        <EditorialSplit
          image="/images/brand/editorial-02.jpg"
          eyebrow="New In"
          title="Light Tints"
          copy="Sixteen shapes, four lens moods. Pale blue, pink, green and peach across plastic and metal."
          ctaLabel="Discover The Collection"
          ctaHref="/#shop"
          reverse
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
