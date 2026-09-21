import { NextResponse } from "next/server";
import { createPostBarterOrder } from "@/lib/post-barter";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.customer || !body?.items?.length || !body?.instagramHandle) {
    return NextResponse.json({ error: "Missing customer, items, or Instagram handle" }, { status: 400 });
  }

  try {
    const result = await createPostBarterOrder({
      customer: body.customer,
      items: body.items,
      instagramHandle: body.instagramHandle,
      ownershipCode: body.ownershipCode,
      isGift: body.isGift,
      giftNote: body.giftNote,
      sessionKey: body.sessionKey,
      newsletterOptIn: body.newsletterOptIn,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to create post-barter order", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create your order" },
      { status: 400 }
    );
  }
}
