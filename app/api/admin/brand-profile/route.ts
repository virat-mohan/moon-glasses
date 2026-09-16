import { NextResponse } from "next/server";
import { getBrandProfile, setBrandProfile } from "@/lib/brand";

export async function GET() {
  const profile = await getBrandProfile();
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  try {
    await setBrandProfile(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save brand profile", err);
    return NextResponse.json({ error: "Could not save brand profile" }, { status: 500 });
  }
}
