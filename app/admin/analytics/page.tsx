"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalyticsView, type AnalyticsData } from "@/components/admin/analytics/AnalyticsView";
import { presetRange, type RangePreset } from "@/lib/analytics-helpers";

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function WebsiteAnalyticsPage() {
  const today = todayStr();
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [range, setRange] = useState(() => presetRange("7d", today));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/admin/website-analytics?from=${range.from}&to=${range.to}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || body.error) throw new Error(body?.error ?? "The server did not answer.");
        if (!cancelled) setData(body as AnalyticsData);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Something went wrong."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, attempt]);

  return (
    <AnalyticsView
      data={data}
      loading={loading}
      error={error}
      onRetry={retry}
      preset={preset}
      from={range.from}
      to={range.to}
      today={today}
      onPreset={(p) => {
        setPreset(p);
        setRange(presetRange(p, today));
      }}
      onCustom={(from, to) => {
        setPreset("custom");
        setRange({ from, to });
      }}
    />
  );
}
