// Thin compatibility re-export.
// The canonical dashboard navigation authority is @retail-os/brand-config,
// consumed via lib/dashboard-nav.ts. This file exists only so any stale
// imports from "@/components/admin/shell/nav" keep working.

export {
  NAV_SECTIONS,
  TAB_LINKS,
  PHONE_TABS,
  ALL_LINKS,
  findCurrent,
  findNav,
  type NavLink,
  type Accent,
  type NavSection,
  type AdminNavLink,
  type AdminTone,
  type AdminNavSection,
} from "@/lib/dashboard-nav";
