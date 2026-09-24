import { getSetting } from "@/lib/settings";
import { getInstagramConnection } from "@/lib/instagram-connection";

const GRAPH_VERSION = "v21.0";

async function getInstagramAuth() {
  const [accessToken, igUserId] = await Promise.all([
    getSetting("META_ACCESS_TOKEN"),
    getSetting("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
  ]);
  if (!accessToken || !igUserId) {
    throw new Error("Instagram is not configured — add META_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in /admin/settings");
  }
  return { accessToken, igUserId };
}

/**
 * Auth for PUBLISHING and reading our own account. Prefers the one-click
 * "Connect Instagram" login (graph.instagram.com, no Facebook Page needed);
 * falls back to the older Facebook-token route. Business Discovery (other
 * people's follower counts) is only available on the Facebook route, so it
 * keeps using getInstagramAuth above.
 */
type PublishAuth = { accessToken: string; igUserId: string; base: string };

async function getPublishAuth(): Promise<PublishAuth> {
  const connection = await getInstagramConnection();
  if (connection) {
    return { accessToken: connection.accessToken, igUserId: connection.userId, base: `https://graph.instagram.com/${GRAPH_VERSION}` };
  }
  const { accessToken, igUserId } = await getInstagramAuth();
  return { accessToken, igUserId, base: `https://graph.facebook.com/${GRAPH_VERSION}` };
}

async function igPost(auth: PublishAuth, path: string, body: Record<string, unknown>) {
  const accessToken = auth.accessToken;
  const res = await fetch(`${auth.base}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Instagram Graph API error: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Meta fetches and processes image_url asynchronously after a media
 * container is created — publishing (or referencing it as a carousel child)
 * before it reports FINISHED fails with "Media ID is not available"
 * (subcode 2207027). This is common on multi-image carousels since every
 * child is uploading in parallel-ish succession. Polls status_code and only
 * returns once Meta says the container is actually ready.
 */
async function waitForMediaReady(auth: PublishAuth, containerId: string, timeoutMs = 60_000) {
  const accessToken = auth.accessToken;
  const intervalMs = 1500;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(
      `${auth.base}/${containerId}?` +
        new URLSearchParams({ fields: "status_code", access_token: accessToken })
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`Instagram Graph API error: ${JSON.stringify(data)}`);
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`Instagram media container ${containerId} failed processing`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Instagram media container ${containerId} did not finish processing in time`);
}

/**
 * Publishes a single-image feed post — a real, permanent post on the
 * Instagram grid, not a paid ad and not a 24-hour Story. Throws on
 * failure rather than swallowing it (unlike postToInstagramStory below),
 * since this is always an explicit admin action, never a best-effort
 * side-effect of something else.
 */
function buildUserTags(usernames?: string[]) {
  if (!usernames || usernames.length === 0) return undefined;
  // Centered on the image — Instagram doesn't expose a way to place these
  // precisely through this API, only a documented (x, y) pair per tag.
  return usernames.map((username) => ({ username: username.replace(/^@/, ""), x: 0.5, y: 0.5 }));
}

export async function postToInstagramFeed(imageUrl: string, caption: string, taggedUsernames?: string[]) {
  const auth = await getPublishAuth();
  const { igUserId } = auth;

  const created = await igPost(auth, `${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    user_tags: buildUserTags(taggedUsernames),
  });
  await waitForMediaReady(auth, created.id);
  const published = await igPost(auth, `${igUserId}/media_publish`, { creation_id: created.id });

  return { postId: published.id as string };
}

/**
 * Publishes a carousel feed post — each image is first uploaded as its own
 * unpublished carousel-item container (is_carousel_item: true, no caption
 * of its own), then a parent container references all of them via
 * children, and that parent is what actually gets published. Person tags go
 * on each child item, not the parent — Instagram doesn't accept user_tags on
 * a CAROUSEL container itself, only on its children.
 */
export async function postToInstagramCarouselFeed(
  imageUrls: string[],
  caption: string,
  taggedUsernames?: string[]
) {
  const auth = await getPublishAuth();
  const { igUserId } = auth;
  if (imageUrls.length < 2) throw new Error("A carousel post needs at least 2 images");

  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const item = await igPost(auth, `${igUserId}/media`, {
      image_url: imageUrl,
      is_carousel_item: true,
      user_tags: buildUserTags(taggedUsernames),
    });
    await waitForMediaReady(auth, item.id);
    childIds.push(item.id);
  }

  const container = await igPost(auth, `${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: childIds,
    caption,
  });
  await waitForMediaReady(auth, container.id);
  const published = await igPost(auth, `${igUserId}/media_publish`, { creation_id: container.id });

  return { postId: published.id as string };
}

export type InstagramPostPerformance = {
  id: string;
  caption: string | null;
  permalink: string | null;
  mediaType: string;
  timestamp: string;
  reach: number | null;
  interactions: number | null;
  engagementRate: number | null; // interactions / reach
};

/**
 * Recent organic feed posts with their engagement, for surfacing "this one
 * did well — worth boosting" recommendations. Metric names for Instagram
 * media insights have shifted across Graph API versions (older accounts
 * report "engagement", the current field is "total_interactions") — this
 * requests both and takes whichever comes back, so it degrades gracefully
 * instead of erroring outright if one metric name gets rejected. Skips any
 * post insights fetch that fails rather than aborting the whole list.
 */
export async function getRecentPostPerformance(limit = 12): Promise<InstagramPostPerformance[]> {
  const { accessToken, igUserId, base } = await getPublishAuth();

  const mediaRes = await fetch(
    `${base}/${igUserId}/media?` +
      new URLSearchParams({
        fields: "id,caption,media_type,permalink,timestamp",
        limit: String(limit),
        access_token: accessToken,
      })
  );
  const mediaData = await mediaRes.json();
  if (!mediaRes.ok) throw new Error(`Instagram Graph API error: ${JSON.stringify(mediaData)}`);

  const posts: InstagramPostPerformance[] = [];
  for (const item of mediaData.data ?? []) {
    let reach: number | null = null;
    let interactions: number | null = null;
    try {
      const insightsRes = await fetch(
        `${base}/${item.id}/insights?` +
          new URLSearchParams({ metric: "reach,total_interactions,engagement", access_token: accessToken })
      );
      const insightsData = await insightsRes.json();
      if (insightsRes.ok) {
        for (const metric of insightsData.data ?? []) {
          const value = metric.values?.[0]?.value ?? metric.total_value?.value;
          if (metric.name === "reach") reach = value ?? null;
          if (metric.name === "total_interactions" || metric.name === "engagement") {
            interactions = value ?? interactions;
          }
        }
      }
    } catch {
      // Best-effort — a post we can't get insights for still shows up, just without numbers.
    }

    posts.push({
      id: item.id,
      caption: item.caption ?? null,
      permalink: item.permalink ?? null,
      mediaType: item.media_type,
      timestamp: item.timestamp,
      reach,
      interactions,
      engagementRate: reach && interactions ? interactions / reach : null,
    });
  }

  return posts;
}

/**
 * Looks up a creator's PUBLIC follower count via Instagram Graph API's
 * Business Discovery — the brand's own connected Business/Creator account
 * querying another public Business/Creator account's basic stats by
 * username. Deliberately not a per-creator OAuth/connect flow: the creator
 * never authenticates anything, and we never touch anything beyond public
 * counts. Returns null (never throws) if the account can't be resolved —
 * most commonly because it's a personal (not Business/Creator) account,
 * which Business Discovery simply can't see, or Meta isn't configured
 * locally. Callers must treat null as "couldn't verify," not zero.
 */
/** Accepts a bare handle ("@name" or "name") or a full profile URL (any of instagram.com/name, instagram.com/name/, https://www.instagram.com/name?hl=en) and returns the clean username. Used everywhere a shopper types or pastes their Instagram identity, since asking for exactly one format is a needless way to lose people. */
export function parseInstagramHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();
}

