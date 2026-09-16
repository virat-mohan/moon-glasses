"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function diffParts(targetMs: number) {
  const remaining = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    d: Math.floor(totalSeconds / 86400),
    h: Math.floor((totalSeconds % 86400) / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
    done: remaining <= 0,
  };
}

/**
 * Thin black bar pinned above the header, visible on every page while
 * scrolling — the "announcement bar" slot from the design spec, carrying
 * the live drop countdown instead of a static message.
 */
export function StickyCountdownBar({ targetIso }: { targetIso: string }) {
  const targetMs = new Date(targetIso).getTime();
  const [parts, setParts] = useState(() => diffParts(targetMs));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (parts.done) return null;

  return (
    <div className="flex h-9 items-center justify-center gap-2 bg-[var(--moon-gold)] px-4 text-center font-sans text-micro uppercase tracking-[0.1em] text-black">
      <span suppressHydrationWarning>
        Drops in {parts.d}d {String(parts.h).padStart(2, "0")}h {String(parts.m).padStart(2, "0")}m{" "}
        {String(parts.s).padStart(2, "0")}s
      </span>
      <Link href="/preorder" className="ml-2 underline underline-offset-2">
        Reserve Now
      </Link>
    </div>
  );
}
