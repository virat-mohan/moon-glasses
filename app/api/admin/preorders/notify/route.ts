import { NextResponse } from "next/server";
import { getPaidUnnotifiedEmails, markAllPaidNotified } from "@/lib/preorders";
import { sendDropLiveEmail } from "@/lib/email";

/**
 * Fires once, from /admin/preorders' "Notify All — Drop Is Live" button.
 * Best-effort per recipient (one bad address doesn't stop the rest), and
 * marks every paid pre-order notified up front so a retry/double-click
 * never double-sends.
 */
export async function POST() {
  try {
    const recipients = await getPaidUnnotifiedEmails();
    if (recipients.length === 0) {
      return NextResponse.json({ sent: 0, message: "No un-notified paid pre-orders" });
    }

    await markAllPaidNotified();

    let sent = 0;
    for (const r of recipients) {
      try {
        if (await sendDropLiveEmail(r.email, r.name)) sent++;
      } catch (err) {
        console.error(`Failed to send drop-live email to ${r.email}`, err);
      }
    }

    return NextResponse.json({ sent, total: recipients.length });
  } catch (err) {
    console.error("Failed to notify pre-orders", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send notifications" },
      { status: 500 }
    );
  }
}
