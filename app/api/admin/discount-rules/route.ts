import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.buyQuantity || body?.discountPercent == null) {
    return NextResponse.json({ error: "Missing name, buyQuantity, or discountPercent" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("discount_rules")
      .insert({
        name: body.name,
        buy_quantity: body.buyQuantity,
        discount_percent: body.discountPercent,
        active: body.active ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, rule: data });
  } catch (err) {
    console.error("Failed to create discount rule", err);
    return NextResponse.json({ error: "Could not create discount rule" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, string | number | boolean> = {};
  if (body.name != null) patch.name = body.name;
  if (body.buyQuantity != null) patch.buy_quantity = body.buyQuantity;
  if (body.discountPercent != null) patch.discount_percent = body.discountPercent;
  if (body.active != null) patch.active = body.active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("discount_rules").update(patch).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update discount rule", err);
    return NextResponse.json({ error: "Could not update discount rule" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("discount_rules").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete discount rule", err);
    return NextResponse.json({ error: "Could not delete discount rule" }, { status: 500 });
  }
}
