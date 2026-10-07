"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Shown while a post is still being made: refreshes the page by itself every 2 seconds, a handful of times. */
export function AutoRefresh({ message }: { message: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= 8) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 2000);
    return () => clearTimeout(t);
  }, [tries, router]);

  return (
    <p className="mt-5 text-body-s text-secondary-text" aria-live="polite">
      {tries >= 8 ? "this is taking longer than usual. refresh the page, or tap the help link below." : message}
    </p>
  );
}
