import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_actions")
      .select("*, ad_briefs(headline)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ actions: data ?? [] });
  } catch (err) {
    console.error("Failed to list agent actions", err);
    return NextResponse.json({ actions: [] }, { status: 500 });
  }
}
