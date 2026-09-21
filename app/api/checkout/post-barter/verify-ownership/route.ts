import { NextResponse } from "next/server";
import { verifyGiftFirstOwnership } from "@/lib/post-barter";

/** Confirms the shopper actually dropped their one-time code into their own Instagram bio — the ownership proof gift_first needs before real inventory ships on trust. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const instagramHandle = String(body?.instagramHandle ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!instagramHandle || !code) {
    return NextResponse.json({ verified: false, error: "Missing handle or code" }, { status: 400 });
  }

  const verified = await verifyGiftFirstOwnership(instagramHandle, code);
  return NextResponse.json({ verified });
}
