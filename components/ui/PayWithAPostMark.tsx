/**
 * The one consistent way "Pay With A Post" ever renders in customer-facing
 * copy — its own editorial serif face (Bodoni Moda, reserved for this mark
 * alone — see app/layout.tsx), scaled up and gold-accented regardless of
 * surrounding text color/size, with a trademark mark, so it reads as a
 * named feature/brand term rather than a plain description. Swap every
 * literal "Pay With A Post" string in JSX for this instead of typing the
 * phrase directly.
 *
 * `withHint` adds a small "?" affordance with a one-line plain-English
 * explainer on hover/focus — only safe in non-interactive contexts
 * (headings, standalone copy), never inside an existing <button> or <Link>,
 * since it renders its own focusable element and nested interactive
 * controls break both HTML validity and click targeting.
 */
export function PayWithAPostMark({
  className = "",
  withHint = false,
}: {
  className?: string;
  withHint?: boolean;
}) {
  return (
    <span className={`group/pwap relative inline-flex items-baseline gap-1.5 whitespace-nowrap ${className}`}>
      <span
        className="relative inline-flex items-baseline whitespace-nowrap text-[1.15em] italic font-bold normal-case tracking-[0.01em] text-tan-gold [text-shadow:0_0_18px_rgba(231,199,122,0.4)]"
        style={{ fontFamily: "var(--font-bodoni-moda)" }}
      >
        <span className="bg-[linear-gradient(var(--moon-gold),var(--moon-gold))] bg-[length:100%_2px] bg-no-repeat bg-[position:0_100%] pb-[0.12em]">
          Pay With A Post
        </span>
        <sup className="ml-1 -translate-y-px font-sans text-[0.55em] font-bold not-italic tracking-normal [text-shadow:none]">
          ™
        </sup>
      </span>

      {withHint && (
        <span
          tabIndex={0}
          role="note"
          title="Post about us on Instagram instead of paying — get your sunglasses free."
          className="relative inline-flex h-[1.05em] w-[1.05em] shrink-0 cursor-help items-center justify-center self-center rounded-full border border-tan-gold/70 font-sans text-[0.6em] font-bold not-italic tracking-normal text-tan-gold"
        >
          ?
          <span className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-20 w-[min(15rem,85vw)] -translate-x-1/2 scale-95 rounded border border-divider bg-[var(--moon-black)] p-3 text-left text-caption font-sans normal-case leading-relaxed tracking-normal text-secondary-text opacity-0 shadow-xl transition-all duration-150 group-hover/pwap:scale-100 group-hover/pwap:opacity-100 group-focus-within/pwap:scale-100 group-focus-within/pwap:opacity-100">
            Post about us on Instagram instead of paying — get your sunglasses free.
          </span>
        </span>
      )}
    </span>
  );
}
