"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const CANVAS_W = 1080;
const CANVAS_H = 1350; // 4:5 — Instagram's max feed portrait; posts fine to a Story too (with letterboxing)
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

/**
 * next/font/google (see app/layout.tsx) never registers a face literally
 * named "Space Grotesk" or "Inter" — it generates a scoped local family name
 * and exposes it only via the --font-space-grotesk / --font-inter CSS
 * variables. Canvas text drawn with the literal Google Font name therefore
 * silently fell back to the system font the entire time. Reading the real
 * generated names off :root at draw time is what actually gets the brand
 * fonts to render.
 */
function getSiteFonts() {
  const styles = getComputedStyle(document.documentElement);
  const headline = styles.getPropertyValue("--font-space-grotesk").trim() || "sans-serif";
  const body = styles.getPropertyValue("--font-inter").trim() || "sans-serif";
  const display = styles.getPropertyValue("--font-bodoni-moda").trim() || "serif";
  return { headline: `${headline}, sans-serif`, body: `${body}, sans-serif`, display: `${display}, serif` };
}

async function ensureFontsReady(headlineFont: string, bodyFont: string, displayFont: string) {
  try {
    await Promise.all([
      document.fonts.load(`800 96px ${headlineFont}`),
      document.fonts.load(`700 46px ${headlineFont}`),
      document.fonts.load(`700 40px ${bodyFont}`),
      document.fonts.load(`400 34px ${bodyFont}`),
      document.fonts.load(`italic 700 30px ${displayFont}`),
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

/**
 * Builds the actual post — a real, screenshot-worthy piece of content
 * (editorial hero shot, brand logo, headline, and the code) rather than a
 * sheet of instructions. Deliberately carries NO "post this / tag us"
 * meta-instructions — those belong on the page around the button, since a
 * genuine Instagram post should never read like a how-to. `heroImageUrl` and
 * `productName` are picked per-order server-side (see lib/share-card-pool.ts)
 * so different barterers' posts feature different products — a stream of
 * these, once tagged/collaborator-added, reads as a varied lookbook rather
 * than the same single photo shared by everyone.
 */
async function buildShareCard(
  couponCode: string,
  siteDomain: string,
  heroImageUrl: string,
  productName: string
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { headline: HEADLINE_FONT, body: BODY_FONT, display: DISPLAY_FONT } = getSiteFonts();

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const TOP_BAND = 260; // solid black — logo lives here, never over the photo
  const [hero, logo] = await Promise.all([
    loadImage(heroImageUrl),
    loadImage(LOGO_IMAGE),
    ensureFontsReady(HEADLINE_FONT, BODY_FONT, DISPLAY_FONT),
  ]);
  if (hero) drawCover(ctx, hero, 0, TOP_BAND, CANVAS_W, CANVAS_H - TOP_BAND);

  if (logo) {
    const logoH = 168;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, 56, (TOP_BAND - logoH) / 2, logoW, logoH);
  }

  // Product name tag, lookbook-style — small pill over the top-left of the
  // photo, quiet enough not to compete with the model/product themselves.
  if (productName) {
    ctx.font = `700 22px ${BODY_FONT}`;
    ctx.letterSpacing = "1px";
    const label = productName.toUpperCase();
    const padX = 16;
    const textW = ctx.measureText(label).width;
    const pillW = textW + padX * 2;
    const pillH = 42;
    const pillX = 56;
    const pillY = TOP_BAND + 24;
    ctx.fillStyle = "rgba(5,5,5,0.55)";
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = "#f7f7f4";
    ctx.textAlign = "left";
    ctx.fillText(label, pillX + padX, pillY + pillH / 2 + 7);
    ctx.letterSpacing = "0px";
  }

  // Bottom gradient — the editorial-poster treatment that seats the tagline/code.
  const bottomGrad = ctx.createLinearGradient(0, CANVAS_H - 560, 0, CANVAS_H);
  bottomGrad.addColorStop(0, "rgba(5,5,5,0)");
  bottomGrad.addColorStop(0.4, "rgba(5,5,5,0.9)");
  bottomGrad.addColorStop(1, "rgba(5,5,5,0.98)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, CANVAS_H - 560, CANVAS_W, 560);

  ctx.textAlign = "center";

  // "Powered by Pay With A Post™" — every shared post credits the mechanic,
  // with the wordmark in the same italic serif as PayWithAPostMark.
  const poweredY = CANVAS_H - 356;
  ctx.font = `600 22px ${BODY_FONT}`;
  ctx.letterSpacing = "4px";
  const prefix = "POWERED BY ";
  const prefixW = ctx.measureText(prefix).width;
  ctx.letterSpacing = "0px";
  ctx.font = `italic 700 34px ${DISPLAY_FONT}`;
  const mark = "Pay With A Post";
  const markW = ctx.measureText(mark).width;
  ctx.font = `700 16px ${BODY_FONT}`;
  const tmW = ctx.measureText("TM").width;
  const startX = (CANVAS_W - (prefixW + markW + tmW + 4)) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#8b8b86";
  ctx.font = `600 22px ${BODY_FONT}`;
  ctx.letterSpacing = "4px";
  ctx.fillText(prefix, startX, poweredY);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#e7c77a";
  ctx.font = `italic 700 34px ${DISPLAY_FONT}`;
  ctx.fillText(mark, startX + prefixW, poweredY);
  ctx.font = `700 16px ${BODY_FONT}`;
  ctx.fillText("TM", startX + prefixW + markW + 4, poweredY - 16);
  ctx.textAlign = "center";

  // The domain, set in the same face as the logo/brand wordmark (Space
  // Grotesk — see Navbar's "MOON GLASSES" treatment) instead of the body
  // font, so it reads as the brand name rather than plain link text.
  ctx.fillStyle = "#f7f7f4";
  ctx.font = `700 44px ${HEADLINE_FONT}`;
  ctx.letterSpacing = "2px";
  ctx.fillText(siteDomain.toUpperCase(), CANVAS_W / 2, CANVAS_H - 296);
  ctx.letterSpacing = "0px";

  // Code — its own voucher-style panel (gold-bordered box + label) instead
  // of loose centered text, so it reads as a real redeemable code rather
  // than another line of copy.
  const boxW = 640;
  const boxH = 132;
  const boxX = (CANVAS_W - boxW) / 2;
  const boxY = CANVAS_H - 218;
  ctx.strokeStyle = "#e7c77a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.stroke();

  ctx.fillStyle = "#e7c77a";
  ctx.font = `700 22px ${BODY_FONT}`;
  ctx.letterSpacing = "5px";
  ctx.fillText("YOUR CODE", CANVAS_W / 2, boxY + 38);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#f7f7f4";
  ctx.font = `700 56px ${BODY_FONT}`;
  ctx.letterSpacing = "9px";
  ctx.fillText(couponCode, CANVAS_W / 2, boxY + 96);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#8b8b86";
  ctx.font = `400 26px ${BODY_FONT}`;
  ctx.fillText("Use my code at checkout", CANVAS_W / 2, boxY + boxH + 46);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}

export function ShareToInstagramButton({
  couponCode,
  instagramHandle,
  siteUrl,
  requiredOrders,
  heroImageUrl,
  productName,
}: {
  couponCode: string;
  instagramHandle: string;
  siteUrl: string;
  requiredOrders: number;
  heroImageUrl: string;
  productName: string;
}) {
  const [status, setStatus] = useState<"idle" | "building" | "shared" | "downloaded" | "copied">("idle");
  const [linkCopied, setLinkCopied] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const siteDomain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  // The actual clickable mechanism: Instagram never makes caption text or an
  // image clickable, but a Story link sticker or a bio link is — this is
  // what makes the code more than something a viewer has to remember and
  // retype. Captured on landing (see captureCoupon in lib/client-tracking.ts)
  // and auto-applied the moment they reach checkout.
  const shopLink = `${siteUrl.replace(/\/$/, "")}/?coupon=${couponCode}`;
  const caption = `Shop ${siteDomain} and use my code ${couponCode} at checkout 🌙 ${instagramHandle}\n\nPowered by Pay With A Post™`;

  // Build the card once on mount so there's a real preview on the page —
  // both so the barterer knows exactly what they're about to post before
  // tapping Share, and so it isn't a total unknown hidden behind a click.
  useEffect(() => {
    let cancelled = false;
    buildShareCard(couponCode, siteDomain, heroImageUrl, productName).then((blob) => {
      if (cancelled || !blob) return;
      blobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode, heroImageUrl, productName]);

  async function share() {
    setStatus("building");
    const blob = blobRef.current ?? (await buildShareCard(couponCode, siteDomain, heroImageUrl, productName));

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

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2500);
    } catch {
      // ignore — caption is visible on the page to copy manually
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
      {previewUrl && (
        <div className="mb-4 max-w-[280px]">
          <p className="mb-2 text-caption uppercase tracking-[0.1em] text-secondary-text">This is what gets posted</p>
          <div className="relative aspect-[4/5] w-full overflow-hidden border border-ink/20">
            <Image src={previewUrl} alt="Preview of your Instagram post" fill unoptimized className="object-cover" />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={share}
        disabled={status === "building"}
        className="border border-ink bg-ink px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream hover:bg-cream hover:text-ink disabled:opacity-60"
      >
        {label}
      </button>

      <div className="mt-4 border-t border-ink/10 pt-4">
        <p className="text-caption font-bold uppercase tracking-[0.05em] text-ink">On Mobile</p>
        <p className="mt-1 text-caption text-secondary-text">
          Tap Share To Instagram — your phone&apos;s share sheet opens with Instagram as an option. Pick it,
          then choose Post or Story (same image works for both, whichever you&apos;re confident can get you{" "}
          {requiredOrders} sales). The caption below is added automatically; edit it if you like.
        </p>
      </div>

      <div className="mt-3 border-t border-ink/10 pt-4">
        <p className="text-caption font-bold uppercase tracking-[0.05em] text-ink">On Desktop</p>
        <p className="mt-1 text-caption text-secondary-text">
          Tap Share To Instagram — the image downloads and the caption is copied to your clipboard. Upload
          the image from the Instagram app or instagram.com, then paste the caption in.
        </p>
      </div>

      <div className="mt-3 border-t border-ink/10 pt-4">
        <p className="text-caption font-bold uppercase tracking-[0.05em] text-ink">Adding Us As Collaborator</p>
        <p className="mt-1 text-caption text-secondary-text">
          While composing the post, tap &ldquo;Tag People&rdquo; → &ldquo;Invite Collaborator&rdquo; and add{" "}
          {instagramHandle}. If that option isn&apos;t available to you, tag {instagramHandle} normally instead —
          either way, it&apos;s what lets your post appear on our page too.
        </p>
      </div>

      <div className="mt-4 border-t border-ink/10 pt-4">
        <p className="text-caption text-secondary-text">Caption — copy it straight into the post:</p>
        <div className="mt-2 flex items-start gap-2">
          <p className="min-w-0 flex-1 border border-ink/30 bg-surface px-3 py-2 font-sans text-caption text-ink">
            {caption}
          </p>
          <button
            type="button"
            onClick={copyCaption}
            className="shrink-0 border border-ink/30 px-3 py-2 font-sans text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            {captionCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

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
