import { getSupabaseServerClient } from "@/lib/supabase";
import { DiscountRulesEditor } from "@/components/admin/DiscountRulesEditor";

// Reads live discount_rules data — never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage() {
  let rules: { id: string; name: string; buy_quantity: number; discount_percent: number; active: boolean }[] = [];
  let configError = false;

  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("discount_rules")
      .select("id, name, buy_quantity, discount_percent, active");
    rules = data ?? [];
  } catch {
    configError = true;
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Discount Rules</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Automatic bundle discounts applied at checkout — e.g. buy 3, cheapest one at 50% off.
      </p>

      {configError ? (
        <p className="mt-6 text-body-s text-paint-orange">
          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren&apos;t set in this environment yet.
        </p>
      ) : (
        <DiscountRulesEditor initialRules={rules} />
      )}
    </main>
  );
}
