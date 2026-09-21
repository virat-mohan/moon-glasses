/**
 * The one consistent way "Pay With A Post" ever renders in customer-facing
 * copy — a distinct display-face, gold-accented treatment (regardless of
 * surrounding text color/size) with a trademark mark, so it reads as a
 * named feature/brand term rather than a plain description, the same way
 * the site treats its own name. Swap every literal "Pay With A Post" string
 * in JSX for this instead of typing the phrase directly.
 */
export function PayWithAPostMark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-baseline whitespace-nowrap font-display tracking-[0.02em] text-tan-gold ${className}`}>
      Pay With A Post
      <sup className="ml-0.5 font-sans text-[0.45em] font-normal not-italic tracking-normal">™</sup>
    </span>
  );
}
