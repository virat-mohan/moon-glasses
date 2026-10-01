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
    toJpegFile(cardUrl)
      .then((f) => (fileRef.current = f))
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
        file = fileRef.current = await toJpegFile(cardUrl);
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
    a.download = "moon-glasses-post.jpg";
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

/**
 * The share image as a JPEG: Android's Instagram only offers "Feed" (post)
 * in the share sheet for JPEGs; with a PNG it shows Chats only.
 */
async function toJpegFile(url: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0);
  const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!jpeg) throw new Error("jpeg failed");
  return new File([jpeg], "moon-glasses-post.jpg", { type: "image/jpeg" });
}
