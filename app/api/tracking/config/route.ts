import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const pixelId = await getSetting("META_PIXEL_ID");
  return NextResponse.json({ pixelId });
}
