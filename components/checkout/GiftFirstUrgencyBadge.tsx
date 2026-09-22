"use client";

import { useEffect, useState } from "react";

/**
 * "Only N Gift First spots left today" urgency indicator — reads the same
 * admin-set daily cap (POST_BARTER_GIFT_FIRST_DAILY_CAP in /admin/settings)
 * the server actually enforces in lib/post-barter.ts's
 * classifyPostBarterApplicant, via the public gift-first-availability
 * endpoint, so this can never overpromise a spot that isn't really there.
 * Renders nothing while loading or once the cap resets to comfortably full,
 * since urgency copy only means something close to the limit.
 */
export function GiftFirstUrgencyBadge({ className = "" }: { className?: string }) {
  const [state, setState] = useState<{ cap: number; remaining: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout/post-barter/gift-first-availability")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || state.cap <= 0) return null;

  // Only worth showing as urgency once it's actually running low — a full
  // "10 of 10 left" badge doesn't create urgency, it just adds noise.
  const showThreshold = Math.max(3, Math.ceil(state.cap * 0.3));
  if (state.remaining > showThreshold) return null;

  if (state.remaining === 0) {
    return (
      <p className={`font-sans text-caption font-bold uppercase tracking-[0.05em] text-secondary-text ${className}`}>
        Gift First is full for today — Post First is still open
      </p>
    );
  }

  return (
    <p className={`font-sans text-caption font-bold uppercase tracking-[0.05em] text-tan-gold ${className}`}>
      Only {state.remaining} Gift First spot{state.remaining === 1 ? "" : "s"} left today — Pay With A Post now
    </p>
  );
}
