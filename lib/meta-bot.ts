import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { chapters } from "@/lib/chapters";
import { createLead, type LeadType, type LeadSource } from "@/lib/leads";

const GRAPH_VERSION = "v21.0";

type Platform = "instagram" | "facebook";

type Conversation = {
  id: string;
  platform: Platform;
  meta_user_id: string;
  state: "greeting" | "awaiting_intent" | "awaiting_chapter" | "awaiting_contact" | "done";
  profile_name: string | null;
  intent: LeadType | null;
  chapter_slug: string | null;
  collected_phone: string | null;
  collected_email: string | null;
  lead_id: string | null;
};

/**
 * Everything here talks to Meta's Send API / Graph API for messaging. The
 * exact request shapes follow Meta's documented "Instagram messaging via
 * the Messenger Platform" pattern (same endpoint + page token for both IG
 * and FB, since the IG Business account is linked to the Page) — but none
 * of it has been exercised against a live, approved app yet. Treat field
 * names here as best-effort until App Review is through and a real message
 * has round-tripped; check Meta's current docs first if something 400s.
 */
async function getPageToken() {
  return getSetting("META_ACCESS_TOKEN");
}

async function sendMessage(recipientId: string, text: string) {
  const [accessToken, pageId] = await Promise.all([getPageToken(), getSetting("META_PAGE_ID")]);
  if (!accessToken || !pageId) {
    console.log("Meta not configured — would have sent:", text);
    return false;
  }
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
      }),
    }
  );
  if (!res.ok) {
    console.error("Meta send message failed", res.status, await res.text());
    return false;
  }
  return true;
}

async function sendPrivateReplyToComment(commentId: string, text: string) {
  const [accessToken, pageId] = await Promise.all([getPageToken(), getSetting("META_PAGE_ID")]);
  if (!accessToken || !pageId) return false;
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    }
  );
  if (!res.ok) {
    console.error("Meta private reply failed", res.status, await res.text());
    return false;
  }
  return true;
}

