import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase";

// Satori (the renderer behind ImageResponse) can't use next/font/google or
// any CSS-loaded font — it needs the actual font bytes handed to it. Archivo
// Black is the brand's display face (see app/layout.tsx's font-display /
// --font-archivo-black), so on-image captions use the same one instead of
// Satori's generic fallback sans-serif. Fetched once per server instance and
// cached in memory. Satori supports woff directly, which is what Google's
// CSS2 endpoint serves regardless of User-Agent now — the old trick of
// spoofing an ancient browser to coax out a .ttf no longer works (Google
// stopped serving ttf/otf to any UA at some point), and isn't needed anyway.
let cachedFontData: ArrayBuffer | null = null;
async function loadArchivoBlackFont(): Promise<ArrayBuffer> {
  if (cachedFontData) return cachedFontData;
  const cssRes = await fetch("https://fonts.googleapis.com/css2?family=Archivo+Black");
  const css = await cssRes.text();
  const match = css.match(/src: url\(([^)]+)\) format\('(woff2?|opentype|truetype)'\)/);
  if (!match) throw new Error("Could not resolve Archivo Black font file from Google Fonts");
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`Could not download Archivo Black font: ${fontRes.status}`);
  cachedFontData = await fontRes.arrayBuffer();
  return cachedFontData;
}

/**
 * Composites bold on-image text over a real product photo, for the
 * "real_photo_text_overlay" creative style the ad-brief generator picks —
 * a promotional graphic (real photo + a short punchy line), as opposed to
 * a clean AI-generated lifestyle shot with no text baked in. Same Satori/
 * ImageResponse technique as lib/order-card.tsx's WhatsApp card, including
 * fetching the source image ourselves and inlining it as a data URI —
 * Satori's own remote-image fetching has proven unreliable here.
 */
export async function renderTextOverlayImage(
  baseImageUrl: string,
  overlayText: string,
  dimensions: { width: number; height: number } = { width: 1080, height: 1080 }
): Promise<ArrayBuffer> {
  const [imgRes, archivoBlack] = await Promise.all([fetch(baseImageUrl), loadArchivoBlackFont()]);
  if (!imgRes.ok) throw new Error(`Could not fetch base image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const dataUri = `data:${contentType};base64,${Buffer.from(imgBuffer).toString("base64")}`;
  const { width, height } = dimensions;

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri}
          width={width}
          height={height}
          style={{ objectFit: "cover", position: "absolute", top: 0, left: 0 }}
          alt=""
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "45%",
            background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "56px",
            right: "56px",
            bottom: "64px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Archivo Black",
              fontSize: 72,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: -1,
              textTransform: "uppercase",
              textShadow: "0 2px 24px rgba(0,0,0,0.4)",
            }}
          >
            {overlayText}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [{ name: "Archivo Black", data: archivoBlack, weight: 400, style: "normal" }],
    }
  );

  return image.arrayBuffer();
}

/** Renders and uploads the composited creative, returning its public URL. */
export async function generateAndUploadTextOverlayImage(
  briefId: string,
  baseImageUrl: string,
  overlayText: string,
  dimensions?: { width: number; height: number }
) {
  const png = await renderTextOverlayImage(baseImageUrl, overlayText, dimensions);
  const supabase = getSupabaseServerClient();
  const path = `text-overlay/${briefId}-${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return data.publicUrl;
}
