import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.formData();
  const session = body.get("session")?.toString();
  const note = body.get("note")?.toString().slice(0, 1000) ?? "";

  if (!session) {
    return NextResponse.redirect(new URL("/cart-feedback/thanks", request.url), 303);
  }

  const supabase = getSupabaseServerClient();
  await supabase
    .from("cart_sessions")
    .update({ abandon_reason: "other", abandon_reason_note: note || null, abandon_reason_at: new Date().toISOString() })
    .eq("id", session);

  return NextResponse.redirect(new URL("/cart-feedback/thanks", request.url), 303);
}
