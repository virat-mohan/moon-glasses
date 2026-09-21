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
      <Link
        href="/cart"
        className="inline-flex items-center justify-center border border-ink bg-ink px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream transition-colors hover:bg-cream hover:text-ink"
      >
        Added — View Cart
      </Link>
    );
  }

  if (disabled) {
    return (
      <button
        disabled
        className="cursor-not-allowed border border-divider bg-surface-alt px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-secondary-text"
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
      className="border border-ink bg-ink px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream transition-colors hover:bg-cream hover:text-ink"
    >
      Add to Cart
    </button>
  );
}
