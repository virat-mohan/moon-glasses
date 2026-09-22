"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Next.js's own scroll-to-top-on-navigate doesn't always win against the
 * browser's own scroll-restoration (especially returning to a route visited
 * before) — this forces every real route change back to the top. Doesn't
 * fire on hash-only navigation on the SAME page (pathname doesn't change),
 * so anchor links like /travel-inspiration#pick-your-world still scroll to
 * their target instead of being yanked back to 0.
 *
 * A link from a DIFFERENT page straight to an anchor (e.g. checkout's
 * PayWithAPostMark linking to "/#pay-with-a-post") DOES change the
 * pathname, so this effect used to fire anyway and immediately override
 * Next's own hash-scroll with scrollTo(0, 0) — the exact bug reported: the
 * link always landed at the top of the homepage, never at the anchor.
 * Checking window.location.hash before forcing the reset fixes both cases
 * with the same guard.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.hash) return; // let the browser/Next scroll to the anchor instead
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
