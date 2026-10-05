import {
  buildDashboardSections,
  type DashboardSection,
  type DashboardSectionView,
} from "@retail-os/brand-config/dashboard-sections";
import { resolveModuleStatus, type SetupProbe } from "@retail-os/brand-config/module-status";
import { moonConfig } from "@/lib/brand-config";

export type NavLink = { href: string; label: string };
export type Accent = "terracotta" | "cobalt" | "magenta" | "gold" | "bronze";
export type NavSection = {
  label: string;
  accent: Accent;
  tone: Accent;
  links: NavLink[];
  canonicalSection: string;
};

// Compatibility re-exports for existing consumers.
export type AdminNavLink = NavLink;
export type AdminTone = Accent;
export type AdminNavSection = NavSection;

const SECTION_ACCENTS: Record<DashboardSection, Accent> = {
  command_centre: "gold",
  brand: "bronze",
  catalogue: "terracotta",
  commerce: "terracotta",
  growth: "cobalt",
  inventory_master: "bronze",
  finance: "gold",
  operations: "magenta",
  team_partners: "bronze",
  reports: "cobalt",
  settings: "bronze",
};

const SECTION_LINKS: Record<DashboardSection, NavLink[]> = {
  command_centre: [],
  brand: [
    { href: "/admin/brand-profile", label: "Brand Profile" },
  ],
  catalogue: [
    { href: "/admin/edit-chapter", label: "Edit Products" },
    { href: "/admin/add-chapter", label: "Add Product" },
    { href: "/admin/product-images", label: "Product Images" },
    { href: "/admin/models", label: "Models" },
    { href: "/admin/marketing-assets", label: "Marketing Assets" },
  ],
  commerce: [
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/orders/new", label: "Add Manual Order" },
    { href: "/admin/payment-confirmations", label: "WhatsApp Payment Confirmations" },
    { href: "/admin/preorders", label: "Pre-Orders (Drop)" },
    { href: "/admin/post-barter", label: "Pay With A Post" },
    { href: "/admin/discounts", label: "Discount Rules" },
    { href: "/admin/coupons", label: "Coupon Codes" },
  ],
  growth: [
    { href: "/admin/social", label: "Social (Instagram)" },
    { href: "/admin/tagged-posts", label: "Tagged Posts (Grid)" },
    { href: "/admin/analytics", label: "Website Analytics" },
    { href: "/admin/ad-briefs", label: "Ad Brief Generator" },
    { href: "/admin/content-calendar", label: "Content Calendar" },
    { href: "/admin/reports", label: "Growth Reports" },
    { href: "/admin/abandoned-carts", label: "Abandoned Carts" },
    { href: "/admin/agent-log", label: "Ad Agent" },
    { href: "/admin/journal-drafts", label: "Journal Draft Generator" },
    { href: "/admin/newsletter", label: "Newsletter" },
    { href: "/admin/whatsapp", label: "WhatsApp Inbox" },
    { href: "/admin/customers", label: "Customers & Good Vibes" },
    { href: "/admin/leads", label: "Leads" },
    { href: "/admin/creators", label: "Creators" },
    { href: "/admin/explorer-submissions", label: "Explorer Submissions" },
    { href: "/admin/reviews", label: "Reviews" },
  ],
  inventory_master: [
    { href: "/admin/inventory", label: "Inventory" },
    { href: "/admin/master-inventory", label: "Inventory Master" },
  ],
  finance: [
    { href: "/admin/pnl", label: "P&L" },
    { href: "/admin/business-plan", label: "Business Plan (Forecast)" },
    { href: "/admin/expenses", label: "Expenses" },
  ],
  operations: [
    { href: "/admin/logistics", label: "Shipments & RTO" },
    { href: "/admin/returns", label: "Return Requests" },
  ],
  team_partners: [
    { href: "/admin/team", label: "Team Access" },
  ],
  reports: [],
  settings: [
    { href: "/admin/settings", label: "API Keys & Settings" },
  ],
};

const noopProbe: SetupProbe = { hasSetting: () => true };

function resolveNavSections(): NavSection[] {
  const statuses = resolveModuleStatus(moonConfig, noopProbe);
  const sections = buildDashboardSections(moonConfig, statuses);

  return sections
    .filter((s: DashboardSectionView) => {
      const links = SECTION_LINKS[s.section] ?? [];
      return s.visible || links.length > 0;
    })
    .map((s: DashboardSectionView) => ({
      label: s.label,
      accent: SECTION_ACCENTS[s.section],
      tone: SECTION_ACCENTS[s.section],
      links: SECTION_LINKS[s.section] ?? [],
      canonicalSection: s.section,
    }));
}

export const NAV_SECTIONS: NavSection[] = resolveNavSections();

export const TAB_LINKS: NavLink[] = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/logistics", label: "Shipping" },
  { href: "/admin/pnl", label: "Money" },
];

export const ALL_LINKS = NAV_SECTIONS.flatMap((s) =>
  s.links.map((l) => ({ ...l, section: s.label }))
);

export const PHONE_TABS = TAB_LINKS;

export function findCurrent(pathname: string) {
  let best: { section: NavSection; link: NavLink } | null = null;
  for (const section of NAV_SECTIONS) {
    for (const link of section.links) {
      if (pathname === link.href || pathname.startsWith(link.href + "/")) {
        if (!best || link.href.length > best.link.href.length) best = { section, link };
      }
    }
  }
  return best;
}

export function findNav(pathname: string) {
  let best: (typeof ALL_LINKS)[number] | undefined;
  for (const l of ALL_LINKS) {
    if (pathname === l.href || pathname.startsWith(l.href + "/")) {
      if (!best || l.href.length > best.href.length) best = l;
    }
  }
  return best;
}
