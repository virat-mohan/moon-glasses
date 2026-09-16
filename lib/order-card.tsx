import { ImageResponse } from "next/og";
import { getBrandProfile } from "@/lib/brand";
import { getSupabaseServerClient } from "@/lib/supabase";

type OrderForCard = {
  id: string;
  total: number;
};
type ItemForCard = { chapter_name: string; quantity: number };

/**
 * Renders a branded "Order Confirmed" card as a PNG, used as the header
 * image on the WhatsApp order-confirmation template — WhatsApp doesn't
 * render HTML, so this is the closest equivalent to a "designed" email:
 * one image + plain-text body underneath it.
 *
 * Satori (the renderer behind ImageResponse) requires explicit flexbox on
 * any element with more than one child — this isn't optional CSS styling,
 * it'll throw without it.
 */
export async function renderOrderCardPng(order: OrderForCard, items: ItemForCard[]): Promise<ArrayBuffer> {
  const brand = await getBrandProfile();
  // Fetched and inlined as a data URI rather than passed as a remote URL —
  // Satori's own remote-image fetching has proven unreliable here ("Input
  // buffer contains unsupported image format" despite the source being a
  // valid PNG); fetching it ourselves sidesteps whatever that mismatch is.
  const logoRes = await fetch(`${brand.siteUrl.replace(/\/$/, "")}/images/brand/moonglasses-logo-color-v2.png`);
  const logoBuffer = await logoRes.arrayBuffer();
  const logoUrl = `data:image/png;base64,${Buffer.from(logoBuffer).toString("base64")}`;
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const itemLines = items.slice(0, 6).map((i) => `${i.quantity} × ${i.chapter_name}`);

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#f0eee4",
          padding: "56px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} width={90} height={65} alt="" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 22, color: "#4a4a42", letterSpacing: 2 }}>
            ORDER CONFIRMED
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#4a4a42", marginTop: 8 }}>
            #{orderNumber}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "40px",
            backgroundColor: "#ffffff",
            border: "1px solid rgba(16,24,32,0.15)",
            padding: "32px",
          }}
        >
          {itemLines.map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                fontSize: 20,
                color: "#101820",
                marginBottom: i === itemLines.length - 1 ? 0 : 12,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "32px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(16,24,32,0.15)",
          }}
        >
          <div style={{ display: "flex", fontSize: 24, color: "#101820", fontWeight: 700 }}>Total</div>
          <div style={{ display: "flex", fontSize: 24, color: "#101820", fontWeight: 700 }}>
            ₹{order.total.toLocaleString("en-IN")}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
          <div style={{ display: "flex", fontSize: 14, color: "#4a4a42", letterSpacing: 1 }}>
            {brand.brandName} · {brand.tagline}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );

  return image.arrayBuffer();
}

/**
 * Renders and uploads the card, returning its public URL — used as the
 * WhatsApp order-confirmation template's header image. Reuses the
 * ad-creatives Storage bucket (already public) under its own prefix rather
 * than provisioning a new bucket for one more image type.
 */
export async function generateAndUploadOrderCard(order: OrderForCard, items: ItemForCard[]) {
  const png = await renderOrderCardPng(order, items);
  const supabase = getSupabaseServerClient();
  const path = `order-cards/${order.id}.png`;

  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return data.publicUrl;
}
