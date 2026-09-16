import { getSupabaseServerClient } from "@/lib/supabase";
import { chapters } from "@/lib/chapters";
import { InventoryRow } from "@/components/admin/InventoryRow";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  let inventory: { chapter_slug: string; stock_on_hand: number }[] = [];
  let configError = false;

  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("inventory")
      .select("chapter_slug, stock_on_hand")
      .order("chapter_slug");
    inventory = data ?? [];
  } catch {
    configError = true;
  }

  const inventoryBySlug = new Map(inventory.map((i) => [i.chapter_slug, i.stock_on_hand]));

  if (configError) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
        <h1 className="font-display text-heading-l uppercase text-ink">Inventory</h1>
        <p className="mt-4 text-body-s text-paint-orange">
          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren&apos;t set in this environment yet — add
          them in Vercel under Project Settings → Environment Variables, then redeploy.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Inventory</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Stock on hand per Chapter. Never goes below 0 — a stray negative entry is clamped
        automatically.
      </p>

      <table className="mt-8 w-full max-w-xl text-left">
        <thead>
          <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
            <th className="py-2 pr-4">Chapter</th>
            <th className="py-2 pr-4">Stock On Hand</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {chapters.map((c) => (
            <InventoryRow
              key={c.slug}
              chapterSlug={c.slug}
              chapterName={c.name}
              stockOnHand={inventoryBySlug.get(c.slug) ?? 0}
            />
          ))}
        </tbody>
      </table>
    </main>
  );
}
