"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pay With A Post share, fast: the post image is the server-rendered card
 * (made when the order was placed), so it shows instantly. Gold button →
 * phone share sheet with the image (Instagram is one tap); the caption is on
 * the clipboard to paste. Each kit is its own image with its own code. WhatsApp gets image + caption.
 */
export function SharePost({ orderId, kitId, cardUrl, caption }: { orderId: string; kitId: string; cardUrl: string; caption: string }) {
  const [state, setState] = useState<"idle" | "busy" | "shared" | "saved">("idle");
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(cardUrl);
  const [loaded, setLoaded] = useState(false);
  const [making, setMaking] = useState(false);
  // The image is fetched as soon as it's shown: iOS only opens the share
  // sheet if share() runs straight from the tap, with nothing awaited first.
  const fileRef = useRef<File | null>(null);
  useEffect(() => {
    fileRef.current = null;
    toJpegFile(url)
      .then((f) => (fileRef.current = f))
      .catch(() => {});
  }, [url]);

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
    } catch {}
  }

  async function share(withText: boolean) {
    // Not awaited: the share sheet must open in the same tap.
    navigator.clipboard?.writeText(caption).then(() => setCopied(true), () => {});
    let file = fileRef.current;
    if (!file) {
      setState("busy");
      try {
        file = fileRef.current = await toJpegFile(url);
      } catch {
        setState("idle");
        return;
      }
    }
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        // Instagram ignores shared text for feed posts (caption is pasted);
        // WhatsApp and others take it with the image.
        await navigator.share(withText ? { files: [file], text: caption } : { files: [file] });
        setState("shared");
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          setState("shared");
          return;
        }
      }
    }
    const objectUrl = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "moon-glasses-post.jpg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setState("saved");
  }

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="relative aspect-[4/5] w-full border border-ink/20 bg-surface-alt">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Your post"
          decoding="async"
          fetchPriority="high"
          onLoad={() => setLoaded(true)}
          onError={() => {
            // Not made yet (it's finished in the background after the order):
            // ask the server to make it, then show it.
            if (making) return;
            setMaking(true);
            fetch(`/api/barter/${orderId}/card?kit=${kitId}`)
              .then((r) => r.json())
              .then((d) => d.url && setUrl(`${d.url}?t=${Date.now()}`))
              .catch(() => {})
              .finally(() => setMaking(false));
          }}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
        {!loaded && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-caption text-secondary-text">
            making your post with your code… takes a few seconds.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => share(false)}
        disabled={state === "busy"}
        className="mt-4 w-full bg-[var(--moon-gold)] py-4 font-sans text-body-s font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 disabled:opacity-60"
      >
        {state === "busy" ? "Opening…" : state === "idle" ? "Share to Instagram" : "Share again"}
      </button>
      <button
        type="button"
        onClick={() => share(true)}
        disabled={state === "busy"}
        className="mt-2 block w-full border border-[var(--moon-gold)] py-3 text-center font-sans text-caption font-bold uppercase tracking-[0.08em] text-ink disabled:opacity-60"
      >
        Share on WhatsApp & more
      </button>
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
  // Cards are stored as JPEG now: share as-is, no re-encoding on the phone.
  if (blob.type === "image/jpeg") return new File([blob], "moon-glasses-post.jpg", { type: "image/jpeg" });
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
