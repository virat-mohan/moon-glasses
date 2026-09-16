"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Next.js's own scroll-to-top-on-navigate doesn't always win against the
 * browser's own scroll-restoration (especially returning to a route visited
 * before) — this forces every real route change back to the top. Doesn't
 * fire on hash-only navigation (pathname doesn't change), so anchor links
 * like /travel-inspiration#pick-your-world still scroll to their target
 * instead of being yanked back to 0.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
