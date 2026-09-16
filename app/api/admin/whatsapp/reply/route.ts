import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";
import { logOutboundWhatsAppMessage } from "@/lib/whatsapp-inbox";

/**
 * Sends a free-text reply from the admin inbox — only deliverable within
 * Meta's 24-hour session window since the customer's last message, same
 * rule as any WhatsApp Business inbox. Outside that window this will fail
 * and a template Flow would be needed instead (not built here — this route
 * is for live back-and-forth, not the first outbound touch).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.conversationId || !body?.text) {
    return NextResponse.json({ error: "Missing conversationId or text" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("customer_phone")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const result = await sendWhatsAppSessionMessage(conversation.customer_phone, body.text);
    await logOutboundWhatsAppMessage({
      conversationId: body.conversationId,
      body: body.text,
      providerMessageId: result.sent ? result.messageId : undefined,
      status: result.sent ? "sent" : "failed",
    });

    if (!result.sent) {
      return NextResponse.json({ error: result.error ?? "Could not send message" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send WhatsApp reply", err);
    return NextResponse.json({ error: "Could not send reply" }, { status: 500 });
  }
}
