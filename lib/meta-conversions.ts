import crypto from "crypto";
import { getSetting } from "@/lib/settings";

const GRAPH_VERSION = "v21.0";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Server-side mirror of a pixel event via Meta's Conversions API — more
 * reliable than the browser pixel alone (survives ad blockers, ITP, etc).
 * Best-effort: a missing pixel/token never blocks the caller (an order, a
 * page view). Purchase is the only event that matters for ad optimisation,
 * so it's the only one that must never silently fail without at least a log
 * line.
 */
export async function sendMetaConversionEvent(
  eventName: "Purchase" | "InitiateCheckout" | "AddToCart" | "ViewContent",
  data: {
    email?: string;
    phone?: string;
    value?: number;
    currency?: string;
    eventId?: string;
    sourceUrl?: string;
  }
) {
  const [pixelId, accessToken] = await Promise.all([
    getSetting("META_PIXEL_ID"),
    getSetting("META_ACCESS_TOKEN"),
  ]);
  if (!pixelId || !accessToken) {
    console.log(`Meta Pixel not configured — skipping server-side ${eventName} event`);
    return;
  }

  const userData: Record<string, string[]> = {};
  if (data.email) userData.em = [sha256(data.email)];
  if (data.phone) userData.ph = [sha256(data.phone.replace(/\D/g, ""))];

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          data: [
            {
              event_name: eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_id: data.eventId,
              action_source: "website",
              event_source_url: data.sourceUrl,
              user_data: userData,
              custom_data: data.value
                ? { value: data.value, currency: data.currency ?? "INR" }
                : undefined,
            },
          ],
        }),
      }
    );
    if (!res.ok) {
      console.error(`Meta Conversions API ${eventName} failed`, res.status, await res.text());
    }
  } catch (err) {
    console.error(`Meta Conversions API ${eventName} failed`, err);
  }
}
