import { NextResponse } from "next/server";
import { sendDropAnnouncementEmail } from "@/lib/newsletter";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.dropName || !body?.description || !body?.heroImageUrl) {
    return NextResponse.json(
      { error: "Missing dropName, description, or heroImageUrl" },
      { status: 400 }
    );
  }

  try {
    const recipientCount = await sendDropAnnouncementEmail(
      body.dropName,
      body.description,
      body.heroImageUrl,
      body.ctaPath || "/"
    );
    return NextResponse.json({ ok: true, recipientCount });
  } catch (err) {
    console.error("Failed to send drop announcement", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send drop announcement" },
      { status: 500 }
    );
  }
}
