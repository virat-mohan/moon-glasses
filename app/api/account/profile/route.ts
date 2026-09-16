import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  const patch: Record<string, string | boolean> = {};
  if (body.name != null) patch.name = body.name;
  if (body.email != null) patch.email = body.email;
  if (body.newsletterSubscribed != null) patch.newsletter_subscribed = body.newsletterSubscribed;

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("customers").update(patch).eq("id", customer.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update profile", err);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }
}
