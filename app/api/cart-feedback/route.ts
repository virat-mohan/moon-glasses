import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

const VALID_REASONS = new Set(["price", "designs", "technical", "later", "other"]);

/**
 * Hit by the one-click "why didn't you buy" links in the BUYNOW10 email —
 * a plain GET so clicking the link is all it takes, no login/form needed.
 * "other" redirects to a one-field page instead of recording immediately,
 * since it needs free text.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session");
  const reason = url.searchParams.get("reason");

  if (!session || !reason || !VALID_REASONS.has(reason)) {
    return NextResponse.redirect(new URL("/cart-feedback/thanks", url));
  }

  if (reason === "other") {
    return NextResponse.redirect(new URL(`/cart-feedback/other?session=${session}`, url));
  }

  const supabase = getSupabaseServerClient();
  await supabase
    .from("cart_sessions")
    .update({ abandon_reason: reason, abandon_reason_at: new Date().toISOString() })
    .eq("id", session);

  return NextResponse.redirect(new URL("/cart-feedback/thanks", url));
}
