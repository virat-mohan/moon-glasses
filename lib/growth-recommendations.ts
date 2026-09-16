import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";
import { getRecentPostPerformance } from "@/lib/instagram";

export type Recommendation = {
  area: "ads" | "organic" | "whatsapp" | "traffic";
  summary: string;
  detail: string;
};

type Signals = {
  topViewedChapters: { name: string; views: number }[];
  topAddedChapters: { name: string; adds: number }[];
  trafficSources: { source: string; sessions: number }[];
  sessions: number;
  cartAbandonmentRate: number;
  addedToCartCount: number;
  whatsappTemplates: { name: string; sent: number; converted: number }[];
  instagramPosts: { caption: string | null; engagementRate: number | null; permalink: string | null }[];
  latestAdReport: { adSpend: number; roas: number | null; revenue: number } | null;
  instagramError: boolean;
};

/** Pulls the raw numbers from every channel — no interpretation, just data for the model (or the fallback) to reason over. */
async function gatherSignals(): Promise<Signals> {
  const untilIso = new Date().toISOString();
  const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseServerClient();

  const [analyticsResult, messagesResult, postsResult, reportResult] = await Promise.allSettled([
    computeWebsiteAnalytics(sinceIso, untilIso),
    supabase.from("whatsapp_messages").select("template_name, status, converted").gte("created_at", sinceIso),
    getRecentPostPerformance(12),
    supabase.from("weekly_reports").select("ad_spend, roas, revenue").order("week_end", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const analytics = analyticsResult.status === "fulfilled" ? analyticsResult.value : null;

  const byTemplate = new Map<string, { sent: number; converted: number }>();
  if (messagesResult.status === "fulfilled") {
    for (const m of messagesResult.value.data ?? []) {
      const row = byTemplate.get(m.template_name) ?? { sent: 0, converted: 0 };
      row.sent += 1;
      if (m.converted) row.converted += 1;
      byTemplate.set(m.template_name, row);
    }
  }

  const posts = postsResult.status === "fulfilled" ? postsResult.value : [];
  const latest = reportResult.status === "fulfilled" ? reportResult.value.data : null;

  return {
    topViewedChapters: analytics?.topViewedChapters ?? [],
    topAddedChapters: analytics?.topAddedChapters ?? [],
    trafficSources: analytics?.trafficSources ?? [],
    sessions: analytics?.sessions ?? 0,
    cartAbandonmentRate: analytics?.cartAbandonmentRate ?? 0,
    addedToCartCount: analytics?.funnel.addedToCart ?? 0,
    whatsappTemplates: [...byTemplate.entries()]
      .filter(([, s]) => s.sent >= 5)
      .map(([name, s]) => ({ name, sent: s.sent, converted: s.converted })),
    instagramPosts: posts.map((p) => ({ caption: p.caption, engagementRate: p.engagementRate, permalink: p.permalink })),
    latestAdReport: latest ? { adSpend: latest.ad_spend, roas: latest.roas, revenue: latest.revenue } : null,
    instagramError: postsResult.status === "rejected",
  };
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(`Claude response did not contain a JSON array: ${text.slice(0, 300)}`);
  return raw.slice(start, end + 1);
}

/** Asks Claude to actually reason over the raw signals — what's working, what isn't, and what's worth trying next — instead of fixed if/else thresholds. */
async function askClaudeForRecommendations(signals: Signals): Promise<Recommendation[]> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const prompt = `You are a sharp, numbers-driven growth marketer for an Indian D2C brand selling trucker caps. Below is real performance data from the last 14 days across the website, WhatsApp, Instagram, and Meta ads. Look for what's actually working, what's underperforming, and non-obvious connections between channels (e.g. a chapter selling well organically that has no ad running, or a high-engagement Instagram post that was never turned into an ad).

WEBSITE (last 14 days):
- Sessions: ${signals.sessions}
- Most-viewed products: ${JSON.stringify(signals.topViewedChapters)}
- Most-added-to-cart products: ${JSON.stringify(signals.topAddedChapters)}
- Traffic sources: ${JSON.stringify(signals.trafficSources)}
- Cart abandonment rate: ${Math.round(signals.cartAbandonmentRate * 100)}% (${signals.addedToCartCount} sessions added to cart)

WHATSAPP TEMPLATES (sent >= 5 times, last 14 days):
${JSON.stringify(signals.whatsappTemplates)}

INSTAGRAM — recent organic posts with engagement rate (interactions / reach):
${JSON.stringify(signals.instagramPosts)}

META ADS — most recent weekly report:
${JSON.stringify(signals.latestAdReport)}

Return ONLY a JSON array (no commentary), 3-6 items, each shaped exactly like:
{
  "area": "one of: ads, organic, whatsapp, traffic",
  "summary": "under 12 words, the specific finding",
  "detail": "2-3 sentences: the evidence from the data above, and a concrete next action — not generic advice. Reference actual numbers/names from the data given."
}
Only include a recommendation when the data actually supports it — do not pad to reach 6 items. If a whole category has no data, skip it rather than inventing something.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const text = data.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text ?? "";
  const parsed = JSON.parse(extractJson(text));
  if (!Array.isArray(parsed)) throw new Error("Claude response was not an array");

  return parsed
    .filter((r) => r && typeof r.summary === "string" && typeof r.detail === "string")
    .map((r) => ({
      area: ["ads", "organic", "whatsapp", "traffic"].includes(r.area) ? r.area : "traffic",
      summary: r.summary,
      detail: r.detail,
    }));
}

/** Rule-based fallback if Claude isn't configured or the call fails — same fixed thresholds as before, so the section never goes blank. */
function rulesBasedRecommendations(signals: Signals): Recommendation[] {
  const recs: Recommendation[] = [];

  const topViewed = signals.topViewedChapters[0];
  const topAdded = signals.topAddedChapters[0];
  if (topViewed && (!topAdded || topViewed.name !== topAdded.name)) {
    recs.push({
      area: "traffic",
      summary: `${topViewed.name} gets looked at the most but isn't converting to cart adds`,
      detail: `${topViewed.views} product views in the last 14 days, but it's not your top add-to-cart chapter (${topAdded ? topAdded.name : "none yet"} is). Worth checking its price, photos, or description against what's actually converting.`,
    });
  }

  const bestSource = signals.trafficSources[0];
  if (bestSource && signals.sessions > 20) {
    recs.push({
      area: "traffic",
      summary: `${bestSource.source} is your biggest traffic source right now`,
      detail: `${bestSource.sessions} of ${signals.sessions} sessions in the last 14 days came from ${bestSource.source}. If that's an organic/free channel, it's worth a paid push there before spreading budget elsewhere.`,
    });
  }

  if (signals.cartAbandonmentRate > 0.5 && signals.addedToCartCount >= 5) {
    recs.push({
      area: "traffic",
      summary: `${Math.round(signals.cartAbandonmentRate * 100)}% of carts are being abandoned`,
      detail: `${signals.addedToCartCount} sessions added to cart in the last 14 days, but most never purchased. Worth checking the abandoned-cart WhatsApp/email nudge is actually enabled and firing.`,
    });
  }

  for (const t of signals.whatsappTemplates) {
    const rate = t.converted / t.sent;
    if (rate >= 0.15) {
      recs.push({
        area: "whatsapp",
        summary: `"${t.name}" WhatsApp messages are converting well`,
        detail: `${t.converted} of ${t.sent} sent in the last 14 days led to a purchase (${Math.round(rate * 100)}%). Consider whether this messaging style fits other flows too.`,
      });
    } else if (rate === 0 && t.sent >= 10) {
      recs.push({
        area: "whatsapp",
        summary: `"${t.name}" WhatsApp messages aren't converting`,
        detail: `${t.sent} sent in the last 14 days, 0 conversions. Worth reviewing the message copy or whether it's reaching the right audience.`,
      });
    }
  }

  const rated = signals.instagramPosts.filter((p) => p.engagementRate !== null);
  if (rated.length > 0) {
    const avgRate = rated.reduce((sum, p) => sum + (p.engagementRate ?? 0), 0) / rated.length;
    const standouts = rated
      .filter((p) => (p.engagementRate ?? 0) >= avgRate * 1.5)
      .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
      .slice(0, 3);
    for (const post of standouts) {
      recs.push({
        area: "organic",
        summary: "An organic post is outperforming your average engagement",
        detail: `${(post.caption ?? "(no caption)").slice(0, 80)} — ${Math.round((post.engagementRate ?? 0) * 100)}% engagement rate vs. an average of ${Math.round(avgRate * 100)}% across recent posts. This is a strong candidate to boost as a paid ad.${post.permalink ? ` ${post.permalink}` : ""}`,
      });
    }
  } else if (signals.instagramError) {
    recs.push({
      area: "organic",
      summary: "Couldn't check Instagram post performance",
      detail: "Instagram isn't configured, or the access token doesn't have insights permission yet — add META_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in /admin/settings.",
    });
  }

  if (signals.latestAdReport && signals.latestAdReport.adSpend > 0) {
    const { adSpend, roas, revenue } = signals.latestAdReport;
    if (roas !== null && roas < 1) {
      recs.push({
        area: "ads",
        summary: "Last week's ad spend lost money overall",
        detail: `₹${adSpend} spent for ₹${revenue} attributed revenue (${roas.toFixed(2)}x ROAS). Check /admin/agent-log for which specific campaigns are dragging this down.`,
      });
    } else if (roas !== null && roas >= 3) {
      recs.push({
        area: "ads",
        summary: "Last week's ad spend is performing well — room to scale",
        detail: `₹${adSpend} spent for ₹${revenue} attributed revenue (${roas.toFixed(2)}x ROAS). Worth increasing budget on whichever campaign is driving this, beyond what the automatic agent caps at.`,
      });
    }
  }

  return recs;
}

/**
 * A read-only pass across every channel already being tracked — ad
 * performance, WhatsApp send stats, first-party site analytics, and
 * organic Instagram engagement. Claude reasons over the raw numbers to
 * find non-obvious patterns (e.g. a high-engagement organic post that
 * was never turned into an ad); if ANTHROPIC_API_KEY isn't set or the
 * call fails, falls back to fixed-threshold rules so this never goes
 * blank. Deliberately advisory only: unlike lib/ad-agent.ts (which is
 * allowed to pause/scale a campaign it already launched), nothing here
 * takes any action — a human reads these and decides.
 */
export async function generateGrowthRecommendations(): Promise<Recommendation[]> {
  const signals = await gatherSignals();
  try {
    return await askClaudeForRecommendations(signals);
  } catch (err) {
    console.error("Growth recommendations: Claude synthesis failed, falling back to rules", err);
    return rulesBasedRecommendations(signals);
  }
}
