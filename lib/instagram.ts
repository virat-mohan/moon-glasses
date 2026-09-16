import { getSetting } from "@/lib/settings";

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

async function igPost(path: string, accessToken: string, body: Record<string, unknown>) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
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
async function waitForMediaReady(containerId: string, accessToken: string) {
  const timeoutMs = 60_000;
  const intervalMs = 1500;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${containerId}?` +
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
  const { accessToken, igUserId } = await getInstagramAuth();

  const created = await igPost(`${igUserId}/media`, accessToken, {
    image_url: imageUrl,
    caption,
    user_tags: buildUserTags(taggedUsernames),
  });
  await waitForMediaReady(created.id, accessToken);
  const published = await igPost(`${igUserId}/media_publish`, accessToken, { creation_id: created.id });

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
  const { accessToken, igUserId } = await getInstagramAuth();
  if (imageUrls.length < 2) throw new Error("A carousel post needs at least 2 images");

  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const item = await igPost(`${igUserId}/media`, accessToken, {
      image_url: imageUrl,
      is_carousel_item: true,
      user_tags: buildUserTags(taggedUsernames),
    });
    await waitForMediaReady(item.id, accessToken);
    childIds.push(item.id);
  }

  const container = await igPost(`${igUserId}/media`, accessToken, {
    media_type: "CAROUSEL",
    children: childIds,
    caption,
  });
  await waitForMediaReady(container.id, accessToken);
  const published = await igPost(`${igUserId}/media_publish`, accessToken, { creation_id: container.id });

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
  const { accessToken, igUserId } = await getInstagramAuth();

  const mediaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media?` +
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
        `https://graph.facebook.com/${GRAPH_VERSION}/${item.id}/insights?` +
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
  const [accessToken, igUserId] = await Promise.all([
    getSetting("META_ACCESS_TOKEN"),
    getSetting("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
  ]);

  if (!accessToken || !igUserId) {
    throw new Error("Instagram is not configured — add META_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in /admin/settings");
  }

  const createRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        media_type: "STORIES",
        // Story link sticker — a real Instagram feature for API-published
        // Stories on Business/Creator accounts. Meta may reject this for
        // accounts that don't qualify; that surfaces as a normal error here.
        ...(linkUrl ? { link: linkUrl } : {}),
        access_token: accessToken,
      }),
    }
  );
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(`Instagram Graph API error: ${JSON.stringify(created)}`);
  await waitForMediaReady(created.id, accessToken);

  const publishRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: created.id, access_token: accessToken }),
    }
  );
  const published = await publishRes.json();
  if (!publishRes.ok) throw new Error(`Instagram Graph API error: ${JSON.stringify(published)}`);

  return { postId: published.id as string };
}
