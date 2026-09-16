import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete expense", err);
    return NextResponse.json({ error: "Could not delete expense" }, { status: 500 });
  }
}
