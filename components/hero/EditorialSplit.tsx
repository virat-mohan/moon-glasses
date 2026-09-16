import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";

/**
 * Big image + short copy, alternating sides — section 27 of the design
 * spec. Renders nothing if the numbered editorial image doesn't exist yet
 * (see IMAGE_PROMPTS.md section 2), so this is safe to leave in the tree
 * before the photos are ready.
 */
export function EditorialSplit({
  index,
  eyebrow,
  title,
  copy,
  ctaLabel,
  ctaHref,
  reverse = false,
}: {
  index: number;
  eyebrow: string;
  title: string;
  copy: string;
  ctaLabel: string;
  ctaHref: string;
  reverse?: boolean;
}) {
  const relPath = `images/brand/editorial-${String(index).padStart(2, "0")}.jpg`;
  const exists = fs.existsSync(path.join(process.cwd(), "public", relPath));
  if (!exists) return null;

  const image = (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#111]">
      <Image src={`/${relPath}`} alt={title} fill sizes="50vw" className="object-cover" />
    </div>
  );

  const text = (
    <div className="flex flex-col justify-center">
      <p className="font-sans text-micro uppercase tracking-[0.3em] text-secondary-text">{eyebrow}</p>
      <h3 className="mt-4 font-display text-display-m uppercase text-ink">{title}</h3>
      <p className="mt-4 max-w-sm font-sans text-body-s text-secondary-text">{copy}</p>
      <Link
        href={ctaHref}
        className="mt-6 inline-block w-fit border border-white px-8 py-3 font-sans text-body-s uppercase tracking-[0.1em] text-white transition-colors hover:bg-white hover:text-black"
      >
        {ctaLabel}
      </Link>
    </div>
  );

  return (
    <section className="grid grid-cols-1 gap-10 border-t border-divider py-20 md:grid-cols-2 md:gap-16">
      {reverse ? (
        <>
          <div className="order-2 md:order-1">{text}</div>
          <div className="order-1 md:order-2">{image}</div>
        </>
      ) : (
        <>
          {image}
          {text}
        </>
      )}
    </section>
  );
}
