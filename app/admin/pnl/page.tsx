import Link from "next/link";
import { computePnl, currentMonthKey } from "@/lib/pnl";

export const dynamic = "force-dynamic";

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function money(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function Row({
  label,
  value,
  bold,
  indent,
}: {
  label: string;
  value: number | string;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-divider py-2.5 ${indent ? "pl-6" : ""}`}
    >
      <span className={`font-sans text-body-s ${bold ? "font-bold text-ink" : "text-secondary-text"}`}>
        {label}
      </span>
      <span className={`font-sans text-body-s ${bold ? "font-bold text-ink" : "text-ink"}`}>
        {typeof value === "number" ? money(value) : value}
      </span>
    </div>
  );
}

export default async function AdminPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const monthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  let configError = false;
  let pnl: Awaited<ReturnType<typeof computePnl>> | null = null;
  try {
    pnl = await computePnl(monthKey);
  } catch {
    configError = true;
  }

  const {
    grossSales,
    discountsGiven,
    refunds,
    shippingCollected,
    unitsSold,
    expensesByCategory,
    expensesTotal,
    costPerCap,
    netSales,
    cogs,
    grossProfit,
    netProfit,
  } = pnl ?? {
    grossSales: 0,
    discountsGiven: 0,
    refunds: 0,
    shippingCollected: 0,
    unitsSold: 0,
    expensesByCategory: [] as { category: string; amount: number }[],
    expensesTotal: 0,
    costPerCap: 250,
    netSales: 0,
    cogs: 0,
    grossProfit: 0,
    netProfit: 0,
  };

  if (configError) {
    return (
      <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
        <h1 className="font-display text-heading-l uppercase text-ink">P&amp;L</h1>
        <p className="mt-4 text-body-s text-paint-orange">
          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren&apos;t set in this environment yet.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">P&amp;L</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pnl?month=${shiftMonth(monthKey, -1)}`}
            className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            ← Prev
          </Link>
          <span className="font-sans text-body-s text-ink">{monthLabel(monthKey)}</span>
          <Link
            href={`/admin/pnl?month=${shiftMonth(monthKey, 1)}`}
            className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            Next →
          </Link>
        </div>
      </div>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Live — recalculated from real orders, refunds, and logged expenses for the selected month.
        Cost per cap: {money(costPerCap)} (edit in Settings → Finance).
      </p>

      <div className="mt-10">
        <Row label="Gross Sales" value={grossSales} />
        <Row label="Discounts, Referrals, Miles & Coupons" value={-discountsGiven} indent />
        <Row label="Refunds" value={-refunds} indent />
        <Row label="Net Sales" value={netSales} bold />

        <div className="mt-6" />
        <Row label={`Cost of Goods (${unitsSold} units × ${money(costPerCap)})`} value={-cogs} indent />
        <Row label="Gross Profit" value={grossProfit} bold />

        <div className="mt-6" />
        {expensesByCategory.length === 0 ? (
          <Row label="Operating Expenses (none logged)" value={0} indent />
        ) : (
          expensesByCategory.map((e) => (
            <Row key={e.category} label={e.category} value={-e.amount} indent />
          ))
        )}
        <Row label="Total Operating Expenses" value={-expensesTotal} indent />

        <div className="mt-6" />
        <Row
          label="Net Profit"
          value={netProfit}
          bold
        />
        <p className="mt-2 text-caption text-secondary-text">
          Shipping collected from customers this month: {money(shippingCollected)} (informational —
          not netted above since actual courier cost isn&apos;t tracked yet; log it under Expenses
          if you want it reflected here).
        </p>
      </div>

      <div className="mt-10 flex gap-4">
        <Link href="/admin/expenses" className="text-caption text-secondary-text underline">
          Manage Expenses
        </Link>
        <Link href="/admin/coupons" className="text-caption text-secondary-text underline">
          Manage Coupons
        </Link>
        <a
          href={`/api/admin/pnl/export?month=${monthKey}`}
          className="text-caption text-secondary-text underline"
        >
          Export CSV
        </a>
      </div>
    </main>
  );
}
