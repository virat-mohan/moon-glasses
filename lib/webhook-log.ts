import { getSupabaseServerClient } from "@/lib/supabase";

/** Best-effort raw record of an incoming webhook request — never throws, so logging can't break the webhook itself. */
export async function logWebhookRequest(source: string, outcome: string, rawBody: string) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("webhook_debug_log").insert({
      source,
      outcome,
      body: rawBody.slice(0, 20000),
    });
  } catch (err) {
    console.error("Failed to write webhook_debug_log", err);
  }
}
