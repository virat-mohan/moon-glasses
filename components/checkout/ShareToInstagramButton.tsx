"use client";

import { useState } from "react";

const CANVAS_W = 1080;
const CANVAS_H = 1350; // 4:5 — Instagram's max feed portrait; posts fine to a Story too (with letterboxing)
const HERO_IMAGE = "/images/chapters/moon-octagon-silver-light-brown/lifestyle.jpg";
const LOGO_IMAGE = "/images/brand/moon-glasses-logo.png";
const HEADLINE_FONT = "'Space Grotesk', Arial, sans-serif";
const BODY_FONT = "'Inter', Arial, sans-serif";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Canvas never triggers a webfont download itself — it just silently draws
 * with whatever's already rasterized, falling back to a default font if the
 * real one hasn't loaded yet. The site's own pages never hit this because
 * the browser loads fonts before painting visible text, but a canvas drawn
 * moments after page load can easily race ahead of that. Explicitly
 * requesting the exact weights/sizes used below and waiting on them (they're
 * the same "Space Grotesk"/"Inter" families next/font registers site-wide,
 * see app/layout.tsx) is what actually guarantees the brand fonts render.
 */
async function ensureFontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`800 96px ${HEADLINE_FONT}`),
      document.fonts.load(`700 46px ${HEADLINE_FONT}`),
      document.fonts.load(`700 40px ${BODY_FONT}`),
      document.fonts.load(`400 34px ${BODY_FONT}`),
    ]);
    await document.fonts.ready;
  } catch {
    // best-effort — worst case the fallback stack in each font string draws instead
  }
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
async function buildShareCard(couponCode: string, siteDomain: string): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const TOP_BAND = 220; // solid black — logo lives here, never over the photo
  const [hero, logo] = await Promise.all([loadImage(HERO_IMAGE), loadImage(LOGO_IMAGE), ensureFontsReady()]);
  if (hero) drawCover(ctx, hero, 0, TOP_BAND, CANVAS_W, CANVAS_H - TOP_BAND);

  // Thin gold seam between the black band and the photo — the same
  // hairline-border language the site uses on tiles and cards, instead of a
  // soft gradient blend.
  ctx.fillStyle = "#e7c77a";
  ctx.fillRect(0, TOP_BAND, CANVAS_W, 3);

  if (logo) {
    const logoH = 84;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, 64, (TOP_BAND - logoH) / 2, logoW, logoH);
  }

  // Bottom gradient — the editorial-poster treatment that seats headline/code.
  const bottomGrad = ctx.createLinearGradient(0, CANVAS_H - 620, 0, CANVAS_H);
  bottomGrad.addColorStop(0, "rgba(5,5,5,0)");
  bottomGrad.addColorStop(0.4, "rgba(5,5,5,0.9)");
  bottomGrad.addColorStop(1, "rgba(5,5,5,0.98)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, CANVAS_H - 620, CANVAS_W, 620);

  ctx.textAlign = "center";

  // Headline — the site's own voice: short lines, restrained, no hard sell.
  ctx.fillStyle = "#e7c77a";
  ctx.font = `700 40px ${HEADLINE_FONT}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("SEE A BRIGHTER YOU", CANVAS_W / 2, CANVAS_H - 470);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#f7f7f4";
  ctx.font = `800 84px ${HEADLINE_FONT}`;
  ctx.fillText("MOON GLASSES", CANVAS_W / 2, CANVAS_H - 384);

  ctx.fillStyle = "#c9c5ba";
  ctx.font = `400 34px ${BODY_FONT}`;
  const lines = wrapText(ctx, `Shop the drop at ${siteDomain} — use my code at checkout.`, CANVAS_W - 220);
  let ly = CANVAS_H - 300;
  for (const line of lines) {
    ctx.fillText(line, CANVAS_W / 2, ly);
    ly += 44;
  }

  // Code — set as letter-spaced gold text with a thin underline, matching
  // how the site itself sets emphasis (e.g. product-page CTAs), rather than
  // a boxed "coupon" pill that reads like a discount-app widget.
  const codeY = ly + 70;
  ctx.fillStyle = "#e7c77a";
  ctx.font = `700 56px ${HEADLINE_FONT}`;
  ctx.letterSpacing = "8px";
  ctx.fillText(couponCode, CANVAS_W / 2, codeY);
  ctx.letterSpacing = "0px";
  const codeWidth = ctx.measureText(couponCode).width + couponCode.length * 8;
  ctx.strokeStyle = "#e7c77a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2 - codeWidth / 2, codeY + 24);
  ctx.lineTo(CANVAS_W / 2 + codeWidth / 2, codeY + 24);
  ctx.stroke();

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}

export function ShareToInstagramButton({
  couponCode,
  brandName,
  instagramHandle,
  siteUrl,
  requiredOrders,
}: {
  couponCode: string;
  brandName: string;
  instagramHandle: string;
  siteUrl: string;
  requiredOrders: number;
}) {
  const [status, setStatus] = useState<"idle" | "building" | "shared" | "downloaded" | "copied">("idle");
  const [linkCopied, setLinkCopied] = useState(false);

  const siteDomain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  // The actual clickable mechanism: Instagram never makes caption text or an
  // image clickable, but a Story link sticker or a bio link is — this is
  // what makes the code more than something a viewer has to remember and
  // retype. Captured on landing (see captureCoupon in lib/client-tracking.ts)
  // and auto-applied the moment they reach checkout.
  const shopLink = `${siteUrl.replace(/\/$/, "")}/?coupon=${couponCode}`;
  const caption = `See a brighter you 🌙 Shop ${siteDomain} and use my code ${couponCode} at checkout — tag ${instagramHandle} as collaborator when you post.`;

  async function share() {
    setStatus("building");
    const blob = await buildShareCard(couponCode, siteDomain);

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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shopLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // ignore — link is visible on the page to copy manually
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

      <div className="mt-4 border-t border-ink/10 pt-4">
        <p className="text-caption text-secondary-text">
          For a Story, Instagram lets you add a real, tappable{" "}
          <a href="https://help.instagram.com/1350564238542132" target="_blank" rel="noreferrer" className="underline">
            link sticker
          </a>{" "}
          — use this one so it goes straight to checkout with your code applied:
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate border border-ink/30 bg-surface px-3 py-2 font-sans text-caption text-ink">
            {shopLink}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 border border-ink/30 px-3 py-2 font-sans text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            {linkCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
