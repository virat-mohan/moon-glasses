const STEPS = [
  { key: "cart", label: "Cart" },
  { key: "checkout", label: "Checkout" },
  { key: "confirmed", label: "Confirmed" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

/**
 * A 3-step breadcrumb (not the 4+ some checkouts use) — the actual UI only
 * has two real screens after the cart (the address+payment form, then the
 * confirmation), so a step per sub-state inside the form would be fake
 * precision. This just orients the shopper: bag it, check out, done.
 */
export function CheckoutSteps({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Checkout progress" className="mt-6 flex max-w-full items-center gap-1.5 sm:gap-2">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isDone
                    ? "bg-ink text-cream"
                    : isCurrent
                      ? "border border-ink text-ink"
                      : "border border-divider text-secondary-text"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span
                className={`text-micro uppercase tracking-[0.06em] sm:text-caption sm:tracking-[0.08em] ${
                  isCurrent ? "text-ink" : isDone ? "text-ink" : "text-secondary-text"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-3 shrink bg-divider sm:mx-1 sm:w-6" />}
          </div>
        );
      })}
    </nav>
  );
}
