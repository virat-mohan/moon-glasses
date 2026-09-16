"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Chapter } from "@/types/chapter";
import { trackEvent } from "@/lib/client-tracking";

export type CartItem = {
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (chapter: Chapter, image: string, quantity?: number) => void;
  removeItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  /** True once the initial localStorage read has completed — callers that add
   * items programmatically on mount (e.g. a cart deep-link) must wait for
   * this, otherwise the hydration read commits after their add and wipes it. */
  loaded: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "moonglasses-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  function addItem(chapter: Chapter, image: string, quantity = 1) {
    trackEvent("AddToCart", { chapterSlug: chapter.slug, value: chapter.price * quantity });
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === chapter.slug);
      if (existing) {
        return prev.map((i) =>
          i.slug === chapter.slug ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        { slug: chapter.slug, name: chapter.name, price: chapter.price, image, quantity },
      ];
    });
  }

  function removeItem(slug: string) {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }

  function setQuantity(slug: string, quantity: number) {
    if (quantity < 1) {
      removeItem(slug);
      return;
    }
    setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, quantity } : i)));
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, setQuantity, clear, count, subtotal, loaded }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
