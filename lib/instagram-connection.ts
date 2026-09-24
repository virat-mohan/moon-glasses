import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";

// "Instagram API with Instagram Login" — connects the brand's Professional
// account straight from the admin with one click, no Facebook Page needed.
// Stored as a single JSON row outside lib/settings.ts's SETTINGS_KEYS so the
// generic settings API can never read or overwrite the token.
const CONNECTION_KEY = "INSTAGRAM_LOGIN_CONNECTION";
const APP_KEY = "INSTAGRAM_LOGIN_APP";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];

export type InstagramConnection = {
  accessToken: string;
  userId: string;
  username: string;
  expiresAt: string;
  connectedAt: string;
};

type InstagramApp = { appId: string; appSecret: string };

async function readJson<T>(key: string): Promise<T | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (!data?.value) return null;
  try {
    return JSON.parse(data.value) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Awaited into a local before returning on purpose: Turbopack (Next 16.3) constant-folds
// `if (!x)` to false when x comes from a one-line `return someAsyncCall()` wrapper,
// silently deleting the null guard in callers.
export async function getInstagramApp(): Promise<InstagramApp | null> {
  const app = await readJson<InstagramApp>(APP_KEY);
  return app;
}

export async function saveInstagramApp(appId: string, appSecret: string) {
  if (!/^\d{6,}$/.test(appId.trim())) throw new Error("The Instagram app ID is a long number");
  if (appSecret.trim().length < 20) throw new Error("That app secret looks too short");
  await writeJson(APP_KEY, { appId: appId.trim(), appSecret: appSecret.trim() });
}

export async function getInstagramConnection(): Promise<InstagramConnection | null> {
  const connection = await readJson<InstagramConnection>(CONNECTION_KEY);
  return connection;
}

export async function disconnectInstagram() {
  const supabase = getSupabaseServerClient();
  await supabase.from("app_settings").delete().eq("key", CONNECTION_KEY);
}

export async function getInstagramRedirectUri() {
  const { siteUrl } = await getBrandProfile();
  // Always the www host — the bare domain redirects, and Instagram requires
  // the redirect URI to match what's registered in the Meta app exactly.
  const url = new URL(siteUrl);
  if (!url.hostname.startsWith("www.") && !url.hostname.includes("localhost")) url.hostname = `www.${url.hostname}`;
  return `${url.origin}/api/admin/instagram/callback`;
}

export async function buildInstagramAuthorizeUrl(state: string) {
  const app = await getInstagramApp();
  if (!app) throw new Error("Save the Instagram app ID and secret first");
  const params = new URLSearchParams({
    client_id: app.appId,
    redirect_uri: await getInstagramRedirectUri(),
    response_type: "code",
    scope: INSTAGRAM_SCOPES.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

async function jsonOrThrow(res: Response, what: string) {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error || data.error_message) {
    const msg = data?.error_message ?? data?.error?.message ?? JSON.stringify(data);
    throw new Error(`${what} failed: ${msg}`);
  }
  return data;
}

/** code → short-lived token → 60-day token → account identity, then stores the connection. */
export async function completeInstagramLogin(code: string) {
  const app = await getInstagramApp();
  if (!app) throw new Error("Instagram app isn't set up");
  const redirectUri = await getInstagramRedirectUri();

  const short = await jsonOrThrow(
    await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: app.appId,
        client_secret: app.appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    }),
    "Exchanging the Instagram login code"
  );

  const long = await jsonOrThrow(
    await fetch(
      "https://graph.instagram.com/access_token?" +
        new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: app.appSecret, access_token: short.access_token })
    ),
    "Getting a long-lived Instagram token"
  );

  const me = await jsonOrThrow(
    await fetch(
      "https://graph.instagram.com/v23.0/me?" +
        new URLSearchParams({ fields: "user_id,username,account_type", access_token: long.access_token })
    ),
    "Reading the Instagram account"
  );

  const connection: InstagramConnection = {
    accessToken: long.access_token,
    userId: String(me.user_id ?? me.id),
    username: me.username,
    expiresAt: new Date(Date.now() + (long.expires_in ?? 60 * 24 * 3600) * 1000).toISOString(),
    connectedAt: new Date().toISOString(),
  };
  await writeJson(CONNECTION_KEY, connection);
  return connection;
}

/** Long-lived tokens last 60 days and can be refreshed once they're 24h+ old — run daily so it never lapses. */
export async function refreshInstagramTokenIfNeeded() {
  const connection = await getInstagramConnection();
  if (!connection) return { refreshed: false, reason: "not connected" };
  const daysLeft = (new Date(connection.expiresAt).getTime() - Date.now()) / 86_400_000;
  if (daysLeft > 30) return { refreshed: false, reason: `${Math.round(daysLeft)} days left` };

  const data = await jsonOrThrow(
    await fetch(
      "https://graph.instagram.com/refresh_access_token?" +
        new URLSearchParams({ grant_type: "ig_refresh_token", access_token: connection.accessToken })
    ),
    "Refreshing the Instagram token"
  );
  await writeJson(CONNECTION_KEY, {
    ...connection,
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 60 * 24 * 3600) * 1000).toISOString(),
  });
  return { refreshed: true };
}
