"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Scrolls to the #section in the URL, retrying briefly because the target may not have rendered yet. */
function scrollToHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
    else if (tries++ < 20) setTimeout(attempt, 100);
  };
  attempt();
}

/**
 * Every route change and refresh starts at the top (the browser's own scroll
 * restoration is switched off), except when the URL points at a section like
 * "/#shop": then it lands on that section. Next's built-in hash scroll fires
 * before a long page has rendered, so it's done here with a short retry.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    // Clicking a "#section" link whose hash is already in the URL changes nothing, so nothing else scrolls.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (!link) return;
      const target = new URL(link.href, window.location.href);
      if (target.pathname === window.location.pathname && target.hash === window.location.hash) {
        setTimeout(scrollToHash, 0);
      }
    };
    window.addEventListener("hashchange", scrollToHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", scrollToHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    if (window.location.hash) scrollToHash();
    else window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
