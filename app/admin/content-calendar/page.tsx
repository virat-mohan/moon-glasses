"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { chapters } from "@/lib/chapters";

type Brief = {
  id: string;
  chapter_slug: string | null;
  headline: string;
  posted_at: string | null;
  launched_at: string | null;
  scheduled_for: string | null;
  scheduled_action: "post" | "launch" | null;
  queue_status: "none" | "queued" | "published" | "failed";
};

type CalEvent = {
  briefId: string;
  headline: string;
  chapterName: string;
  kind: "queued-post" | "queued-launch" | "posted" | "launched" | "failed";
  dateKey: string;
};

function dateKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const KIND_STYLE: Record<CalEvent["kind"], string> = {
  "queued-post": "border-divider text-secondary-text",
  "queued-launch": "border-tan-gold text-tan-gold",
  posted: "border-ink text-ink",
  launched: "border-tan-gold bg-tan-gold text-cream",
  failed: "border-paint-orange text-paint-orange",
};

const KIND_LABEL: Record<CalEvent["kind"], string> = {
  "queued-post": "Queued · Post",
  "queued-launch": "Queued · Launch",
  posted: "Posted",
  launched: "Launched",
  failed: "Queue Failed",
};

export default function ContentCalendarPage() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    fetch("/api/admin/ad-briefs")
      .then((res) => res.json())
      .then((data) => setBriefs(data.briefs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    const push = (ev: CalEvent) => {
      const list = map.get(ev.dateKey) ?? [];
      list.push(ev);
      map.set(ev.dateKey, list);
    };
    for (const b of briefs) {
      const chapterName = b.chapter_slug ? (chapters.find((c) => c.slug === b.chapter_slug)?.name ?? b.chapter_slug) : "Generic — Brand";
      if (b.queue_status === "queued" && b.scheduled_for) {
        push({
          briefId: b.id,
          headline: b.headline,
          chapterName,
          kind: b.scheduled_action === "launch" ? "queued-launch" : "queued-post",
          dateKey: dateKey(b.scheduled_for),
        });
      }
      if (b.queue_status === "failed" && b.scheduled_for) {
        push({ briefId: b.id, headline: b.headline, chapterName, kind: "failed", dateKey: dateKey(b.scheduled_for) });
      }
      if (b.posted_at) {
        push({ briefId: b.id, headline: b.headline, chapterName, kind: "posted", dateKey: dateKey(b.posted_at) });
      }
      if (b.launched_at) {
        push({ briefId: b.id, headline: b.headline, chapterName, kind: "launched", dateKey: dateKey(b.launched_at) });
      }
    }
    return map;
  }, [briefs]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date().toISOString());

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Content Calendar</h1>
        <Link href="/admin/ad-briefs" className="text-caption text-secondary-text underline">
          Go to Ad Brief Generator
        </Link>
      </div>
      <p className="mt-2 max-w-xl text-body-s text-secondary-text">
        Queued items post/launch automatically via the publish-queue cron. Posted/launched items
        show on the day they actually went out.
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-divider pt-4">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
        >
          ← Prev
        </button>
        <p className="font-display text-heading-s uppercase text-ink">
          {cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </p>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="border border-divider px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
        >
          Next →
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <div className="mt-4 grid grid-cols-7 gap-px border border-divider bg-divider">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-surface-alt px-2 py-1.5 text-center text-micro uppercase tracking-[0.05em] text-secondary-text">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day == null) return <div key={i} className="min-h-[110px] bg-surface" />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const events = eventsByDay.get(key) ?? [];
            return (
              <div key={i} className={`min-h-[110px] bg-surface p-1.5 ${key === todayKey ? "ring-1 ring-inset ring-ink" : ""}`}>
                <p className="mb-1 text-micro text-secondary-text">{day}</p>
                <div className="space-y-1">
                  {events.map((ev, j) => (
                    <div key={j} className={`border px-1.5 py-1 text-micro leading-tight ${KIND_STYLE[ev.kind]}`}>
                      <p className="font-bold uppercase tracking-[0.03em]">{KIND_LABEL[ev.kind]}</p>
                      <p className="truncate">{ev.headline}</p>
                      <p className="truncate opacity-70">{ev.chapterName}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
