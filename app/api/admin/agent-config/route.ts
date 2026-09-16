import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET() {
  const [enabled, maxBudget] = await Promise.all([
    getSetting("AGENT_ENABLED"),
    getSetting("AGENT_MAX_DAILY_BUDGET_RUPEES"),
  ]);
  return NextResponse.json({
    enabled: enabled === "true",
    maxBudget: maxBudget ? Number(maxBudget) : 1000,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  try {
    if (body.enabled != null) await setSetting("AGENT_ENABLED", body.enabled ? "true" : "false");
    if (body.maxBudget != null) await setSetting("AGENT_MAX_DAILY_BUDGET_RUPEES", String(body.maxBudget));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save agent config", err);
    return NextResponse.json({ error: "Could not save agent config" }, { status: 500 });
  }
}
