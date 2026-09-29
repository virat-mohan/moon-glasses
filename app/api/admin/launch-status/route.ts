import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase";
import { LAUNCH_SOON_KEY, isLaunchSoon } from "@/lib/launch";

export async function GET() {
  return NextResponse.json({ soon: await isLaunchSoon() });
}

/** Turns the storefront's "Launching soon" mode on or off. */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.soon !== "boolean") return NextResponse.json({ error: "Missing soon" }, { status: 400 });
  const { error } = await getSupabaseServerClient()
    .from("app_settings")
    .upsert({ key: LAUNCH_SOON_KEY, value: String(body.soon) }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Could not update" }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ soon: body.soon });
}
