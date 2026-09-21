import { NextResponse } from "next/server";
import { computePnl, currentMonthKey } from "@/lib/pnl";
import { toCsv } from "@/lib/csv-export";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const monthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  try {
    const pnl = await computePnl(monthKey);
    const rows: (string | number)[][] = [
      ["Moonglasses P&L", monthKey],
      [],
      ["Gross Sales", pnl.grossSales],
      ["Discounts, Referrals, Good Vibes & Coupons", -pnl.discountsGiven],
      ["Refunds", -pnl.refunds],
      ["Net Sales", pnl.netSales],
      [],
      [`Cost of Goods (${pnl.unitsSold} units x ₹${pnl.costPerCap})`, -pnl.cogs],
      ["Gross Profit", pnl.grossProfit],
      [],
      ...pnl.expensesByCategory.map((e) => [e.category, -e.amount]),
      ["Total Operating Expenses", -pnl.expensesTotal],
      [],
      ["Net Profit", pnl.netProfit],
      [],
      ["Shipping Collected (informational)", pnl.shippingCollected],
    ];

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="moonglasses-pnl-${monthKey}.csv"`,
      },
    });
  } catch (err) {
    console.error("Failed to export P&L", err);
    return NextResponse.json({ error: "Could not export P&L" }, { status: 500 });
  }
}
