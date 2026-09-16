"use client";

import { useEffect, useState } from "react";

function diffParts(targetMs: number) {
  const remaining = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: remaining <= 0,
  };
}

/** Plain, minimal ticking countdown — matches the monochrome UI, no glow/gradient. */
export function CountdownTimer({ targetIso, label }: { targetIso: string; label?: string }) {
  const targetMs = new Date(targetIso).getTime();
  const [parts, setParts] = useState(() => diffParts(targetMs));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (parts.done) {
    return <p className="font-sans text-body-s uppercase tracking-[0.1em] text-white">We&rsquo;re Live</p>;
  }

  const cells = [
    { value: parts.days, unit: "Days" },
    { value: parts.hours, unit: "Hrs" },
    { value: parts.minutes, unit: "Min" },
    { value: parts.seconds, unit: "Sec" },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <p className="font-sans text-micro uppercase tracking-[0.3em] text-secondary-text">{label}</p>}
      <div className="flex gap-4">
        {cells.map((c) => (
          <div key={c.unit} className="flex w-14 flex-col items-center border border-white/25 py-3">
            <span className="font-sans text-heading-m text-white tabular-nums" suppressHydrationWarning>
              {String(c.value).padStart(2, "0")}
            </span>
            <span className="mt-1 font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
              {c.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
