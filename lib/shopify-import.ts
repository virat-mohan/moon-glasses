import { chapters as staticChapters } from "@/lib/chapters";
import { limitedSeries } from "@/lib/limited-series";
import { getSupabaseServerClient } from "@/lib/supabase";

type ShopifyImage = { id: number; src: string; variant_ids: number[] };
type ShopifyVariant = {
  id: number;
  sku: string | null;
  price: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  image_id: number | null;
};
type ShopifyOption = { name: string; position: number; values: string[] };
type ShopifyProduct = {
  title: string;
  product_type: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: ShopifyOption[];
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(text: string) {
  return text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Supplier product_type fields are typically just "SUNGLASSES" — not useful
// for naming/slugging. The actual frame shape lives in the product title
// instead (e.g. "GAST | RECTANGLE FULL RIM TR90 SUNGLASSES"), matching the
// same five shapes the rest of the catalogue is organized by.
const KNOWN_SHAPES = ["WAYFARER", "ROUND", "RECTANGLE", "AVIATOR", "OCTAGON", "OVAL", "HEXAGON", "CAT EYE", "SQUARE", "CLUBMASTER"];
function detectShape(title: string, productType: string): string {
  const haystack = `${title} ${productType}`;
  for (const shape of KNOWN_SHAPES) {
    if (new RegExp(shape, "i").test(haystack)) return shape;
  }
  // Fall back to the first word of the title (usually the product's own
  // name/code, e.g. "GAST") rather than a generic type like "SUNGLASSES".
  return title.split(/[\s|]+/)[0] || productType || "sunglasses";
}

/**
 * Fetches product JSON from a Shopify store URL — either a single product
 * page (/products/<handle>) or a whole collection (/collections/<handle>,
 * up to 250 products via Shopify's own products.json endpoint). This is
 * the same "SKU/variant JSON is far more reliable than scraping rendered
 * HTML" trick used earlier to pull the original 16 products' data.
 */
async function fetchShopifyProducts(pageUrl: string): Promise<ShopifyProduct[]> {
  const url = new URL(pageUrl);
  const productMatch = url.pathname.match(/\/products\/([^/]+)/);
  const collectionMatch = url.pathname.match(/\/collections\/([^/]+)/);

  if (productMatch) {
    const jsonUrl = `${url.origin}/products/${productMatch[1]}.json`;
    const res = await fetch(jsonUrl);
    if (!res.ok) throw new Error(`Could not fetch ${jsonUrl} (${res.status}) — is this a real Shopify product page?`);
    const data = await res.json();
    if (!data.product) throw new Error("Shopify response had no product — check the URL");
    return [data.product];
  }

  if (collectionMatch) {
    const jsonUrl = `${url.origin}/collections/${collectionMatch[1]}/products.json?limit=250`;
    const res = await fetch(jsonUrl);
    if (!res.ok) throw new Error(`Could not fetch ${jsonUrl} (${res.status}) — is this a real Shopify collection page?`);
    const data = await res.json();
    if (!Array.isArray(data.products)) throw new Error("Shopify response had no products — check the URL");
    return data.products;
  }

  throw new Error("URL must be a Shopify product page (/products/...) or collection page (/collections/...)");
}

export type ShopifyImportResult = {
  imported: string[];
  singlePhotoOnly: string[];
  skipped: { slug: string; reason: string }[];
};

/**
 * Pulls every color variant off a Shopify product/collection URL and adds
 * whichever ones aren't already in the catalogue as new draft
 * dynamic_chapters rows (live=false), ready to review in
 * /admin/master-inventory — generate a model photo, pick a collection, and
 * publish, without ever touching a script or a spreadsheet.
 */
export async function importFromShopifyUrl(pageUrl: string): Promise<ShopifyImportResult> {
  const products = await fetchShopifyProducts(pageUrl);
  const supabase = getSupabaseServerClient();

  const { data: existingDynamic } = await supabase.from("dynamic_chapters").select("slug");
  const existingSlugs = new Set([
    ...staticChapters.map((c) => c.slug),
    ...limitedSeries.map((c) => c.slug),
    ...(existingDynamic ?? []).map((r) => r.slug as string),
  ]);

  const result: ShopifyImportResult = { imported: [], singlePhotoOnly: [], skipped: [] };
  const rowsToInsert: Record<string, unknown>[] = [];

  for (const product of products) {
    const colorOptionIndex = Math.max(
      0,
      product.options?.findIndex((o) => /colou?r/i.test(o.name)) ?? 0
    );
    const optionKey = (["option1", "option2", "option3"] as const)[colorOptionIndex] ?? "option1";

    const seenColors = new Map<string, ShopifyVariant>();
    for (const variant of product.variants) {
      const color = variant[optionKey];
      if (color && !seenColors.has(color)) seenColors.set(color, variant);
    }

    const style = detectShape(product.title, product.product_type);
    const isMetal = /metal/i.test(product.product_type) || /metal/i.test(product.title);

    // Shopify's own tagging is thin in practice: usually only ONE photo per
    // color carries that variant's id in `variant_ids` (found via the
    // variant's own `image_id`, more reliable than searching variant_ids
    // directly) — the rest of a product's images are typically shared
    // lifestyle/detail shots with no variant_ids at all, not extra angles
    // per color. A single-variant product (no real color choice) is the one
    // case where dumping every image in is actually correct.
    const imagesById = new Map(product.images.map((img, idx) => [img.id, { img, idx }]));
    const noImageIsTagged = product.images.every((img) => img.variant_ids.length === 0);

    for (const [color, variant] of seenColors) {
      const slug = `moon-${slugify(style)}-${slugify(color)}`;

      if (existingSlugs.has(slug)) {
        result.skipped.push({ slug, reason: "Already in the catalogue (static, Limited Series, or a draft)" });
        continue;
      }

      let finalImages: string[];
      if (seenColors.size === 1 && noImageIsTagged) {
        finalImages = product.images.map((img) => img.src);
      } else {
        const heroEntry = variant.image_id ? imagesById.get(variant.image_id) : undefined;
        const hero = heroEntry?.img.src ?? product.images.find((img) => img.variant_ids.includes(variant.id))?.src;
        if (!hero) {
          result.skipped.push({ slug, reason: "Could not find a photo tagged to this color variant" });
          continue;
        }
        // The photo immediately after the hero shot in upload order is
        // sometimes a genuine second angle of the SAME color shoot (rather
        // than a shared/generic image) — only take it when it's untagged
        // itself, so we never borrow another color's tagged photo.
        const next = heroEntry ? product.images[heroEntry.idx + 1] : undefined;
        const second = next && next.variant_ids.length === 0 ? next.src : undefined;
        finalImages = [hero, second].filter((x): x is string => Boolean(x));
      }

      if (finalImages.length === 0) {
        result.skipped.push({ slug, reason: "No images found for this color" });
        continue;
      }
      if (finalImages.length === 1) result.singlePhotoOnly.push(slug);

      existingSlugs.add(slug); // guard against duplicate colors within the same import batch
      rowsToInsert.push({
        slug,
        name: `${titleCase(style)} — ${titleCase(color)}`,
        series: isMetal ? "Metal" : "Plastic",
        story: `${titleCase(style)} frame, ${color.toLowerCase()} lens tint.`,
        price: Math.round(parseFloat(variant.price)) || (isMetal ? 1999 : 1499),
        verified_on_site: true,
        images: finalImages.slice(0, 6),
        primary_image: finalImages[0],
      });
      result.imported.push(slug);
    }
  }

  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from("dynamic_chapters").insert(rowsToInsert);
    if (error) throw error;
  }

  return result;
}
