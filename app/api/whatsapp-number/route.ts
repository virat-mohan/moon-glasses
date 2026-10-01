import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

/** Public: the store's WhatsApp API number (the one that can auto-reply), for wa.me links. */
export async function GET() {
  const n = (await getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER"))?.replace(/\D/g, "") ?? null;
  return NextResponse.json({ number: n }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
