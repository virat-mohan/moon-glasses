"use client";

import { useEffect } from "react";

/**
 * Presentation-only enhancer: copies each table's <th> text onto its cells as
 * data-label so admin.css can stack rows into cards on phones. Tables without
 * a header row are left alone. Re-runs when rows change (client-side lists).
 */
function label(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const heads = Array.from(table.querySelectorAll("thead tr:last-child th")).map((th) => th.textContent?.trim() ?? "");
    if (!heads.length) return;
    table.setAttribute("data-cards", "");
    table.querySelectorAll("tbody tr").forEach((tr) => {
      let col = 0;
      Array.from(tr.children).forEach((cell) => {
        if (cell.getAttribute("data-label") !== (heads[col] ?? "")) cell.setAttribute("data-label", heads[col] ?? "");
        col += Number((cell as HTMLTableCellElement).colSpan || 1);
      });
    });
  });
}

export function TableCards({ pathname }: { pathname: string }) {
  useEffect(() => {
    const main = document.querySelector(".adm-content");
    if (!main) return;
    label(main);
    let queued = false;
    const obs = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; label(main); });
    });
    obs.observe(main, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [pathname]);
  return null;
}
