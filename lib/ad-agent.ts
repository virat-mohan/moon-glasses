import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getCampaignInsights } from "@/lib/meta-insights";
import { getAttributedRevenue } from "@/lib/roas-report";
import {
  isCampaignActive,
  pauseCampaign,
  getAdSetDailyBudgetRupees,
  updateAdSetDailyBudgetRupees,
} from "@/lib/meta-ads";

const PAUSE_IF_SPEND_ABOVE_WITH_NO_CLICKS = 300;
const SCALE_IF_CLICKS_ABOVE = 20;
const BUDGET_INCREASE_FACTOR = 1.2;
const DEFAULT_MAX_BUDGET = 1000;

// Real-ROAS thresholds — only used once at least one order has actually
// been attributed to the campaign; with zero attributed orders, ROAS is
// meaningless (could just be attribution lag) and the agent falls back to
// the click-based heuristic below instead.
const PAUSE_IF_ROAS_BELOW = 1; // losing money outright
const SCALE_IF_ROAS_ABOVE = 2; // a defensible minimum profitable return for D2C apparel

type AgentAction = {
  adBriefId: string;
  action: "paused" | "budget_increased" | "no_action";
  reason: string;
  beforeValue?: string;
  afterValue?: string;
};

async function logAction(action: AgentAction) {
  const supabase = getSupabaseServerClient();
  await supabase.from("agent_actions").insert({
    ad_brief_id: action.adBriefId,
    action: action.action,
    reason: action.reason,
    before_value: action.beforeValue ?? null,
    after_value: action.afterValue ?? null,
  });
}

/**
 * Runs one sweep over every launched ad brief and takes bounded, logged
 * actions on ones a human has already turned ACTIVE in Meta Ads Manager.
 *
 * Guardrails, deliberately conservative for a first version:
 * - Never activates a paused campaign — that decision stays human-only.
 * - Only pauses a campaign that's clearly not working (real spend, zero
 *   clicks) — never pauses on a hunch.
 * - Only scales budget up, never down automatically, and only up to
 *   AGENT_MAX_DAILY_BUDGET_RUPEES (or ₹1000/day if that's not set).
 * - Every decision — including "did nothing" — is logged to agent_actions
 *   with a reason, so the full history is auditable from /admin/agent-log.
 *
 * Prefers real ROAS (attributed order revenue / campaign spend) once a
 * campaign has at least one attributed order — that's the trustworthy
 * signal. Before that first order lands, ROAS is meaningless (could just
 * be attribution lag on a brand-new campaign), so it falls back to the
 * cruder click-volume heuristic until real data exists.
 */
export async function runAdAgentSweep() {
  const enabled = await getSetting("AGENT_ENABLED");
  if (enabled !== "true") {
    return { skipped: true as const, actions: [] as AgentAction[] };
  }

  const maxBudgetSetting = await getSetting("AGENT_MAX_DAILY_BUDGET_RUPEES");
  const maxBudget = maxBudgetSetting ? Number(maxBudgetSetting) : DEFAULT_MAX_BUDGET;

  const supabase = getSupabaseServerClient();
  const { data: briefs } = await supabase
    .from("ad_briefs")
    .select("id, meta_campaign_id, meta_adset_id, headline")
    .eq("status", "launched")
    .not("meta_campaign_id", "is", null);

  const actions: AgentAction[] = [];

  for (const brief of briefs ?? []) {
    if (!brief.meta_campaign_id || !brief.meta_adset_id) continue;

    try {
      const active = await isCampaignActive(brief.meta_campaign_id);
      if (!active) {
        const action: AgentAction = {
          adBriefId: brief.id,
          action: "no_action",
          reason: "Campaign is still PAUSED — waiting for a human to activate it.",
        };
        actions.push(action);
        await logAction(action);
        continue;
      }

      const insights = await getCampaignInsights(brief.meta_campaign_id, 3);
      const { revenue, orderCount } = await getAttributedRevenue(brief.id, 3);
      const hasRealRoas = orderCount > 0 && insights.spend > 0;
      const roas = hasRealRoas ? revenue / insights.spend : null;

      if (hasRealRoas && roas !== null && roas < PAUSE_IF_ROAS_BELOW && insights.spend >= PAUSE_IF_SPEND_ABOVE_WITH_NO_CLICKS) {
        await pauseCampaign(brief.meta_campaign_id);
        const action: AgentAction = {
          adBriefId: brief.id,
          action: "paused",
          reason: `ROAS ${roas.toFixed(2)}x over the last 3 days (₹${revenue} from ${orderCount} order${orderCount === 1 ? "" : "s"} on ₹${insights.spend} spend) — losing money.`,
          beforeValue: "ACTIVE",
          afterValue: "PAUSED",
        };
        actions.push(action);
        await logAction(action);
        continue;
      }

      if (!hasRealRoas && insights.spend >= PAUSE_IF_SPEND_ABOVE_WITH_NO_CLICKS && insights.clicks === 0) {
        await pauseCampaign(brief.meta_campaign_id);
        const action: AgentAction = {
          adBriefId: brief.id,
          action: "paused",
          reason: `Spent ₹${insights.spend} over the last 3 days with zero clicks and no attributed orders yet — creative or targeting isn't working.`,
          beforeValue: "ACTIVE",
          afterValue: "PAUSED",
        };
        actions.push(action);
        await logAction(action);
        continue;
      }

      const shouldScale = hasRealRoas ? roas !== null && roas >= SCALE_IF_ROAS_ABOVE : insights.clicks >= SCALE_IF_CLICKS_ABOVE;
      if (shouldScale) {
        const currentBudget = await getAdSetDailyBudgetRupees(brief.meta_adset_id);
        const nextBudget = Math.min(Math.round(currentBudget * BUDGET_INCREASE_FACTOR), maxBudget);

        if (nextBudget > currentBudget) {
          await updateAdSetDailyBudgetRupees(brief.meta_adset_id, nextBudget);
          const reason = hasRealRoas
            ? `ROAS ${roas!.toFixed(2)}x over the last 3 days (₹${revenue} from ${orderCount} order${orderCount === 1 ? "" : "s"}) — scaling budget up (capped at ₹${maxBudget}/day).`
            : `${insights.clicks} clicks over the last 3 days, no attributed orders yet — scaling budget up on click signal alone (capped at ₹${maxBudget}/day).`;
          const action: AgentAction = {
            adBriefId: brief.id,
            action: "budget_increased",
            reason,
            beforeValue: `₹${currentBudget}/day`,
            afterValue: `₹${nextBudget}/day`,
          };
          actions.push(action);
          await logAction(action);
          continue;
        }
      }

      const noAction: AgentAction = {
        adBriefId: brief.id,
        action: "no_action",
        reason: hasRealRoas
          ? `ROAS ${roas!.toFixed(2)}x over the last 3 days (₹${revenue} from ${orderCount} order${orderCount === 1 ? "" : "s"} on ₹${insights.spend} spend) — not enough signal to act yet.`
          : `${insights.clicks} clicks, ₹${insights.spend} spent over the last 3 days, no attributed orders yet — not enough signal to act yet.`,
      };
      actions.push(noAction);
      await logAction(noAction);
    } catch (err) {
      console.error("Ad agent sweep failed for brief", brief.id, err);
    }
  }

  return { skipped: false as const, actions };
}
