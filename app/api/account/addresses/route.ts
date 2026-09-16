import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.recipientName || !body?.phone || !body?.addressLine) {
    return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    // First address for a customer is the default automatically.
    const { count } = await supabase
      .from("customer_addresses")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id);

    const { data, error } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: customer.id,
        label: body.label || null,
        recipient_name: body.recipientName,
        phone: body.phone,
        address_line: body.addressLine,
        city: body.city || null,
        state: body.state || null,
        pincode: body.pincode || null,
        is_default: (count ?? 0) === 0,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ address: data });
  } catch (err) {
    console.error("Failed to add address", err);
    return NextResponse.json({ error: "Could not add address" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();

    if (body.setDefault) {
      await supabase
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("customer_id", customer.id);
      await supabase
        .from("customer_addresses")
        .update({ is_default: true })
        .eq("id", body.id)
        .eq("customer_id", customer.id);
      return NextResponse.json({ ok: true });
    }

    const patch: Record<string, string> = {};
    for (const key of ["label", "recipientName", "phone", "addressLine", "city", "state", "pincode"] as const) {
      if (body[key] != null) {
        const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        patch[column] = body[key];
      }
    }

    const { error } = await supabase
      .from("customer_addresses")
      .update(patch)
      .eq("id", body.id)
      .eq("customer_id", customer.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update address", err);
    return NextResponse.json({ error: "Could not update address" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("customer_addresses")
      .delete()
      .eq("id", body.id)
      .eq("customer_id", customer.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete address", err);
    return NextResponse.json({ error: "Could not delete address" }, { status: 500 });
  }
}
