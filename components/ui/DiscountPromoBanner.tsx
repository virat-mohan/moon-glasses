"use client";

import { useDiscountRule } from "@/lib/useDiscountRule";
import { describeDiscountRule } from "@/lib/discounts";

/**
 * Announces the active bundle discount before a shopper ever reaches the
 * cart — cart/checkout only show the discount once it's actually applied,
 * which means someone with 1-2 pairs never learns the offer exists. Renders
 * nothing when no rule is active, so it's safe to drop in anywhere.
 */
export function DiscountPromoBanner({ className = "" }: { className?: string }) {
  const rule = useDiscountRule();
  if (!rule) return null;

  return (
    <div
      className={`inline-flex max-w-full flex-col items-center justify-center border border-tan-gold bg-cream px-5 py-2.5 text-center ${className}`}
    >
      <p className="overflow-hidden text-ellipsis whitespace-nowrap font-sans text-micro font-bold uppercase tracking-[0.06em] text-tan-gold md:text-caption">
        Here for Now: {describeDiscountRule(rule)}
      </p>
      <p className="font-sans text-micro normal-case text-secondary-text">(applied automatically at checkout)</p>
    </div>
  );
}
