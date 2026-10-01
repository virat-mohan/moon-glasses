"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pay With A Post share, fast: the post image is the server-rendered card
 * (made when the order was placed), so it shows instantly. One gold button:
 * caption copied → phone share sheet with the image (Instagram is one tap) →
 * fallback saves the image (and on a phone, opens Instagram).
 */
export function SharePost({ cardUrl, caption }: { cardUrl: string; caption: string }) {
  const [state, setState] = useState<"idle" | "busy" | "shared" | "saved">("idle");
  const [copied, setCopied] = useState(false);
  // The image is fetched as soon as the page opens: iOS only opens the share
  // sheet if share() runs straight from the tap, with nothing awaited first.
  const fileRef = useRef<File | null>(null);
  useEffect(() => {
    fetch(cardUrl)
      .then((r) => r.blob())
      .then((blob) => {
        fileRef.current = new File([blob], "moon-glasses-post.png", { type: "image/png" });
      })
      .catch(() => {});
  }, [cardUrl]);

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
    } catch {}
  }

  async function share() {
    // Not awaited: the share sheet must open in the same tap.
    navigator.clipboard?.writeText(caption).then(() => setCopied(true), () => {});
    let file = fileRef.current;
    if (!file) {
      setState("busy");
      try {
        const blob = await (await fetch(cardUrl)).blob();
        file = fileRef.current = new File([blob], "moon-glasses-post.png", { type: "image/png" });
      } catch {
        setState("idle");
        return;
      }
    }
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        // Instagram ignores shared text for feed posts, so the caption goes
        // via the clipboard.
        await navigator.share({ files: [file] });
        setState("shared");
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          setState("shared");
          return;
        }
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = "moon-glasses-post.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setState("saved");
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
          : state === "idle"
            ? "Share to Instagram"
            : "Share again"}
      </button>
      {state !== "idle" && state !== "busy" && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(caption)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full border border-[var(--moon-gold)] py-3 text-center font-sans text-caption font-bold uppercase tracking-[0.08em] text-ink"
        >
          Send your code on WhatsApp
        </a>
      )}
      <div className="mt-4 border-2 border-[var(--moon-gold)] p-4">
        <p className="font-sans text-body-s font-bold text-ink">
          In Instagram: tap the caption box → <span className="text-[var(--moon-gold)]">Paste</span>
        </p>
        <p className="mt-2 whitespace-pre-line text-caption text-secondary-text">{caption}</p>
        <button
          type="button"
          onClick={copyCaption}
          className="mt-3 w-full border border-[var(--moon-gold)] py-2.5 font-sans text-caption font-bold uppercase tracking-[0.08em] text-ink"
        >
          {copied ? "Caption copied ✓" : "Copy caption"}
        </button>
      </div>
    </div>
  );
}
