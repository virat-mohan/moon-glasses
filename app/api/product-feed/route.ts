import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";
import { getInventoryMap } from "@/lib/inventory";
import { getBrandProfile } from "@/lib/brand";
import { liveCatalogue } from "@/lib/catalogue";

function csvField(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Meta Commerce Manager product feed (CSV): the WhatsApp Business catalogue,
 * Facebook/Instagram shops and ads all read this one URL. Only LIVE products
 * (what the site actually shows), one row per colourway, refreshed from the
 * same data every page reads. Titles use Moonglasses' own model names; the
 * main image is the model photo (face fully in frame), with the product shot
 * as the extra image. Availability follows inventory.
 * Spec: https://www.facebook.com/business/help/120325381656392
 */
export async function GET() {
  const [all, inventory, brand] = await Promise.all([getAllChapters(), getInventoryMap(), getBrandProfile()]);
  const siteUrl = brand.siteUrl.replace(/\/$/, "").replace(/^https:\/\/(?!www\.)/, "https://www.");
  const abs = (u: string) => (u.startsWith("http") ? u : `${siteUrl}${u}`);

  const header = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "additional_image_link",
    "brand",
    "google_product_category",
    "product_type",
    "item_group_id",
    "color",
    "material",
    "custom_label_0",
    "custom_label_1",
    "inventory",
  ].join(",");

  const rows = liveCatalogue(all).map((p) => {
    const stock = inventory[p.slug] ?? 0;
    const product = abs(chapterImageSrc(p.folder, p.sideImage));
    return [
      p.slug,
      p.name,
      p.description,
      stock > 0 ? "in stock" : "out of stock",
      "new",
      `${p.price} INR`,
      `${siteUrl}/chapter/${p.slug}`,
      p.modelImage ? abs(p.modelImage) : product,
      p.modelImage ? product : "",
      brand.brandName,
      "Apparel & Accessories > Clothing Accessories > Sunglasses",
      `Sunglasses > ${p.collectionLabel}`,
      p.group,
      p.colour,
      p.material,
      p.model,
      p.collectionLabel,
      String(stock),
    ]
      .map(csvField)
      .join(",");
  });

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
