import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * The warehouse picks stock by the supplier's model name, colour and code, so
 * team-facing lines carry both our name and the supplier's (not just our customer-facing names
 * (product_costing.supplier_model / supplier_sku). Used for the warehouse
 * email and the warehouse WhatsApp only (Shiprocket shows names to customers,
 * so it gets the Moonglasses name plus the supplier SKU); the customer's
 * invoice and messages keep the Moonglasses name.
 */
export async function warehouseItemNames(items: { chapter_slug: string; chapter_name: string }[]) {
  const slugs = [...new Set(items.map((i) => i.chapter_slug))];
  const { data } = slugs.length
    ? await getSupabaseServerClient().from("product_costing").select("chapter_slug, supplier_model, supplier_sku").in("chapter_slug", slugs)
    : { data: [] };
  const bySlug = new Map((data ?? []).map((r) => [r.chapter_slug as string, r]));
  return new Map(
    items.map((i) => {
      const row = bySlug.get(i.chapter_slug);
      const colour = i.chapter_name.split("—")[1]?.trim() ?? "";
      // Both names, so the team and the warehouse read the same line:
      // "Glitch Oval — Black Orange (Ted Smith: Ryder — Black Orange [RYDER_C4])".
      const name = row?.supplier_model
        ? `${i.chapter_name} (Ted Smith: ${row.supplier_model}${colour ? ` — ${colour}` : ""}${row.supplier_sku ? ` [${row.supplier_sku}]` : ""})`
        : i.chapter_name;
      return [i.chapter_slug, { name, sku: (row?.supplier_sku as string | null) ?? i.chapter_slug }];
    })
  );
}
