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

  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const [hero, logo] = await Promise.all([loadImage(HERO_IMAGE), loadImage(LOGO_IMAGE), ensureFontsReady()]);
  if (hero) drawCover(ctx, hero, 0, 0, CANVAS_W, CANVAS_H);

  // Top gradient — seats the (now much larger) logo legibly over the photo.
  const topGrad = ctx.createLinearGradient(0, 0, 0, 340);
  topGrad.addColorStop(0, "rgba(5,5,5,0.8)");
  topGrad.addColorStop(1, "rgba(5,5,5,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CANVAS_W, 340);

  // Bottom gradient — the editorial-poster treatment that seats headline/code.
  const bottomGrad = ctx.createLinearGradient(0, CANVAS_H - 660, 0, CANVAS_H);
  bottomGrad.addColorStop(0, "rgba(5,5,5,0)");
  bottomGrad.addColorStop(0.4, "rgba(5,5,5,0.85)");
  bottomGrad.addColorStop(1, "rgba(5,5,5,0.97)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, CANVAS_H - 660, CANVAS_W, 660);

  if (logo) {
    const logoH = 160;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (CANVAS_W - logoW) / 2, 60, logoW, logoH);
  }

  ctx.textAlign = "center";

  // Headline.
  ctx.fillStyle = "#f2efe6";
  ctx.font = `800 96px ${HEADLINE_FONT}`;
  ctx.fillText("SPREAD THE", CANVAS_W / 2, CANVAS_H - 500);
  ctx.fillStyle = "#d9a94c";
  ctx.fillText("GOOD VIBES", CANVAS_W / 2, CANVAS_H - 398);

  // Direct CTA: where to go and why — not vague "something special."
  ctx.fillStyle = "#f2efe6";
  ctx.font = `700 46px ${HEADLINE_FONT}`;
  ctx.fillText(`Shop ${siteDomain}`, CANVAS_W / 2, CANVAS_H - 318);

  ctx.fillStyle = "#c9c5ba";
  ctx.font = `400 34px ${BODY_FONT}`;
  const lines = wrapText(ctx, "Use my code at checkout for a discount.", CANVAS_W - 220);
  let ly = CANVAS_H - 258;
  for (const line of lines) {
    ctx.fillText(line, CANVAS_W / 2, ly);
    ly += 44;
  }

  // Code pill.
  const pillY = ly + 28;
  const pillW = 460;
  const pillH = 96;
  const pillX = (CANVAS_W - pillW) / 2;
  ctx.strokeStyle = "#d9a94c";
  ctx.lineWidth = 3;
  ctx.strokeRect(pillX, pillY, pillW, pillH);
  ctx.fillStyle = "#f2efe6";
  ctx.font = `700 44px ${HEADLINE_FONT}`;
  ctx.fillText(couponCode, CANVAS_W / 2, pillY + pillH / 2 + 16);

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
  const caption = `Spreading the Good Vibes 🌙 Shop ${siteDomain} and use my code ${couponCode} for a discount — tag ${instagramHandle} as collaborator when you post.`;

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
