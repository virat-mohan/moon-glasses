"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import type { Chapter } from "@/types/chapter";

/** Puts the verified lines into the site cart (replacing it), tags the visit as WhatsApp, then goes to checkout. */
export function LoadCart({ lines }: { lines: { chapter: Chapter; image: string; quantity: number }[] }) {
  const { clear, addItem, loaded } = useCart();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!loaded || done.current) return;
    done.current = true;
    try {
      // Same keys captureUtmSource uses; the allowed value is utm_source=whatsapp (docs/GROWTH-MACHINE.md).
      localStorage.setItem("moonglasses-utm-source", JSON.stringify({ source: "whatsapp", capturedAt: Date.now() }));
    } catch {}
    clear();
    for (const l of lines) addItem(l.chapter, l.image, l.quantity);
    router.replace("/checkout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <main className="mx-auto w-full max-w-[480px] px-6 pb-24 pt-40 text-center">
      <p className="animate-pulse text-body text-secondary-text">getting your cart ready…</p>
    </main>
  );
}
