import { getSetting } from "@/lib/settings";

/**
 * Next upcoming Friday at 19:00 IST — the fallback used until an admin sets
 * DROP_DATE_ISO explicitly in /admin/settings. Computed in IST (UTC+5:30)
 * regardless of server timezone, since the launch is an India-market drop.
 */
function nextFridaySevenPmIst(from = new Date()): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(from.getTime() + IST_OFFSET_MS);
  const day = istNow.getUTCDay(); // Sun=0 ... Fri=5
  let daysUntilFriday = (5 - day + 7) % 7;

  const candidate = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + daysUntilFriday, 19, 0, 0)
  );
  // candidate is "19:00 IST" expressed as if it were UTC — convert back by
  // subtracting the offset to get the real UTC instant.
  let target = new Date(candidate.getTime() - IST_OFFSET_MS);

  if (daysUntilFriday === 0 && target.getTime() <= from.getTime()) {
    target = new Date(target.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return target;
}

/** ISO string of the drop instant — admin-overridable via DROP_DATE_ISO. */
export async function getDropDateIso(): Promise<string> {
  const override = await getSetting("DROP_DATE_ISO");
  if (override) return override;
  return nextFridaySevenPmIst().toISOString();
}

/** Human label for emails/copy, e.g. "Friday, 19 Sep at 7:00 PM IST". */
export function formatDropDateLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " IST";
}
