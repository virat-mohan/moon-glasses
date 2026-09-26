"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Store, Megaphone, Truck, PenLine, Users, HeartHandshake, Wallet, Boxes,
  Search, ShoppingBag, IndianRupee, MoreHorizontal, ChevronRight, X,
  type LucideIcon,
} from "lucide-react";
import { NAV_SECTIONS, PHONE_TABS, findNav } from "./nav";
import { CommandPalette } from "./CommandPalette";
import { TableCards } from "./TableCards";

const SECTION_ICONS: Record<string, LucideIcon> = {
  Store, Marketing: Megaphone, Logistics: Truck, Content: PenLine,
  Customers: Users, Community: HeartHandshake, Finance: Wallet, "Less Common": Boxes,
};
const TAB_ICONS: Record<string, LucideIcon> = {
  "/admin/orders": ShoppingBag, "/admin/customers": Users, "/admin/logistics": Truck, "/admin/pnl": IndianRupee,
};

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const active = findNav(pathname)?.href;
  return (
    <nav aria-label="Admin">
      {NAV_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.label] ?? Boxes;
        return (
          <div key={section.label} data-tone={section.tone}>
            <p className="adm-group-label flex items-center gap-2">
              <span className="adm-icon-chip" style={{ width: 20, height: 20, borderRadius: 6 }}>
                <Icon size={12} aria-hidden />
              </span>
              {section.label}
            </p>
            <ul>
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={active === link.href ? "page" : undefined}
                    className="adm-navlink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, account }: { children: React.ReactNode; account: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const current = findNav(pathname);
  const section = NAV_SECTIONS.find((s) => s.label === current?.section);
  const deep = current && pathname !== current.href;
  const tail = deep
    ? pathname.slice(current.href.length + 1).split("/").filter(Boolean).map((p) => decodeURIComponent(p).replace(/-/g, " "))
    : [];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="adm flex w-full">
      <aside className="adm-side" aria-label="Admin navigation">
        <Link href="/admin/orders" className="mb-2 flex items-center gap-2 px-3 no-underline">
          <span className="adm-display text-[1.05rem] uppercase text-ink">MOON GLASSES</span>
          <span className="text-micro uppercase tracking-[0.14em] text-secondary-text">Admin</span>
        </Link>
        <button type="button" className="adm-search-btn mx-1 mt-3" onClick={() => setPaletteOpen(true)}>
          <Search size={15} aria-hidden /> <span className="flex-1 text-left">Jump to…</span>
          <span className="adm-kbd">/</span>
        </button>
        <div className="mt-1 flex-1"><NavList pathname={pathname} /></div>
        <div className="px-3 pt-6">{account}</div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="adm-top">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:px-8">
            <div className="min-w-0 flex-1">
              <nav aria-label="Breadcrumb" className="flex min-h-[40px] min-w-0 items-center gap-1.5 text-body-s text-secondary-text">
                <Link href="/admin/orders" className="adm-display shrink-0 text-[0.8rem] text-ink no-underline md:hidden">MOON GLASSES</Link>
                <span className="hidden md:inline">Admin</span>
                {section && (
                  <>
                    <ChevronRight size={13} aria-hidden className="shrink-0 opacity-60" />
                    <span data-tone={section.tone} className="inline-flex items-center gap-1.5 truncate">
                      <span className="adm-dot" aria-hidden />{section.label}
                    </span>
                  </>
                )}
                {current && (
                  <>
                    <ChevronRight size={13} aria-hidden className="shrink-0 opacity-60" />
                    {deep ? (
                      <Link href={current.href} className="truncate text-secondary-text">{current.label}</Link>
                    ) : (
                      <span aria-current="page" className="truncate font-medium text-ink">{current.label}</span>
                    )}
                  </>
                )}
                {deep && tail.length > 0 && (
                  <>
                    <ChevronRight size={13} aria-hidden className="shrink-0 opacity-60" />
                    <span aria-current="page" className="truncate font-medium capitalize text-ink">{tail.join(" / ")}</span>
                  </>
                )}
              </nav>

            </div>
            <button type="button" aria-label="Search admin" className="adm-search-btn" onClick={() => setPaletteOpen(true)}>
              <Search size={16} aria-hidden />
              <span className="hidden sm:inline">Search</span>
              <span className="adm-kbd hidden lg:inline">Ctrl K</span>
            </button>
          </div>
          <div className="adm-band" aria-hidden>
            {["#d9714b", "#3e6fa6", "#e91e8c", "#d4af37", "#9c7a4a"].map((c) => (
              <span key={c} style={{ "--c": c } as React.CSSProperties} />
            ))}
          </div>
        </header>
        <div key={pathname} className="adm-main adm-content adm-page-enter">
          {children}
          <TableCards pathname={pathname} />
        </div>
        <footer className="mx-auto max-w-[1400px] px-4 pb-28 md:px-8 md:pb-10">
          <hr className="adm-rule-gold" />
          <a href="https://viratmohan.com/mission" className="adm-sign mt-5" target="_blank" rel="noopener">
            <strong>Virat Mohan</strong>
            <span aria-hidden>·</span>
            <span>I build the machine that gets good products to the world. →</span>
          </a>
        </footer>
      </div>

      <nav className="adm-tabs" aria-label="Primary">
        {PHONE_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.href] ?? ShoppingBag;
          return (
            <Link key={tab.href} href={tab.href} className="adm-tab" aria-current={current?.href === tab.href ? "page" : undefined}>
              <Icon size={20} aria-hidden />{tab.label}
            </Link>
          );
        })}
        <button type="button" className="adm-tab" onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <MoreHorizontal size={20} aria-hidden />More
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="adm-overlay" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="adm-sheet" role="dialog" aria-modal="true" aria-label="All admin pages">
            <div className="mb-2 flex items-center justify-between">
              <p className="adm-serif text-[1.4rem] text-ink">All pages</p>
              <button type="button" aria-label="Close" onClick={() => setMoreOpen(false)} className="grid h-10 w-10 place-items-center text-secondary-text">
                <X size={20} />
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setMoreOpen(false)} />
            <div className="mt-6 px-3">{account}</div>
          </div>
        </>
      )}

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
