import { getSupabaseServerClient } from "@/lib/supabase";
import { getInstagramConnection } from "@/lib/instagram-connection";

/**
 * Picks up Pay With A Post shares automatically, so a barterer doesn't have
 * to paste their post link (and a gift-first customer isn't charged for
 * forgetting to). Three sources, all via the one-click Instagram connection:
 *   - story:   someone @mentions us in a Story → arrives as a DM webhook
 *              with a story_mention attachment. Stories vanish in 24h, so
 *              the media is copied into private storage immediately as proof.
 *   - mention: someone @mentions us in a post caption → "mentions" webhook.
 *   - collab:  someone adds us as collaborator and we accept → the post shows
 *              in our own media list, found by pollCollabPosts().
 * Every detection is logged in instagram_mentions (matched or not) for
 * reporting; a match marks the barter order as posted.
 */

const GRAPH = "https://graph.instagram.com/v23.0";
const BUCKET = "whatsapp-media";
export const STORAGE_REF_PREFIX = "storage://";

type Kind = "story" | "mention" | "collab";

async function igGet(path: string, params: Record<string, string>, token: string) {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: token })}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(data?.error?.message ?? `Instagram API ${res.status}`);
  return data;
}

async function storeMedia(url: string, name: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    const ext = type.includes("video") ? "mp4" : type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const path = `instagram/${name}.${ext}`;
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await res.arrayBuffer()), { contentType: type, upsert: true });
    if (error) throw error;
    return `${STORAGE_REF_PREFIX}${BUCKET}/${path}`;
  } catch (err) {
    console.error("barter-post-detection: could not store media", name, err);
    return null;
  }
}

/** Logs a detection (idempotent per kind+media) and, if the author has an open Pay With A Post order, marks it posted. */
async function recordDetection(input: {
  kind: Kind;
  mediaId: string;
  username: string | null;
  permalink: string | null;
  mediaRef: string | null;
  caption: string | null;
  raw: unknown;
}) {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("instagram_mentions")
    .select("id")
    .eq("kind", input.kind)
    .eq("media_id", input.mediaId)
    .maybeSingle();
  if (existing) return;

  const username = input.username?.toLowerCase().replace(/^@/, "") ?? null;
  let matchedOrderId: string | null = null;
  if (username) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, barter_post_url")
      .eq("is_post_barter", true)
      .ilike("barter_instagram_handle", username)
      .order("created_at", { ascending: false })
      .limit(5);
    const target = (orders ?? []).find((o) => !o.barter_post_url) ?? orders?.[0];
    if (target) {
      matchedOrderId = target.id;
      const proof = input.permalink ?? input.mediaRef;
      if (!target.barter_post_url && proof) {
        await supabase
          .from("orders")
          .update({ barter_post_url: proof, barter_post_source: input.kind, barter_post_detected_at: new Date().toISOString() })
          .eq("id", target.id);
      }
    }
  }

  const { error } = await supabase.from("instagram_mentions").insert({
    kind: input.kind,
    media_id: input.mediaId,
    ig_username: username,
    permalink: input.permalink,
    media_ref: input.mediaRef,
    caption: input.caption,
    matched_order_id: matchedOrderId,
    raw: input.raw,
  });
  if (error && error.code !== "23505") console.error("barter-post-detection: could not log", error);
}

type IgWebhookEntry = {
  id?: string;
  messaging?: {
    sender?: { id?: string };
    recipient?: { id?: string };
    message?: { mid?: string; is_echo?: boolean; attachments?: { type?: string; payload?: { url?: string } }[] };
  }[];
  changes?: { field?: string; value?: { media_id?: string; comment_id?: string; id?: string } }[];
};

/** Handles an `instagram` webhook body. Never throws — errors are logged per event. */
export async function handleInstagramDetectionWebhook(body: { entry?: IgWebhookEntry[] }) {
  const connection = await getInstagramConnection();
  if (!connection) return;

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (event.message?.is_echo) continue;
      for (const att of event.message?.attachments ?? []) {
        if (att.type !== "story_mention" || !att.payload?.url) continue;
        try {
          const senderId = event.sender?.id ?? "";
          let username: string | null = null;
          try {
            username = (await igGet(senderId, { fields: "username" }, connection.accessToken)).username ?? null;
          } catch (err) {
            console.error("barter-post-detection: could not resolve story sender", senderId, err);
          }
          const mediaId = event.message?.mid ?? `${senderId}-${Date.now()}`;
          const mediaRef = await storeMedia(att.payload.url, `story-${mediaId.slice(-40)}`);
          await recordDetection({ kind: "story", mediaId, username, permalink: null, mediaRef, caption: null, raw: event });
        } catch (err) {
          console.error("barter-post-detection: story mention failed", err);
        }
      }
    }

    for (const change of entry.changes ?? []) {
      if (change.field !== "mentions") continue;
      const mediaId = change.value?.media_id;
      if (!mediaId) continue;
      try {
        let media: { username?: string; permalink?: string; caption?: string; media_url?: string } = {};
        try {
          media = await igGet(mediaId, { fields: "username,permalink,caption,media_url,media_type" }, connection.accessToken);
        } catch (err) {
          console.error("barter-post-detection: could not read mentioned media", mediaId, err);
        }
        const mediaRef = !media.permalink && media.media_url ? await storeMedia(media.media_url, `mention-${mediaId}`) : null;
        await recordDetection({
          kind: "mention",
          mediaId,
          username: media.username ?? null,
          permalink: media.permalink ?? null,
          mediaRef,
          caption: media.caption ?? null,
          raw: change,
        });
      } catch (err) {
        console.error("barter-post-detection: caption mention failed", err);
      }
    }
  }
}

/** Collaborator posts we've accepted appear in our own media list under the creator's username. */
export async function pollCollabPosts() {
  const connection = await getInstagramConnection();
  if (!connection) return { checked: 0, reason: "not connected" };
  const data = await igGet(
    `${connection.userId}/media`,
    { fields: "id,username,permalink,caption,timestamp", limit: "50" },
    connection.accessToken
  );
  let found = 0;
  for (const item of data.data ?? []) {
    if (!item.username || item.username.toLowerCase() === connection.username.toLowerCase()) continue;
    found++;
    await recordDetection({
      kind: "collab",
      mediaId: item.id,
      username: item.username,
      permalink: item.permalink ?? null,
      mediaRef: null,
      caption: item.caption ?? null,
      raw: item,
    });
  }
  return { checked: (data.data ?? []).length, collabPosts: found };
}
