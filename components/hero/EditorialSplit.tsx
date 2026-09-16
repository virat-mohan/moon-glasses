import Image from "next/image";
import Link from "next/link";

/**
 * Big image + short copy, alternating sides. Takes the image path directly
 * rather than fs-checking for a numbered file first — that check was
 * unreliable on Vercel's serverless functions (public/ assets aren't
 * always traced into the function bundle), silently hiding these sections
 * in production even though the image was genuinely deployed.
 */
export function EditorialSplit({
  image: imageSrc,
  eyebrow,
  title,
  copy,
  ctaLabel,
  ctaHref,
  reverse = false,
}: {
  image: string;
  eyebrow: string;
  title: string;
  copy: string;
  ctaLabel: string;
  ctaHref: string;
  reverse?: boolean;
}) {
  const image = (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#111]">
      <Image src={imageSrc} alt={title} fill sizes="50vw" className="object-cover" />
    </div>
  );

  const text = (
    <div className="flex flex-col justify-center">
      <p className="font-sans text-micro uppercase tracking-[0.3em] text-secondary-text">{eyebrow}</p>
      <h3 className="mt-4 font-display text-display-m uppercase text-ink">{title}</h3>
      <p className="mt-4 max-w-sm font-sans text-body-s text-secondary-text">{copy}</p>
      <Link
        href={ctaHref}
        className="mt-6 inline-block w-fit font-sans text-body-s uppercase tracking-[0.15em] text-white transition-colors duration-200 hover:text-[var(--moon-gold)]"
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
