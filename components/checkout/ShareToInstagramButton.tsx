"use client";

import { useState } from "react";

const CANVAS_W = 1080;
const CANVAS_H = 1350; // 4:5 — Instagram's max feed portrait; posts fine to a Story too (with letterboxing)
const HERO_IMAGE = "/images/chapters/moon-octagon-silver-light-brown/lifestyle.jpg";
const LOGO_IMAGE = "/images/brand/moon-glasses-logo.png";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Builds the actual post — a real, screenshot-worthy piece of content
 * (editorial hero shot, brand logo, headline, and the code) rather than a
 * sheet of instructions. Deliberately carries NO "post this / tag us"
 * meta-instructions — those belong on the page around the button, since a
 * genuine Instagram post should never read like a how-to.
 */
async function buildShareCard(couponCode: string): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const [hero, logo] = await Promise.all([loadImage(HERO_IMAGE), loadImage(LOGO_IMAGE)]);
  if (hero) drawCover(ctx, hero, 0, 0, CANVAS_W, CANVAS_H);

  // Top gradient — just enough to seat the logo legibly over the photo.
  const topGrad = ctx.createLinearGradient(0, 0, 0, 260);
  topGrad.addColorStop(0, "rgba(5,5,5,0.75)");
  topGrad.addColorStop(1, "rgba(5,5,5,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CANVAS_W, 260);

  // Bottom gradient — the editorial-poster treatment that seats headline/code.
  const bottomGrad = ctx.createLinearGradient(0, CANVAS_H - 620, 0, CANVAS_H);
  bottomGrad.addColorStop(0, "rgba(5,5,5,0)");
  bottomGrad.addColorStop(0.45, "rgba(5,5,5,0.82)");
  bottomGrad.addColorStop(1, "rgba(5,5,5,0.96)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, CANVAS_H - 620, CANVAS_W, 620);

  if (logo) {
    const logoH = 64;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (CANVAS_W - logoW) / 2, 56, logoW, logoH);
  }

  ctx.textAlign = "center";

  // Headline.
  ctx.fillStyle = "#f2efe6";
  ctx.font = "800 84px 'Space Grotesk', Arial, sans-serif";
  ctx.fillText("SPREAD THE", CANVAS_W / 2, CANVAS_H - 470);
  ctx.fillStyle = "#d9a94c";
  ctx.fillText("GOOD VIBES", CANVAS_W / 2, CANVAS_H - 380);

  // Sub-copy, written for whoever is looking at the post, not the poster.
  ctx.fillStyle = "#e4e1d8";
  ctx.font = "400 32px Arial, sans-serif";
  const lines = wrapText(ctx, "Shades made to be seen. Use the code below for something special.", CANVAS_W - 220);
  let ly = CANVAS_H - 310;
  for (const line of lines) {
    ctx.fillText(line, CANVAS_W / 2, ly);
    ly += 42;
  }

  // Code pill.
  const pillY = ly + 30;
  const pillW = 460;
  const pillH = 96;
  const pillX = (CANVAS_W - pillW) / 2;
  ctx.strokeStyle = "#d9a94c";
  ctx.lineWidth = 3;
  ctx.strokeRect(pillX, pillY, pillW, pillH);
  ctx.fillStyle = "#f2efe6";
  ctx.font = "700 44px 'Space Grotesk', Arial, sans-serif";
  ctx.fillText(couponCode, CANVAS_W / 2, pillY + pillH / 2 + 16);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}

export function ShareToInstagramButton({
  couponCode,
  brandName,
  instagramHandle,
  requiredOrders,
}: {
  couponCode: string;
  brandName: string;
  instagramHandle: string;
  requiredOrders: number;
}) {
  const [status, setStatus] = useState<"idle" | "building" | "shared" | "downloaded" | "copied">("idle");
  // The accompanying share text — informational for the poster (some share
  // targets prefill it as the caption, some don't), kept separate from the
  // image itself, which carries none of this.
  const caption = `Spreading the Good Vibes 🌙 Use my ${brandName} code ${couponCode} — tag ${instagramHandle} as collaborator when you post.`;

  async function share() {
    setStatus("building");
    const blob = await buildShareCard(couponCode);

    if (blob) {
      const file = new File([blob], "moon-glasses-good-vibes.png", { type: "image/png" });
      // Web Share API (level 2, files) is the real "share to Instagram" path
      // on a phone — iOS Safari 15+ and Android Chrome both list Instagram
      // as a target, and Instagram itself then offers Post or Story. There
      // is no API to publish directly as the user without this share-sheet
      // step — Instagram doesn't expose one, on any platform.
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ files: [file], text: caption });
          setStatus("shared");
          return;
        } catch {
          // user cancelled, or the browser refused — fall through to download
        }
      }
      // Desktop / unsupported browsers: hand over the actual image file —
      // downloading is the honest option there, since there's no installed
      // Instagram app for the OS share sheet to hand off to.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moon-glasses-good-vibes.png";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("downloaded");
    }

    try {
      await navigator.clipboard.writeText(caption);
      if (status !== "shared") setStatus("copied");
    } catch {
      // caption is shown on the page either way
    }
  }

  const label =
    status === "building"
      ? "Preparing…"
      : status === "shared"
        ? "Shared — Nice One"
        : status === "downloaded"
          ? "Image Saved — Caption Copied"
          : status === "copied"
            ? "Caption Copied"
            : "Share To Instagram";

  return (
    <div>
      <button
        type="button"
        onClick={share}
        disabled={status === "building"}
        className="border border-ink bg-ink px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream hover:bg-cream hover:text-ink disabled:opacity-60"
      >
        {label}
      </button>
      <p className="mt-2 max-w-[360px] text-caption text-secondary-text">
        Post or Story — whichever you&apos;re confident can get you {requiredOrders} sales. Same image works
        for both. When you post it, add {instagramHandle} as a collaborator (or tag us if collaborator
        invites aren&apos;t available to you).
      </p>
    </div>
  );
}
