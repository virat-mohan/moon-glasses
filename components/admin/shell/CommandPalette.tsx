"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { ALL_LINKS, NAV_SECTIONS } from "./nav";

type Customer = { name?: string; phone?: string; email?: string };
type Item = { key: string; label: string; meta: string; href: string; tone?: string };

const TONES = Object.fromEntries(NAV_SECTIONS.map((s) => [s.label, s.tone]));

/**
 * Jump to any admin page, plus customer lookup using the existing
 * admin-gated /api/admin/customers endpoint (fetched once, on first search).
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const restoreRef = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  // Return focus to wherever the palette was opened from.
  useEffect(() => {
    const el = restoreRef.current;
    return () => el?.focus?.();
  }, []);

  const q = query.trim().toLowerCase();

  function loadCustomersOnce(next: string) {
    if (next.trim().length < 2 || customers || loadingCustomers) return;
    setLoadingCustomers(true);
    fetch("/api/admin/customers")
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((d) => setCustomers(Array.isArray(d?.customers) ? d.customers : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }

  const items = useMemo<Item[]>(() => {
    const pages = ALL_LINKS.filter((l) => !q || `${l.label} ${l.section}`.toLowerCase().includes(q)).map((l) => ({
      key: l.href, label: l.label, meta: l.section, href: l.href, tone: TONES[l.section],
    }));
    const digits = q.replace(/\D/g, "");
    const people =
      q.length >= 2 && customers
        ? customers
            .filter((c) =>
              (c.name ?? "").toLowerCase().includes(q) ||
              (c.email ?? "").toLowerCase().includes(q) ||
              (digits.length >= 3 && (c.phone ?? "").includes(digits)))
            .slice(0, 6)
            .map((c, i) => ({
              key: `c-${c.phone ?? i}`, label: c.name || c.phone || "Customer",
              meta: ["Customer", c.phone].filter(Boolean).join(" · "), href: "/admin/customers", tone: "terracotta",
            }))
        : [];
    return [...pages, ...people];
  }, [q, customers]);

  function go(item?: Item) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[index]); }
  }

  return (
    <>
      <div className="adm-overlay" onClick={onClose} aria-hidden />
      <div className="adm-dialog" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-divider px-4">
          <Search size={17} aria-hidden className="text-secondary-text" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); loadCustomersOnce(e.target.value); }}
            placeholder="Jump to a page or find a customer…"
            aria-label="Search admin"
            role="combobox"
            aria-expanded="true"
            aria-controls="adm-palette-list"
            aria-activedescendant={items[index] ? `adm-opt-${index}` : undefined}
            className="min-h-[52px] flex-1 bg-transparent text-body text-ink outline-none"
          />
          <span className="adm-kbd">Esc</span>
        </div>
        <ul id="adm-palette-list" role="listbox" className="overflow-y-auto p-2">
          {items.map((item, i) => (
            <li key={item.key}>
              <button
                id={`adm-opt-${i}`}
                type="button"
                role="option"
                aria-selected={i === index}
                className="adm-option"
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item)}
              >
                <span className="flex min-w-0 items-center gap-2.5" data-tone={item.tone}>
                  <span className="adm-dot" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-caption text-secondary-text">
                  {item.meta}
                  {i === index && <CornerDownLeft size={13} aria-hidden />}
                </span>
              </button>
            </li>
          ))}
          {loadingCustomers && <li className="px-4 py-3 text-caption text-secondary-text">Looking up customers…</li>}
          {items.length === 0 && !loadingCustomers && (
            <li className="px-4 py-8 text-center text-body-s text-secondary-text">
              Nothing matches “{query}”. Try a page name, a customer name or the last digits of a phone number.
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
