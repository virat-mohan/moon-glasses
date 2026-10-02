import { ImageResponse } from "next/og";
import { getBrandProfile } from "@/lib/brand";
import { getSupabaseServerClient } from "@/lib/supabase";
import { pickShareCardForOrder } from "@/lib/share-card-pool";

const W = 1080;
const H = 1350;

// Satori's own remote-image fetching is unreliable (see lib/order-card.tsx), so images are inlined.
async function asDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Server-rendered twin of the share card drawn in ShareToInstagramButton, so
 * it can go out as a WhatsApp image the shopper forwards straight to Instagram.
 * Photo is picked per order from the brand's model-photo pool.
 */
export async function renderPwapShareCardPng(orderId: string, couponCode: string, variant = 0): Promise<ArrayBuffer | null> {
  const brand = await getBrandProfile();
  const site = brand.siteUrl.replace(/\/$/, "").replace(/^https:\/\/(?!www\.)/, "https://www.");
  const domain = site.replace(/^https?:\/\/(www\.)?/, "").toUpperCase();
  const pick = await pickShareCardForOrder(orderId, variant);
  if (!pick) return null;

  const [hero, logo] = await Promise.all([
    asDataUri(pick.imageUrl.startsWith("http") ? pick.imageUrl : `${site}${pick.imageUrl}`),
    asDataUri(`${site}/images/brand/moon-glasses-logo.png`),
  ]);
  if (!hero) return null;

  // Brand standard: the whole face shows, and no text sits on it. Photo on
  // top, fading into black; all the words go underneath on the black.
  const PHOTO_H = 860;
  const image = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: "#050505", position: "relative" }}>
        <div style={{ display: "flex", position: "relative", width: W, height: PHOTO_H }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} width={W} height={PHOTO_H} alt="" style={{ objectFit: "cover", objectPosition: "50% 18%" }} />
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              bottom: 0,
              width: W,
              height: 220,
              backgroundImage: "linear-gradient(to bottom, rgba(5,5,5,0) 0%, rgba(5,5,5,1) 100%)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} height={120} width={240} alt="" style={{ position: "absolute", left: 48, top: 36, objectFit: "contain" }} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: W, height: H - PHOTO_H, paddingTop: 14 }}>
          <div style={{ display: "flex", color: "#8b8b86", fontSize: 22, letterSpacing: 3 }}>{pick.productName.toUpperCase()}</div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 22, color: "#8b8b86", fontSize: 22, letterSpacing: 4 }}>
            POWERED BY
            <span style={{ color: "#e7c77a", fontSize: 34, fontStyle: "italic", fontWeight: 700, letterSpacing: 0, marginLeft: 12 }}>
              Pay With A Post™
            </span>
          </div>
          <div style={{ display: "flex", marginTop: 12, color: "#f7f7f4", fontSize: 44, fontWeight: 700, letterSpacing: 2 }}>
            {domain}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 22,
              width: 640,
              height: 132,
              border: "2px solid #e7c77a",
              borderRadius: 6,
              paddingTop: 18,
            }}
          >
            <div style={{ display: "flex", color: "#e7c77a", fontSize: 22, fontWeight: 700, letterSpacing: 5 }}>YOUR CODE</div>
            <div style={{ display: "flex", marginTop: 8, color: "#f7f7f4", fontSize: 56, fontWeight: 700, letterSpacing: 9 }}>
              {couponCode}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 18, color: "#8b8b86", fontSize: 26 }}>Use my code at checkout</div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
  return image.arrayBuffer();
}

/**
 * Renders the card and uploads it to public storage, returning its URL.
 * Stored as a JPEG (~150 KB instead of a ~1.6 MB PNG) so it opens fast on a
 * phone and is what Android Instagram wants for Feed. The object keeps its
 * .png name so every existing link (emails, WhatsApp, share variants) still
 * works; the content type says JPEG, which is what browsers and apps follow.
 */
export async function generateAndUploadPwapShareCard(orderId: string, couponCode: string, variant = 0): Promise<string | null> {
  const png = await renderPwapShareCardPng(orderId, couponCode, variant);
  if (!png) return null;
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const supabase = getSupabaseServerClient();
  const path = variant ? `pwap-share/${orderId}-${variant}.png` : `pwap-share/${orderId}.png`;
  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true, cacheControl: "86400" });
  if (error) throw error;
  return supabase.storage.from("ad-creatives").getPublicUrl(path).data.publicUrl;
}
