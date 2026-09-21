import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { chapters as staticChapters, chapterImageSrc, shortProductName, SHARED_SPECS } from "@/lib/chapters";
import { getAllChapters, getLimitedSeriesChapters } from "@/lib/chapters-dynamic";
import { getExplorerPostsForChapter } from "@/lib/community";
import { getInventoryMap, stockLabelFor } from "@/lib/inventory";
import { getBrandProfile } from "@/lib/brand";
import { Product360Viewer } from "@/components/chapter/Product360Viewer";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { AddToCartButton } from "@/components/chapter/AddToCartButton";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import { ViewContentTracker } from "@/components/tracking/ViewContentTracker";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DiscountPromoBanner } from "@/components/ui/DiscountPromoBanner";
import { RestockNotifyForm } from "@/components/chapter/RestockNotifyForm";
import { getApprovedReviews, getReviewSummary } from "@/lib/reviews";
import type { Chapter } from "@/types/chapter";

export function generateStaticParams() {
  return staticChapters.map((c) => ({ slug: c.slug }));
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Random pick, capped at `limit`, guaranteeing one Limited Series item first when the pool has one. */
function pickContinueExploring<T extends Chapter>(pool: T[], limitedSlugs: Set<string>, limit: number): T[] {
  const limitedInPool = shuffle(pool.filter((c) => limitedSlugs.has(c.slug)));
  const corePool = shuffle(pool.filter((c) => !limitedSlugs.has(c.slug)));
  const picked: T[] = limitedInPool.length > 0 ? [limitedInPool[0]] : [];
  for (const c of corePool) {
    if (picked.length >= limit) break;
    picked.push(c);
  }
  return picked;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const chapter = staticChapters.find((c) => c.slug === slug);
  if (!chapter) return {};
  const image = chapterImageSrc(chapter.folder, chapter.sideImage);
  const description = `${chapter.name} — ${chapter.story}`.slice(0, 200);
  return {
    title: chapter.name,
    description,
    openGraph: { title: chapter.name, description, images: [image] },
    twitter: { card: "summary_large_image", title: chapter.name, description, images: [image] },
  };
}

export default async function ChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const allChapters = await getAllChapters();
  const chapter = allChapters.find((c) => c.slug === slug);
  if (!chapter) notFound();
  // Draft master-inventory products (live === false) aren't published yet —
  // treat their URL as not found rather than leaking an unfinished/unpriced
  // product to anyone who guesses the slug.
  if (chapter.live === false) notFound();

  // Capped at 4 and randomized rather than the full same-material list —
  // that could be dozens of tiles as Master Inventory grows, which is what
  // was actually slowing this section down. Guarantees one Limited Series
  // piece when one exists, so it stays discoverable from a core product
  // page instead of only surfacing to someone who already knows to look
  // for /limited-series.
  const limitedChapters = await getLimitedSeriesChapters();
  const limitedSlugs = new Set(limitedChapters.map((c) => c.slug));
  const otherPool = allChapters
    .filter((c) => c.series === chapter.series)
    .filter((c) => c.slug !== chapter.slug)
    .filter((c) => c.live !== false);
  const others = pickContinueExploring(otherPool, limitedSlugs, 4);
  const explorerPosts = await getExplorerPostsForChapter(chapter.slug);
  const inventory = await getInventoryMap();
  const stock = inventory[chapter.slug];
  const stockLabel = stockLabelFor(stock);
  const brand = await getBrandProfile();
  const siteUrl = brand.siteUrl.replace(/\/$/, "");
  const productImage = `${siteUrl}${chapterImageSrc(chapter.folder, chapter.sideImage)}`;
  const [reviews, reviewSummary] = await Promise.all([
    getApprovedReviews(chapter.slug),
    getReviewSummary(chapter.slug),
  ]);

  // Product + Breadcrumb structured data — the concrete facts (price,
  // availability, brand) answer engines pull to respond to "how much is
  // the Moonglasses X sunglasses" style queries without a human ever landing here.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: chapter.name,
    description: chapter.story,
    image: productImage,
    brand: { "@type": "Brand", name: brand.brandName },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/chapter/${chapter.slug}`,
      priceCurrency: "INR",
      price: chapter.price,
      availability:
        stockLabel === "out-of-stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
    ...(reviewSummary
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewSummary.average,
            reviewCount: reviewSummary.count,
          },
        }
      : {}),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Collection", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: chapter.name,
        item: `${siteUrl}/chapter/${chapter.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ViewContentTracker chapterSlug={chapter.slug} value={chapter.price} />
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-28 md:px-12 md:pt-36">
        <Breadcrumb
          items={[
            { label: "Collection", href: "/" },
            { label: chapter.series },
            { label: shortProductName(chapter.name) },
          ]}
        />
        <div className="mt-6 grid grid-cols-1 gap-12 md:grid-cols-2">
          <Product360Viewer folder={chapter.folder} images={chapter.images} name={chapter.name} />

          <div className="md:pt-4">
            <h1 className="font-display text-heading-xl uppercase text-ink">{shortProductName(chapter.name)}</h1>
            <p className="mt-3 font-sans text-body-l text-ink">₹{chapter.price.toLocaleString("en-IN")}</p>
            {reviewSummary && (
              <a href="#reviews" className="mt-2 inline-block font-sans text-caption text-secondary-text">
                <span className="text-tan-gold">★</span> {reviewSummary.average} ({reviewSummary.count})
              </a>
            )}
            <DiscountPromoBanner className="mt-4" />

            <p className="mt-6 max-w-md font-sans text-body text-secondary-text">{chapter.story}</p>

            {!chapter.verifiedOnSite && (
              <p className="mt-4 max-w-md font-sans text-caption text-paint-orange">
                Not yet confirmed live on moon-glasses.store — verify pricing and description before
                publishing.
              </p>
            )}

            {stockLabel && (
              <p
                className={`mt-4 font-sans text-caption font-bold uppercase tracking-[0.05em] ${
                  stockLabel === "out-of-stock" ? "text-paint-orange" : "text-tan-gold"
                }`}
              >
                {stockLabel === "out-of-stock" ? "Sold Out" : "Selling Fast"}
              </p>
            )}

            <div className="mt-10 flex flex-wrap gap-4 [&>button]:min-w-[200px]">
              <AddToCartButton
                chapter={chapter}
                image={chapterImageSrc(chapter.folder, chapter.primary)}
                disabled={stockLabel === "out-of-stock"}
              />
              <BuyNowButton
                chapter={chapter}
                image={chapterImageSrc(chapter.folder, chapter.primary)}
                disabled={stockLabel === "out-of-stock"}
              />
            </div>

            {stockLabel !== "out-of-stock" && (
              <p className="mt-3 font-sans text-caption text-secondary-text">
                <span className="text-tan-gold">New:</span> Skip the payment — Buy Now with{" "}
                <Link href="/#pay-with-a-post" className="underline underline-offset-4 hover:text-ink">
                  Pay With A Post
                </Link>{" "}
                instead.
              </p>
            )}

            {stockLabel === "out-of-stock" && <RestockNotifyForm chapterSlug={chapter.slug} />}

            <div className="mt-10 border-t border-divider pt-6">
              <p className="font-display text-body-s uppercase tracking-[0.05em] text-ink">
                Moonglasses Craftsmanship
              </p>
              <ul className="mt-3 space-y-1.5">
                {SHARED_SPECS.map((spec) => (
                  <li key={spec} className="flex gap-2 font-sans text-caption text-secondary-text">
                    <span aria-hidden>•</span>
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>

              <div className="relative mt-5 aspect-[8/3] w-full overflow-hidden bg-[var(--moon-black)]">
                <Image
                  src="/images/brand/case-and-pouch.png"
                  alt="MOON Glasses branded case with microfiber cleaning cloth, included with every pair"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-contain p-2"
                />
              </div>
              <p className="mt-2 font-sans text-caption text-secondary-text">
                Every pair ships in a branded MOON Glasses case with a microfiber cleaning cloth.
              </p>
            </div>
          </div>
        </div>

        {reviews.length > 0 && (
          <section id="reviews" className="mt-24 border-t border-divider pt-16 md:mt-32">
            <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
              Reviews {reviewSummary && `— ★ ${reviewSummary.average} (${reviewSummary.count})`}
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {reviews.map((r) => (
                <div key={r.id} className="border-t border-divider pt-4">
                  <p className="text-tan-gold">
                    {"★".repeat(r.rating)}
                    <span className="text-divider">{"★".repeat(5 - r.rating)}</span>
                  </p>
                  {r.review_text && (
                    <p className="mt-2 font-sans text-body-s text-ink">{r.review_text}</p>
                  )}
                  <p className="mt-2 text-caption text-secondary-text">{r.customer_name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {explorerPosts.length > 0 && (
          <section className="mt-24 border-t border-divider pt-16 md:mt-32">
            <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
              Explorers Wearing {shortProductName(chapter.name)}
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {explorerPosts.map((post) => (
                <div key={post.file}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                    <Image
                      src={post.src}
                      alt={post.testimonial}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-3 text-caption text-secondary-text">
                    &ldquo;{post.testimonial}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="mt-32 border-t border-divider pt-16">
            <p className="mb-6 text-caption uppercase tracking-[0.08em] text-secondary-text">
              Continue Exploring — {chapter.series}
            </p>
            <div className="grid grid-cols-2 gap-0 md:grid-cols-5">
              {others.map((c, i) => (
                <CollectionItem
                  key={c.slug}
                  chapter={c}
                  index={i}
                  stockLabel={stockLabelFor(inventory[c.slug])}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="mt-32">
        <NewsletterBlock />
        <FooterEditorial />
      </div>
    </>
  );
}
