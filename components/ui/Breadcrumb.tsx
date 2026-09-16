import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

/** Collection -> Story Series -> Chapter, used at the top of series/chapter pages so a shopper can always step back up a level without hitting the browser back button. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-sans text-caption uppercase tracking-[0.08em] text-secondary-text transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`font-sans text-caption uppercase tracking-[0.08em] ${
                  isLast ? "text-ink" : "text-secondary-text"
                }`}
              >
                {item.label}
              </span>
            )}
            {!isLast && <span className="text-caption text-secondary-text">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
