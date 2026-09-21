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
    <span
      className={`relative inline-flex items-baseline whitespace-nowrap font-display font-bold italic normal-case tracking-[0.01em] text-tan-gold [text-shadow:0_0_16px_rgba(231,199,122,0.35)] ${className}`}
    >
      <span className="bg-[linear-gradient(var(--moon-gold),var(--moon-gold))] bg-[length:100%_1.5px] bg-no-repeat bg-[position:0_100%] pb-[0.15em]">
        Pay With A Post
      </span>
      <sup className="ml-0.5 -translate-y-px font-sans text-[0.4em] font-semibold not-italic tracking-normal [text-shadow:none]">
        ™
      </sup>
    </span>
  );
}
