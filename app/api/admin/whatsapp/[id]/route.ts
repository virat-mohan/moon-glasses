import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** One conversation's full message history, and clears its unread count (the admin is looking at it now). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const [{ data: conversation }, { data: messages }] = await Promise.all([
      supabase.from("whatsapp_conversations").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("whatsapp_conversation_messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    if (conversation.unread_count > 0) {
      await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", id);
    }

    return NextResponse.json({ conversation, messages: messages ?? [] });
  } catch (err) {
    console.error("Failed to load WhatsApp conversation", err);
    return NextResponse.json({ error: "Could not load conversation" }, { status: 500 });
  }
}
