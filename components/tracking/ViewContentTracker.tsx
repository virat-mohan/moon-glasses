"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/client-tracking";

export function ViewContentTracker({ chapterSlug, value }: { chapterSlug: string; value: number }) {
  useEffect(() => {
    trackEvent("ViewContent", { chapterSlug, value });
  }, [chapterSlug, value]);

  return null;
}
