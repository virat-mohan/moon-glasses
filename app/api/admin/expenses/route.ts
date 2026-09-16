import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const supabase = getSupabaseServerClient();
    let query = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    if (from) query = query.gte("expense_date", from);
    if (to) query = query.lte("expense_date", to);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ expenses: data ?? [] });
  } catch (err) {
    console.error("Failed to load expenses", err);
    return NextResponse.json({ error: "Could not load expenses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const expenseDate = String(body?.expenseDate ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const paidBy = String(body?.paidBy ?? "").trim();
  const description = body?.description ? String(body.description).trim() : null;
  const amount = Number(body?.amount);

  if (!expenseDate || !category || !paidBy || !amount || amount <= 0) {
    return NextResponse.json(
      { error: "Date, category, paid by, and a positive amount are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("expenses")
      .insert({ expense_date: expenseDate, category, paid_by: paidBy, description, amount })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ expense: data });
  } catch (err) {
    console.error("Failed to create expense", err);
    return NextResponse.json({ error: "Could not save expense" }, { status: 500 });
  }
}