async function fetchProfileName(senderId: string) {
  const accessToken = await getPageToken();
  if (!accessToken) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${senderId}?fields=name&access_token=${accessToken}`
    );
    const data = await res.json();
    return typeof data.name === "string" ? data.name : null;
  } catch {
    return null;
  }
}

async function getOrCreateConversation(platform: Platform, senderId: string): Promise<Conversation> {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("bot_conversations")
    .select("*")
    .eq("platform", platform)
    .eq("meta_user_id", senderId)
    .maybeSingle();
  if (existing) return existing as Conversation;

  const profileName = await fetchProfileName(senderId);
  const { data: created, error } = await supabase
    .from("bot_conversations")
    .insert({ platform, meta_user_id: senderId, state: "greeting", profile_name: profileName })
    .select()
    .single();
  if (error) throw error;
  return created as Conversation;
}

async function updateConversation(id: string, patch: Partial<Conversation>) {
  const supabase = getSupabaseServerClient();
  await supabase
    .from("bot_conversations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

const PHONE_RE = /(\+?\d[\d\s-]{8,14}\d)/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

function parseIntent(text: string): LeadType | null {
  const t = text.toLowerCase();
  if (/\b(1|buy|buying|purchase|order)\b/.test(t)) return "buying";
  if (/\b(2|collab|collaborate|collaborating|partnership|influencer)\b/.test(t)) return "collaborating";
  if (/\b(3|question|enquiry|inquiry|general|help)\b/.test(t)) return "general_enquiry";
  return null;
}

function findChapter(text: string) {
  const t = text.toLowerCase();
  return chapters.find((c) => t.includes(c.name.toLowerCase()) || t.includes(c.slug.replace(/-/g, " ")));
}

/**
 * Advances one conversation by one incoming message and sends whatever
 * reply that produces. Deliberately linear/scripted rather than freeform —
 * an AI-freeform DM bot for a storefront is a much bigger trust/liability
 * surface (wrong prices, made-up policies) than a short fixed script.
 */
export async function handleIncomingMessage(
  platform: Platform,
  senderId: string,
  text: string,
  source: LeadSource = "meta_dm"
) {
  const convo = await getOrCreateConversation(platform, senderId);
  const brand = await getBrandProfile();
  const greetName = convo.profile_name ? `Hey ${convo.profile_name.split(" ")[0]}!` : "Hey there!";

  if (convo.state === "greeting") {
    await updateConversation(convo.id, { state: "awaiting_intent" });
    await sendMessage(
      senderId,
      `${greetName} Thanks for reaching out to ${brand.brandName}. Are you here to:\n1) Buy something\n2) Collaborate with us\n3) Ask a general question\n\nJust reply with the number.`
    );
    return;
  }

  if (convo.state === "awaiting_intent") {
    const intent = parseIntent(text);
    if (!intent) {
      await sendMessage(senderId, "Sorry, just reply 1, 2, or 3 — buy, collaborate, or a general question.");
      return;
    }
    if (intent === "buying") {
      await updateConversation(convo.id, { state: "awaiting_chapter", intent });
      await sendMessage(senderId, "Nice — which Chapter (cap) are you after? Just type the name.");
    } else {
      await updateConversation(convo.id, { state: "awaiting_contact", intent });
      await sendMessage(
        senderId,
        "Got it. What's the best phone number or email to reach you at, and go ahead and tell me a bit about what you had in mind?"
      );
    }
    return;
  }

  if (convo.state === "awaiting_chapter") {
    const chapter = findChapter(text);
    await updateConversation(convo.id, { state: "awaiting_contact", chapter_slug: chapter?.slug ?? null });
    await sendMessage(
      senderId,
      chapter
        ? `${chapter.name}, good pick. What's the best phone number or email to reach you at for order updates?`
        : "Couldn't quite match that to a Chapter, no worries — what's the best phone number or email to reach you at? We'll help you find the right one."
    );
    return;
  }

  if (convo.state === "awaiting_contact") {
    const phone = text.match(PHONE_RE)?.[0]?.replace(/[\s-]/g, "") ?? null;
    const email = text.match(EMAIL_RE)?.[0] ?? null;
    if (!phone && !email) {
      await sendMessage(senderId, "Just need a phone number or email to note you down — go ahead and share one.");
      return;
    }

    const chapter = convo.chapter_slug ? chapters.find((c) => c.slug === convo.chapter_slug) : null;
    const lead = await createLead({
      name: convo.profile_name,
      phone,
      email,
      source,
      leadType: convo.intent,
      platform,
      metaUserId: senderId,
      note: chapter ? `Interested in: ${chapter.name}` : text.slice(0, 500),
    });
    await updateConversation(convo.id, {
      state: "done",
      collected_phone: phone,
      collected_email: email,
      lead_id: lead.id,
    });

    if (convo.intent === "buying" && chapter) {
      const link = `${brand.siteUrl.replace(/\/$/, "")}/chapter/${chapter.slug}`;
      await sendMessage(senderId, `Here's the link to grab the ${chapter.name}: ${link}`);
    } else if (convo.intent === "buying") {
      await sendMessage(
        senderId,
        `Here's the full Collection so you can pick one: ${brand.siteUrl.replace(/\/$/, "")}/series`
      );
    } else {
      await sendMessage(senderId, "Thanks! We've noted this down and someone from the team will get back to you soon.");
    }
    return;
  }

  // state === "done" — quiet restart on request, otherwise leave it alone.
  if (/\b(restart|start over|new)\b/i.test(text)) {
    await updateConversation(convo.id, {
      state: "awaiting_intent",
      intent: null,
      chapter_slug: null,
    });
    await sendMessage(senderId, "Sure — starting over. Buy something, collaborate, or a general question? (1/2/3)");
  }
}

/**
 * A comment on a post/reel — auto-replies publicly to acknowledge it, then
 * opens the same scripted DM flow via Meta's "private reply" mechanism so
 * the lead-capture conversation starts without the commenter having to DM
 * first.
 */
export async function handleIncomingComment(
  platform: Platform,
  commentId: string,
  senderId: string,
  text: string
) {
  await sendPrivateReplyToComment(
    commentId,
    "Thanks for the comment! Sliding into your DMs so we can help you out 🙂"
  );
  await handleIncomingMessage(platform, senderId, text, "meta_comment");
}
