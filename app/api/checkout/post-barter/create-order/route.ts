import { NextResponse } from "next/server";
import { resolveTestOrderForRequest } from "@/lib/admin-request";
import { isOrderingBlocked } from "@/lib/launch";
import { createPostBarterOrder } from "@/lib/post-barter";

export async function POST(request: Request) {
  if (await isOrderingBlocked()) {
    return NextResponse.json({ error: "We're launching soon and not taking orders just yet." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  // Instagram handle is optional now (sell first only).
  if (!body?.customer || !body?.items?.length) {
    return NextResponse.json({ error: "Missing customer or items" }, { status: 400 });
  }

  // Test orders only for a browser signed in to admin; the flag alone is ignored.
  const testOrder = await resolveTestOrderForRequest(body.testOrder);

  try {
    const result = await createPostBarterOrder({
      testOrder,
      customer: body.customer,
      items: body.items,
      instagramHandle: typeof body.instagramHandle === "string" ? body.instagramHandle : null,
      ownershipCode: body.ownershipCode,
      termsAccepted: !!body.termsAccepted,
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
