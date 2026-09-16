import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getMilesBalance } from "@/lib/loyalty";
import { sendWinbackEmail } from "@/lib/email";
import { sendWinbackWhatsApp } from "@/lib/whatsapp-notify";

/**
 * Nudges any customer whose most recent order is >= WINBACK_AFTER_DAYS old
 * (default 60), and who hasn't already been nudged within that same
 * window — so it naturally repeats on that cadence for someone who still
 * hasn't come back, without ever firing more than once per window even
 * though the cron itself runs daily.
 *
 * Deliberately a straightforward "latest order per customer, computed in
 * JS" pass rather than a SQL aggregation — fine at current order volume,
 * matches the same per-record loop style already used in lib/ad-agent.ts.
 * Revisit if the customer base grows enough that this becomes slow.
 */
export async function runWinbackSweep() {
  const supabase = getSupabaseServerClient();
  const afterDaysSetting = await getSetting("WINBACK_AFTER_DAYS");
  const afterDays = afterDaysSetting ? Number(afterDaysSetting) : 60;
  const cutoff = new Date(Date.now() - afterDays * 24 * 60 * 60 * 1000);

  const { data: orders } = await supabase
    .from("orders")
    .select("customer_id, created_at")
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false });

  const latestOrderByCustomer = new Map<string, string>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    if (!latestOrderByCustomer.has(o.customer_id)) {
      latestOrderByCustomer.set(o.customer_id, o.created_at);
    }
  }

  let sent = 0;
  for (const [customerId, lastOrderAt] of latestOrderByCustomer) {
    if (new Date(lastOrderAt) > cutoff) continue; // ordered recently enough, not lapsed

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, phone, email, last_winback_sent_at")
      .eq("id", customerId)
      .maybeSingle();
    if (!customer || (!customer.email && !customer.phone)) continue;
    if (customer.last_winback_sent_at && new Date(customer.last_winback_sent_at) > cutoff) continue;

    const balance = await getMilesBalance(customer.id);
    // WhatsApp-first: a phone number gets the nudge via WhatsApp only; email
    // is the fallback, used only when there's no phone (or WhatsApp failed).
    const whatsappDelivered = customer.phone
      ? await sendWinbackWhatsApp(customer.phone, customer.name ?? "there", balance)
      : false;
    const delivered =
      whatsappDelivered ||
      (customer.email ? await sendWinbackEmail(customer.email, customer.name, balance) : false);

    if (delivered) {
      await supabase
        .from("customers")
        .update({ last_winback_sent_at: new Date().toISOString() })
        .eq("id", customer.id);
      sent++;
    }
  }

  return { sent, lapsedCustomersChecked: latestOrderByCustomer.size };
}
