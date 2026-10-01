"use client";

import { useEffect, useState } from "react";

/**
 * Opens WhatsApp to the store's API number with a pre-filled request. The
 * shopper messaging first opens WhatsApp's 24-hour window, so our automatic
 * reply (their share image, code and steps) always gets delivered.
 */
export function GetPostOnWhatsApp({ code, className = "" }: { code: string; className?: string }) {
  const [number, setNumber] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/whatsapp-number")
      .then((r) => r.json())
      .then((d) => setNumber(d.number ?? null))
      .catch(() => {});
  }, []);
  if (!number) return null;
  const text = `Send my Pay With A Post image · code ${code}`;
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 bg-[#25D366] px-5 py-3 font-sans text-caption font-bold uppercase tracking-[0.05em] text-black ${className}`}
    >
      Get my post on WhatsApp
    </a>
  );
}
