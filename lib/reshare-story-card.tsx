import { ImageResponse } from "next/og";
import { getBrandProfile } from "@/lib/brand";
import { getSupabaseServerClient } from "@/lib/supabase";

const W = 1080;
const H = 1920;
// 4:5, the usual feed-post shape: a 4:5 post fills it exactly, a square one is
// centre-cropped at the sides (cover, never stretched).
const PHOTO_H = 1350;

async function asDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Story (1080x1920) that reshares a post someone tagged us in. Brand standard:
 * the photo sits at the top, whole face visible, fading into black; the credit
 * and logo go on the black underneath, never over a face.
 */
export async function renderReshareStoryJpeg(imageUrl: string, username: string | null): Promise<Buffer | null> {
  const brand = await getBrandProfile();
  const site = brand.siteUrl.replace(/\/$/, "").replace(/^https:\/\/(?!www\.)/, "https://www.");
  const [photo, logo] = await Promise.all([asDataUri(imageUrl), asDataUri(`${site}/images/brand/moon-glasses-logo.png`)]);
  if (!photo) return null;
  const handle = username ? `@${username.replace(/^@/, "")}` : null;

  const image = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: "#050505" }}>
        <div style={{ display: "flex", position: "relative", width: W, height: PHOTO_H }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} width={W} height={PHOTO_H} alt="" style={{ objectFit: "cover", objectPosition: "50% 30%" }} />
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              bottom: 0,
              width: W,
              height: 200,
              backgroundImage: "linear-gradient(to bottom, rgba(5,5,5,0) 0%, rgba(5,5,5,1) 100%)",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: W, height: H - PHOTO_H, paddingTop: 70 }}>
          {handle && <div style={{ display: "flex", color: "#d9d9d4", fontSize: 34, letterSpacing: 1 }}>{`📸 ${handle}`}</div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} width={300} height={150} alt="" style={{ marginTop: 60, objectFit: "contain" }} />}
        </div>
      </div>
    ),
    { width: W, height: H }
  );
  const png = Buffer.from(await image.arrayBuffer());
  const sharp = (await import("sharp")).default;
  return sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

/** Renders and uploads to public storage (ad-creatives/reshares/<mediaId>.jpg); returns the public URL. */
export async function uploadReshareStory(mediaId: string, imageUrl: string, username: string | null): Promise<string | null> {
  const jpeg = await renderReshareStoryJpeg(imageUrl, username);
  if (!jpeg) return null;
  const supabase = getSupabaseServerClient();
  const path = `reshares/${mediaId.replace(/[^\w-]/g, "")}.jpg`;
  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true, cacheControl: "86400" });
  if (error) throw error;
  return supabase.storage.from("ad-creatives").getPublicUrl(path).data.publicUrl;
}
