"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import type { Chapter } from "@/types/chapter";

export function BuyNowButton({
  chapter,
  image,
  disabled = false,
  quantity = 1,
  variant = "outline",
}: {
  chapter: Chapter;
  image: string;
  disabled?: boolean;
  quantity?: number;
  /** "outline" is the bordered PDP button; "minimal" is a plain text link (no box) for tight tile overlays. */
  variant?: "outline" | "minimal";
}) {
  const { clear, addItem } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (disabled) return null;

  function handleClick() {
    setLoading(true);
    clear();
    addItem(chapter, image, quantity);
    router.push("/checkout");
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={
        variant === "minimal"
          ? "font-sans text-caption font-medium tracking-[0.02em] text-white transition-colors duration-200 hover:text-[var(--moon-gold)] disabled:opacity-60"
          : "border border-ink px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-60"
      }
    >
      {loading ? "Working…" : "Buy Now"}
    </button>
  );
}
