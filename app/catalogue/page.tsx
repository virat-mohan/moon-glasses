import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";
import { getInventoryMap } from "@/lib/inventory";
import { liveCatalogue } from "@/lib/catalogue";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export const metadata = {
  title: "Catalogue",
  description: "Every Moonglasses pair that's live, with the model wearing it.",
  robots: { index: false, follow: true },
};
export const revalidate = 600;

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default async function CataloguePage() {
  const [all, stock] = await Promise.all([getAllChapters(), getInventoryMap()]);
  const items = liveCatalogue(all);
  const sections = ["Collection", "Limited Series"] as const;

  return (
    <>
      <main className="mx-auto w-full max-w-[1100px] px-4 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Catalogue</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Every pair that&apos;s live</h1>
        <p className="mt-3 text-body-s text-secondary-text">
          {items.length} pairs, with the model wearing each one. Prices include GST and shipping is free.
        </p>
        <p className="mt-2 text-caption text-secondary-text">
          Product feed for WhatsApp Business, Facebook and Instagram:{" "}
          <a href="/api/product-feed" className="underline underline-offset-4">
            /api/product-feed
          </a>
        </p>

        {sections.map((section) => {
          const list = items.filter((i) => i.collectionLabel === section);
          if (list.length === 0) return null;
          return (
            <section key={section} className="mt-12">
              <h2 className="font-display text-heading-s uppercase text-ink">{section}</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
                {list.map((p) => {
                  const img = p.modelImage ?? chapterImageSrc(p.folder, p.sideImage);
                  return (
                    <a key={p.slug} href={`/chapter/${p.slug}`} className="block border border-divider">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={p.name} loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
                      <div className="p-3">
                        <p className="font-sans text-caption font-bold uppercase tracking-[0.04em] text-ink">{p.group}</p>
                        <p className="mt-0.5 text-caption text-secondary-text">{p.colour}</p>
                        <p className="mt-1 text-body-s text-ink">
                          {inr(p.price)}
                          {(stock[p.slug] ?? 0) <= 0 && <span className="ml-2 text-caption text-secondary-text">sold out</span>}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
      <FooterEditorial />
    </>
  );
}
