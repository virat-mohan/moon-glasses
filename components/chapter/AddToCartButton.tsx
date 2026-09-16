"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import type { Chapter } from "@/types/chapter";

export function AddToCartButton({
  chapter,
  image,
  disabled = false,
  quantity = 1,
}: {
  chapter: Chapter;
  image: string;
  disabled?: boolean;
  quantity?: number;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <div className="flex items-center gap-4">
        <span className="font-sans text-caption uppercase tracking-[0.05em] text-ink">
          Added to cart
        </span>
        <Link
          href="/cart"
          className="font-sans text-caption uppercase tracking-[0.1em] text-ink underline underline-offset-4"
        >
          View Cart
        </Link>
      </div>
    );
  }

  if (disabled) {
    return (
      <button
        disabled
        className="cursor-not-allowed border border-divider bg-surface-alt px-6 py-2.5 font-sans text-caption font-medium uppercase tracking-[0.12em] text-secondary-text"
      >
        Sold Out
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        addItem(chapter, image, quantity);
        setAdded(true);
      }}
      className="border border-ink bg-ink px-6 py-3.5 font-sans text-caption font-medium uppercase tracking-[0.1em] text-cream transition-colors duration-200 hover:bg-cream hover:text-ink"
    >
      Add to Cart
    </button>
  );
}
