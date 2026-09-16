import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

function normalizePhone(raw: string | null | undefined) {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const [milesPerCapSetting, vipSpendSetting, vipOrdersSetting, winbackDaysSetting] = await Promise.all([
      getSetting("MILES_PER_CAP"),
      getSetting("VIP_MIN_SPEND_RUPEES"),
      getSetting("VIP_MIN_ORDERS"),
      getSetting("WINBACK_AFTER_DAYS"),
    ]);
    const milesPerCap = milesPerCapSetting ? Number(milesPerCapSetting) : 250;
    const vipMinSpend = vipSpendSetting ? Number(vipSpendSetting) : 5000;
    const vipMinOrders = vipOrdersSetting ? Number(vipOrdersSetting) : 3;
    const atRiskAfterDays = winbackDaysSetting ? Number(winbackDaysSetting) : 60;
    const atRiskCutoff = Date.now() - atRiskAfterDays * 24 * 60 * 60 * 1000;

    const [{ data: orders, error }, { data: imported }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, customer_name, customer_phone, customer_email, total, created_at")
        // A cancelled order was refunded in full and restocked — it never
        // happened as far as spend/order-count/Miles are concerned, same
        // convention as the P&L page.
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
      supabase.from("imported_customer_records").select("*"),
    ]);
    if (error) throw error;

    const orderIds = (orders ?? []).map((o) => o.id);
    const { data: items } = orderIds.length
      ? await supabase.from("order_items").select("order_id, quantity").in("order_id", orderIds)
      : { data: [] };

    const capsByOrder = new Map<string, number>();
    for (const item of items ?? []) {
      capsByOrder.set(item.order_id, (capsByOrder.get(item.order_id) ?? 0) + item.quantity);
    }

    type CustomerRow = {
      phone: string;
      name: string;
      email: string;
      orderCount: number;
      capsBought: number;
      totalSpent: number;
      lastOrderAt: string;
      firstOrderAt: string;
      miles: number;
      importedRecords: number;
    };
    const byPhone = new Map<string, CustomerRow>();

    function upsert(
      phone: string,
      patch: {
        name?: string | null;
        email?: string | null;
        orderDelta?: number;
        capsDelta?: number;
        spendDelta?: number;
        date?: string | null;
        importedDelta?: number;
      }
    ) {
      if (!phone) return;
      const existing = byPhone.get(phone);
      if (existing) {
        existing.orderCount += patch.orderDelta ?? 0;
        existing.capsBought += patch.capsDelta ?? 0;
        existing.totalSpent += patch.spendDelta ?? 0;
        existing.importedRecords += patch.importedDelta ?? 0;
        if (!existing.name && patch.name) existing.name = patch.name;
        if (!existing.email && patch.email) existing.email = patch.email;
        if (patch.date) {
          if (!existing.lastOrderAt || patch.date > existing.lastOrderAt) existing.lastOrderAt = patch.date;
          if (!existing.firstOrderAt || patch.date < existing.firstOrderAt) existing.firstOrderAt = patch.date;
        }
      } else {
        byPhone.set(phone, {
          phone,
          name: patch.name ?? "",
          email: patch.email ?? "",
          orderCount: patch.orderDelta ?? 0,
          capsBought: patch.capsDelta ?? 0,
          totalSpent: patch.spendDelta ?? 0,
          lastOrderAt: patch.date ?? "",
          firstOrderAt: patch.date ?? "",
          miles: 0,
          importedRecords: patch.importedDelta ?? 0,
        });
      }
    }

    for (const order of orders ?? []) {
      const phone = normalizePhone(order.customer_phone);
      const caps = capsByOrder.get(order.id) ?? 0;
      upsert(phone, {
        name: order.customer_name,
        email: order.customer_email,
        orderDelta: 1,
        capsDelta: caps,
        spendDelta: order.total ?? 0,
        date: order.created_at,
      });
    }

    for (const record of imported ?? []) {
      const phone = normalizePhone(record.phone);
      upsert(phone, {
        name: record.name,
        email: record.email,
        orderDelta: 1,
        capsDelta: record.quantity ?? 0,
        spendDelta: record.purchase_value ?? 0,
        date: record.purchase_date,
        importedDelta: 1,
      });
    }

    const customers = [...byPhone.values()]
      .map((c) => {
        const isVip = c.totalSpent >= vipMinSpend || c.orderCount >= vipMinOrders;
        // A customer with no real order yet (imported-only record) has no
        // lastOrderAt to judge — never flag them at-risk off an empty date.
        const isAtRisk = !!c.lastOrderAt && new Date(c.lastOrderAt).getTime() < atRiskCutoff;
        return { ...c, miles: c.capsBought * milesPerCap, isVip, isAtRisk };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json({ customers, milesPerCap });
  } catch (err) {
    console.error("Failed to load customers", err);
    return NextResponse.json({ customers: [], milesPerCap: 100 }, { status: 500 });
  }
}
