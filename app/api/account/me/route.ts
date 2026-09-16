import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getRedeemableAmount } from "@/lib/loyalty";
import { getOrCreateReferralCode } from "@/lib/referrals";
import { isWithinReturnWindow } from "@/lib/returns";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ customer: null });

  try {
    const supabase = getSupabaseServerClient();
    const [{ data: addresses }, { data: orders }, loyalty, referralCode, { count: referralCount }] =
      await Promise.all([
        supabase
          .from("customer_addresses")
          .select("*")
          .eq("customer_id", customer.id)
          .order("is_default", { ascending: false }),
        supabase
          .from("orders")
          .select("id, created_at, total, status, delivered_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(20),
        getRedeemableAmount(customer.id),
        getOrCreateReferralCode(customer.id),
        supabase
          .from("referrals")
          .select("id", { count: "exact", head: true })
          .eq("referrer_customer_id", customer.id),
      ]);

    const orderIds = (orders ?? []).map((o) => o.id);
    const { data: existingRequests } = orderIds.length
      ? await supabase.from("return_requests").select("order_id").in("order_id", orderIds)
      : { data: [] };
    const hasReturnRequest = new Set((existingRequests ?? []).map((r) => r.order_id));

    const ordersWithReturnEligibility = await Promise.all(
      (orders ?? []).map(async (o) => ({
        ...o,
        returnEligible: !hasReturnRequest.has(o.id) && (await isWithinReturnWindow(o.delivered_at)),
      }))
    );

    return NextResponse.json({
      customer,
      addresses: addresses ?? [],
      orders: ordersWithReturnEligibility,
      loyalty,
      referralCode,
      referralCount: referralCount ?? 0,
    });
  } catch (err) {
    console.error("Failed to load account", err);
    return NextResponse.json({ customer, addresses: [], orders: [], loyalty: null });
  }
}
