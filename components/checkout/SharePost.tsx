"use client";

import { useState } from "react";

/**
 * Pay With A Post share, fast: the post image is the server-rendered card
 * (made when the order was placed), so it shows instantly. One gold button:
 * caption copied → phone share sheet with the image (Instagram is one tap) →
 * fallback saves the image (and on a phone, opens Instagram).
 */
export function SharePost({ cardUrl, caption }: { cardUrl: string; caption: string }) {
  const [state, setState] = useState<"idle" | "busy" | "shared" | "saved">("idle");

  async function share() {
    setState("busy");
    try {
      await navigator.clipboard.writeText(caption);
    } catch {}
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const file = new File([blob], "moon-glasses-post.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ files: [file] });
          setState("shared");
          return;
        } catch {}
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moon-glasses-post.png";
      a.click();
      URL.revokeObjectURL(url);
      setState("saved");
      if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
        setTimeout(() => (window.location.href = "instagram://library"), 800);
      }
    } catch {
      setState("idle");
    }
  }

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cardUrl} alt="Your post" className="aspect-[4/5] w-full border border-ink/20 object-cover" />
      <button
        type="button"
        onClick={share}
        disabled={state === "busy"}
        className="mt-4 w-full bg-[var(--moon-gold)] py-4 font-sans text-body-s font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 disabled:opacity-60"
      >
        {state === "busy"
          ? "Opening…"
          : state === "shared"
            ? "Shared ✓"
            : state === "saved"
              ? "Image saved · caption copied"
              : "Share to Instagram"}
      </button>
      <p className="mt-2 text-center text-caption text-secondary-text">Caption copied: just paste it in Instagram.</p>
    </div>
  );
}
