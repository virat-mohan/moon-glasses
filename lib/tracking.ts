import { getSupabaseServerClient } from "@/lib/supabase";

export type TrackingEventName =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

/**
 * First-party funnel log, independent of whether Meta's pixel is configured
 * or blocked client-side — this is the source of truth /admin/reports reads
 * for the funnel. Best-effort: never throws, a tracking failure must never
 * break a page render or an order.
 */
export async function logTrackingEvent(
  eventName: TrackingEventName,
  data: {
    sessionKey?: string;
    chapterSlug?: string;
    value?: number;
    path?: string;
    referrerHost?: string;
    adBriefId?: string;
    utmSource?: string;
  }
) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("tracking_events").insert({
      event_name: eventName,
      session_key: data.sessionKey ?? null,
      chapter_slug: data.chapterSlug ?? null,
      value: data.value ?? null,
      path: data.path ?? null,
      referrer_host: data.referrerHost ?? null,
      ad_brief_id: data.adBriefId ?? null,
      utm_source: data.utmSource ?? null,
    });
  } catch (err) {
    console.error("Failed to log tracking event", eventName, err);
  }
}
