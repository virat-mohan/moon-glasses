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
}: {
  chapter: Chapter;
  image: string;
  disabled?: boolean;
  quantity?: number;
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
      className="border border-ink px-6 py-2.5 font-sans text-caption font-medium uppercase tracking-[0.12em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-60"
    >
      {loading ? "..." : "Buy Now"}
    </button>
  );
}
