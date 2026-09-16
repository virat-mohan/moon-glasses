import { getSetting } from "@/lib/settings";

const GRAPH_VERSION = "v21.0";

export type AdInsights = { spend: number; clicks: number; impressions: number };

async function getMetaAuth() {
  const [accessToken, adAccountId] = await Promise.all([
    getSetting("META_ACCESS_TOKEN"),
    getSetting("META_AD_ACCOUNT_ID"),
  ]);
  if (!accessToken || !adAccountId) return null;
  return { accessToken, account: `act_${adAccountId.replace(/^act_/, "")}` };
}

/** Account-level spend/clicks/impressions for a date range — used for the weekly ROAS report. */
export async function getAccountInsights(since: string, until: string): Promise<AdInsights> {
  const auth = await getMetaAuth();
  if (!auth) return { spend: 0, clicks: 0, impressions: 0 };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${auth.account}/insights?` +
        new URLSearchParams({
          fields: "spend,clicks,impressions",
          time_range: JSON.stringify({ since, until }),
          access_token: auth.accessToken,
        })
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const row = data.data?.[0];
    return {
      spend: Math.round(Number(row?.spend ?? 0)),
      clicks: Number(row?.clicks ?? 0),
      impressions: Number(row?.impressions ?? 0),
    };
  } catch (err) {
    console.error("Failed to fetch Meta account insights", err);
    return { spend: 0, clicks: 0, impressions: 0 };
  }
}

export type DailyAdInsights = { date: string; spend: number; clicks: number; impressions: number };

/** Same account-level spend/clicks/impressions as getAccountInsights, but one row per day (time_increment=1) — for a day-wise breakdown instead of a single summed total. */
export async function getAccountInsightsDaily(since: string, until: string): Promise<DailyAdInsights[]> {
  const auth = await getMetaAuth();
  if (!auth) return [];

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${auth.account}/insights?` +
        new URLSearchParams({
          fields: "spend,clicks,impressions",
          time_range: JSON.stringify({ since, until }),
          time_increment: "1",
          access_token: auth.accessToken,
        })
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return (data.data ?? []).map((row: { date_start: string; spend?: string; clicks?: string; impressions?: string }) => ({
      date: row.date_start,
      spend: Math.round(Number(row.spend ?? 0)),
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
    }));
  } catch (err) {
    console.error("Failed to fetch Meta daily account insights", err);
    return [];
  }
}

/** Campaign-level insights for a single ad_brief's launched campaign — used by the ad agent. */
export async function getCampaignInsights(campaignId: string, days: number): Promise<AdInsights> {
  const auth = await getMetaAuth();
  if (!auth) return { spend: 0, clicks: 0, impressions: 0 };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${campaignId}/insights?` +
        new URLSearchParams({
          fields: "spend,clicks,impressions",
          date_preset: days <= 1 ? "yesterday" : days <= 7 ? "last_7d" : "last_30d",
          access_token: auth.accessToken,
        })
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const row = data.data?.[0];
    return {
      spend: Math.round(Number(row?.spend ?? 0)),
      clicks: Number(row?.clicks ?? 0),
      impressions: Number(row?.impressions ?? 0),
    };
  } catch (err) {
    console.error("Failed to fetch Meta campaign insights", campaignId, err);
    return { spend: 0, clicks: 0, impressions: 0 };
  }
}