export async function getPublicFollowerCount(instagramHandle: string): Promise<number | null> {
  const profile = await getBusinessDiscoveryProfile(instagramHandle);
  return profile?.followersCount ?? null;
}

/**
 * Same Business Discovery lookup as getPublicFollowerCount, but also pulls
 * `biography` — used ONLY for the "Pay With A Post" gift_first ownership
 * check (see lib/post-barter.ts's verifyGiftFirstOwnership): asking someone
 * to briefly drop a one-time code in their own bio proves they control the
 * account before free product ships on trust, without a full OAuth connect
 * flow. Kept as a separate function rather than always fetching biography
 * in getPublicFollowerCount, since every other caller (creator applications,
 * eligibility previews) has no reason to read someone's bio text.
 */
export async function getBusinessDiscoveryProfile(
  instagramHandle: string
): Promise<{ followersCount: number; biography: string } | null> {
  try {
    const { accessToken, igUserId } = await getInstagramAuth();
    const username = parseInstagramHandle(instagramHandle);
    if (!username) return null;

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}?` +
        new URLSearchParams({
          fields: `business_discovery.username(${username}){followers_count,biography}`,
          access_token: accessToken,
        })
    );
    const data = await res.json();
    if (!res.ok || typeof data?.business_discovery?.followers_count !== "number") return null;
    return {
      followersCount: data.business_discovery.followers_count as number,
      biography: (data.business_discovery.biography as string) ?? "",
    };
  } catch (err) {
    console.error("Instagram Business Discovery lookup failed", instagramHandle, err);
    return null;
  }
}

export type InstagramTaggedMedia = {
  id: string;
  caption: string | null;
  permalink: string | null;
  mediaType: string;
  username: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
};

/**
 * Media where the connected brand Instagram account itself is tagged or
 * added as a collaborator — this is the ONLY content-discovery mechanism in
 * the creator program, deliberately. It never touches a creator's own
 * account or requires them to connect anything: it only reads the brand's
 * own account's tagged-media list, which the already-configured
 * META_ACCESS_TOKEN has permission for. An admin reviews this list in
 * /admin/creators and links the relevant post to a creator by hand — see
 * app/api/admin/creators/content/route.ts.
 */
export async function getTaggedMedia(limit = 25): Promise<InstagramTaggedMedia[]> {
  const { accessToken, igUserId } = await getInstagramAuth();

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/tags?` +
      new URLSearchParams({
        fields: "id,caption,media_type,permalink,timestamp,username,like_count,comments_count",
        limit: String(limit),
        access_token: accessToken,
      })
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Instagram Graph API error: ${JSON.stringify(data)}`);

  return (data.data ?? []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    caption: (item.caption as string) ?? null,
    permalink: (item.permalink as string) ?? null,
    mediaType: item.media_type as string,
    username: (item.username as string) ?? null,
    timestamp: item.timestamp as string,
    likeCount: (item.like_count as number) ?? null,
    commentsCount: (item.comments_count as number) ?? null,
  }));
}

/**
 * Posts a photo to the connected Instagram Business account's Story feed.
 * Requires the Instagram account to be a Business/Creator account connected
 * to the same Meta app as META_ACCESS_TOKEN. Best-effort — a missing setting
 * or a failed post never blocks the underlying admin action (e.g. approving
 * an Explorer submission).
 */
export async function postToInstagramStory(imageUrl: string) {
  try {
    await postImageToInstagramStory(imageUrl);
    return true;
  } catch (err) {
    console.error("Instagram Story post failed", err);
    return false;
  }
}

/**
 * Same Story-post flow as postToInstagramStory above, but throws on failure
 * instead of swallowing it — for the manual "Post to Story" button in
 * /admin/ad-briefs, where the admin needs to actually see why a post failed
 * rather than have it silently no-op.
 */
export async function postImageToInstagramStory(imageUrl: string, linkUrl?: string) {
  const auth = await getPublishAuth();
  const created = await igPost(auth, `${auth.igUserId}/media`, {
    image_url: imageUrl,
    media_type: "STORIES",
    // Story link sticker — a real Instagram feature for API-published
    // Stories on Business/Creator accounts. Meta may reject this for
    // accounts that don't qualify; that surfaces as a normal error here.
    ...(linkUrl ? { link: linkUrl } : {}),
  });
  await waitForMediaReady(auth, created.id);
  const published = await igPost(auth, `${auth.igUserId}/media_publish`, { creation_id: created.id });
  return { postId: published.id as string };
}

/** Publishes a Reel from a public video URL (MP4/MOV, 3s–15min). Video processing is slower than images, so this waits longer. */
export async function postReelToInstagram(videoUrl: string, caption: string, coverUrl?: string) {
  const auth = await getPublishAuth();
  const created = await igPost(auth, `${auth.igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: true,
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  });
  await waitForMediaReady(auth, created.id, 5 * 60_000);
  const published = await igPost(auth, `${auth.igUserId}/media_publish`, { creation_id: created.id });
  return { postId: published.id as string };
}
