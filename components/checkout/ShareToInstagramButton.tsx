"use client";

import { useState } from "react";

const CANVAS_W = 1080;
const CANVAS_H = 1350; // 4:5 — Instagram's max feed portrait; posts fine to a Story too (with letterboxing)

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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

/** Builds the actual shareable image — a branded card (product photo, logo, headline, the offer explained, and the unique code) rather than a bare text caption, since that's what makes a share worth posting. */
async function buildShareCard(params: {
  brandName: string;
  instagramHandle: string;
  couponCode: string;
  productImageUrl: string | null;
  requiredOrders: number;
}): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background: near-black with a soft warm glow behind the product, matching the site's dark editorial palette.
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const glow = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H * 0.42, 60, CANVAS_W / 2, CANVAS_H * 0.42, CANVAS_W * 0.6);
  glow.addColorStop(0, "rgba(217, 169, 76, 0.16)");
  glow.addColorStop(1, "rgba(217, 169, 76, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Logo wordmark (text-based — reliable regardless of the source PNG's exact crop/whitespace).
  ctx.textAlign = "center";
  ctx.fillStyle = "#d9a94c";
  ctx.font = "600 40px 'Space Grotesk', Arial, sans-serif";
  ctx.fillText(brandNameSpaced(params.brandName), CANVAS_W / 2, 110);

  // Product photo, centered.
  if (params.productImageUrl) {
    const img = await loadImage(params.productImageUrl);
    if (img) {
      const maxW = CANVAS_W * 0.72;
      const maxH = 560;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (CANVAS_W - w) / 2;
      const y = 170;
      ctx.drawImage(img, x, y, w, h);
    }
  }

  // Headline.
  ctx.fillStyle = "#f2efe6";
  ctx.font = "800 76px 'Space Grotesk', Arial, sans-serif";
  ctx.fillText("GET FREE SHADES", CANVAS_W / 2, 830);

  // Sub-copy explaining the offer.
  ctx.fillStyle = "#c9c5ba";
  ctx.font = "400 32px Arial, sans-serif";
  const lines = wrapText(
    ctx,
    `Post this. Get ${params.requiredOrders} friends to buy with my code. My pair ships free — no catch.`,
    CANVAS_W - 200
  );
  let ly = 890;
  for (const line of lines) {
    ctx.fillText(line, CANVAS_W / 2, ly);
    ly += 42;
  }

  // Code pill.
  const pillY = ly + 40;
  const pillW = 460;
  const pillH = 96;
  const pillX = (CANVAS_W - pillW) / 2;
  ctx.strokeStyle = "#d9a94c";
  ctx.lineWidth = 3;
  ctx.strokeRect(pillX, pillY, pillW, pillH);
  ctx.fillStyle = "#f2efe6";
  ctx.font = "700 44px 'Space Grotesk', Arial, sans-serif";
  ctx.fillText(params.couponCode, CANVAS_W / 2, pillY + pillH / 2 + 16);

  // Footer.
  ctx.fillStyle = "#9a968c";
  ctx.font = "400 28px Arial, sans-serif";
  ctx.fillText(`Tag ${params.instagramHandle} as collaborator`, CANVAS_W / 2, CANVAS_H - 60);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}

function brandNameSpaced(name: string) {
  return name.toUpperCase();
}

export function ShareToInstagramButton({
  couponCode,
  brandName,
  instagramHandle,
  productImageUrl,
  requiredOrders,
}: {
  couponCode: string;
  brandName: string;
  instagramHandle: string;
  productImageUrl: string | null;
  requiredOrders: number;
}) {
  const [status, setStatus] = useState<"idle" | "building" | "shared" | "downloaded" | "copied">("idle");
  const caption = `I can get free ${brandName} shades just by posting 🌙 Use my code ${couponCode} — tag ${instagramHandle} as collaborator, and if ${requiredOrders} people shop with it, mine ships free. No catch.`;

  async function share() {
    setStatus("building");
    const blob = await buildShareCard({ brandName, instagramHandle, couponCode, productImageUrl, requiredOrders });

    if (blob) {
      const file = new File([blob], "moon-glasses-pay-with-a-post.png", { type: "image/png" });
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
      a.download = "moon-glasses-pay-with-a-post.png";
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
        for both.
      </p>
    </div>
  );
}
