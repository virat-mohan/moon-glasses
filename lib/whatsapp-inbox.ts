import { getSupabaseServerClient } from "@/lib/supabase";

/** Finds or creates the one conversation row for a phone number, bumping its preview/timestamp. */
async function upsertConversation(
  phone: string,
  patch: { customerName?: string | null; preview: string; bumpUnread?: boolean }
) {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id, unread_count")
    .eq("customer_phone", phone)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        customer_name: patch.customerName ?? undefined,
        last_message_at: new Date().toISOString(),
        last_message_preview: patch.preview.slice(0, 200),
        unread_count: patch.bumpUnread ? existing.unread_count + 1 : existing.unread_count,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      customer_phone: phone,
      customer_name: patch.customerName ?? null,
      last_message_preview: patch.preview.slice(0, 200),
      unread_count: patch.bumpUnread ? 1 : 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}

/** Logs an inbound customer message, creating the conversation if this is their first. */
export async function logInboundWhatsAppMessage(input: {
  phone: string;
  body: string;
  customerName?: string | null;
  mediaUrl?: string | null;
  providerMessageId?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  const conversationId = await upsertConversation(input.phone, {
    customerName: input.customerName,
    preview: input.body || "(media)",
    bumpUnread: true,
  });
  await supabase.from("whatsapp_conversation_messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    body: input.body || null,
    media_url: input.mediaUrl ?? null,
    provider_message_id: input.providerMessageId ?? null,
    status: "received",
  });
  return conversationId;
}

/** Logs an admin's outbound reply against an existing conversation. */
export async function logOutboundWhatsAppMessage(input: {
  conversationId: string;
  body: string;
  providerMessageId?: string | null;
  status: "sent" | "failed";
}) {
  const supabase = getSupabaseServerClient();
  await supabase.from("whatsapp_conversation_messages").insert({
    conversation_id: input.conversationId,
    direction: "outbound",
    body: input.body,
    provider_message_id: input.providerMessageId ?? null,
    status: input.status,
  });
  if (input.status === "sent") {
    await supabase
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: input.body.slice(0, 200) })
      .eq("id", input.conversationId);
  }
}
