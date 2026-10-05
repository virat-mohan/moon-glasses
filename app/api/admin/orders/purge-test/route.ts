import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// The exact 8 test order prefixes identified from testing
const TARGET_TEST_PREFIXES = [
  "412c0a64",
  "97ac2231",
  "a4c45c2d",
  "d52c1835",
  "872b36bc",
  "1787ba91",
  "431b2d65",
  "8faf4957",
];

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseServerClient();

    // Fetch orders to inspect
    const { data: allOrders, error: fetchErr } = await supabase
      .from("orders")
      .select("id, customer_name, customer_phone, total, status, payment_status, created_at");

    if (fetchErr) throw fetchErr;

    // Filter strictly to the test orders
    const testOrdersToDelete = (allOrders ?? []).filter((o) => {
      const prefix = o.id.slice(0, 8).toLowerCase();
      // 1. Explicitly matches one of the 8 target test order IDs
      if (TARGET_TEST_PREFIXES.includes(prefix)) return true;

      // 2. Or matches test customer name (Prince / Test) AND is not a completed paid order
      const name = (o.customer_name || "").trim().toLowerCase();
      const isTestName = name === "prince" || name === "test" || name === "prince test" || name === "test prince";
      if (isTestName && o.payment_status !== "paid") return true;

      return false;
    });

    const deleted: { id: string; shortId: string; name: string; total: number }[] = [];

    for (const order of testOrdersToDelete) {
      const orderId = order.id;

      // Clean dependent tables to prevent foreign key errors:
      await supabase.from("whatsapp_messages").delete().eq("order_id", orderId);
      await supabase.from("shipping_labels").delete().eq("order_id", orderId);
      await supabase.from("shipments").delete().eq("order_id", orderId);
      await supabase.from("order_side_effects").delete().eq("order_id", orderId);
      await supabase.from("order_history").delete().eq("order_id", orderId);
      await supabase.from("order_items").delete().eq("order_id", orderId);

      // Delete the order itself
      const { error: delErr } = await supabase.from("orders").delete().eq("id", orderId);
      if (delErr) {
        console.error("Failed to delete order row:", orderId, delErr);
        continue;
      }

      deleted.push({
        id: orderId,
        shortId: orderId.slice(0, 8).toUpperCase(),
        name: order.customer_name || "Unknown",
        total: order.total,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully deleted ${deleted.length} test order(s).`,
      count: deleted.length,
      deleted,
    });
  } catch (err) {
    console.error("Purge test orders error:", err);
    return NextResponse.json({ error: "Failed to purge test orders" }, { status: 500 });
  }
}
