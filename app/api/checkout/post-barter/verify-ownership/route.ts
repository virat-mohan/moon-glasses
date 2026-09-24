import { NextResponse } from "next/server";
import { verifyGiftFirstOwnership, isPostBarterEnabled } from "@/lib/post-barter";

/** Confirms the shopper actually dropped their one-time code into their own Instagram bio — the ownership proof gift_first needs before real inventory ships on trust. */
export async function POST(request: Request) {
  if (!(await isPostBarterEnabled())) {
    return NextResponse.json({ error: "Pay With A Post isn't available right now." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const instagramHandle = String(body?.instagramHandle ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!instagramHandle || !code) {
    return NextResponse.json({ verified: false, error: "Missing handle or code" }, { status: 400 });
  }

  const verified = await verifyGiftFirstOwnership(instagramHandle, code);
  return NextResponse.json({ verified });
}
