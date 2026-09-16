import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

export async function getMilesBalance(customerId: string) {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("loyalty_ledger").select("delta").eq("customer_id", customerId);
  return (data ?? []).reduce((sum, row) => sum + row.delta, 0);
}

export async function getRedemptionConfig() {
  const [thresholdSetting, valueSetting] = await Promise.all([
    getSetting("MILES_REDEMPTION_THRESHOLD"),
    getSetting("MILES_REDEMPTION_VALUE_RUPEES"),
  ]);
  return {
    threshold: thresholdSetting ? Number(thresholdSetting) : 500,
    valueRupees: valueSetting ? Number(valueSetting) : 200,
  };
}

/** How many whole redemption blocks a customer could cash in right now, and what they're worth. */
export async function getRedeemableAmount(customerId: string) {
  const [balance, config] = await Promise.all([getMilesBalance(customerId), getRedemptionConfig()]);
  const blocks = config.threshold > 0 ? Math.floor(balance / config.threshold) : 0;
  return { balance, ...config, maxRedeemableRupees: blocks * config.valueRupees, blocks };
}

/** Earns Miles for a purchase — one row per order, so it can never be double-applied. */
export async function earnMilesForOrder(customerId: string, orderId: string, capsBought: number) {
  const milesPerCapSetting = await getSetting("MILES_PER_CAP");
  const milesPerCap = milesPerCapSetting ? Number(milesPerCapSetting) : 250;
  const delta = capsBought * milesPerCap;
  if (delta <= 0) return;

  const supabase = getSupabaseServerClient();
  await supabase.from("loyalty_ledger").insert({
    customer_id: customerId,
    delta,
    reason: "purchase",
    order_id: orderId,
  });
}

/**
 * Redeems miles for a discount on an order — recomputes the eligible amount
 * server-side from the ledger rather than trusting whatever the client
 * requested, so a tampered request can never redeem more than the customer
 * actually has. Returns the rupee amount actually applied (may be less than
 * requested, or 0).
 */
export async function redeemMilesForOrder(customerId: string, orderId: string, requestedRupees: number) {
  const { maxRedeemableRupees, threshold, valueRupees } = await getRedeemableAmount(customerId);
  const appliedRupees = Math.min(requestedRupees, maxRedeemableRupees);
  if (appliedRupees <= 0) return 0;

  const blocksRedeemed = Math.floor(appliedRupees / valueRupees);
  const milesSpent = blocksRedeemed * threshold;
  if (milesSpent <= 0) return 0;

  const supabase = getSupabaseServerClient();
  await supabase.from("loyalty_ledger").insert({
    customer_id: customerId,
    delta: -milesSpent,
    reason: "redeemed",
    order_id: orderId,
  });

  return blocksRedeemed * valueRupees;
}
