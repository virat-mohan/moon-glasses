import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Lists every conversation, most recently active first. */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ conversations: data ?? [] });
  } catch (err) {
    console.error("Failed to list WhatsApp conversations", err);
    return NextResponse.json({ conversations: [] }, { status: 500 });
  }
}
