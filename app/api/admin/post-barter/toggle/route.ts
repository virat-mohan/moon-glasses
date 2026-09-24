import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/settings";
import { isPostBarterEnabled } from "@/lib/post-barter";

export async function GET() {
  return NextResponse.json({ enabled: await isPostBarterEnabled() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Missing enabled (true/false)" }, { status: 400 });
  }
  await setSetting("POST_BARTER_ENABLED", body.enabled ? "true" : "false");
  // The homepage is cached for an hour — without this the banner would keep
  // showing (or stay hidden) until that cache expired.
  revalidatePath("/", "layout");
  return NextResponse.json({ enabled: body.enabled });
}
