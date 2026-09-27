import { canAccess, type AdminRole } from "./access";
import type { IconName } from "../components/ui/icons";

export type NavItem = { href: string; label: string; icon: IconName };

/** Flip to true in the branch that lands second once app/(console)/support exists (spec A7). */
export const HAS_SUPPORT = false;

export const DOCK_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/orders", label: "Orders", icon: "receipt" },
  { href: "/menu", label: "Menu", icon: "bowl" },
];

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Sell", items: [
    { href: "/promos", label: "Promos", icon: "tag" },
    { href: "/gift-cards", label: "Gift cards", icon: "gift" },
    { href: "/products", label: "Shop products", icon: "bag" },
    { href: "/catering", label: "Catering", icon: "calendar" },
  ] },
  { title: "Stores", items: [
    { href: "/kitchen", label: "Kitchen display", icon: "flame" },
    { href: "/cleaning", label: "Cleaning display", icon: "sparkle" },
    { href: "/cleaning/config", label: "Seats", icon: "seat" },
  ] },
  { title: "Insights", items: [{ href: "/analytics", label: "Analytics", icon: "chart" }] },
  { title: "Owner", items: [
    { href: "/plan-access", label: "Plan access", icon: "key" },
    { href: "/locations", label: "Locations", icon: "pin" },
    { href: "/kiosks", label: "Kiosks", icon: "tablet" },
    { href: "/gift-cards/config", label: "Gift card setup", icon: "settings" },
    { href: "/team", label: "Team", icon: "users" },
  ] },
];

export function navFor(role: AdminRole) {
  const allowed = (i: NavItem) => canAccess(role, i.href);
  return {
    dock: DOCK_ITEMS.filter(allowed),
    groups: NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length > 0),
  };
}

/** Pages reached through another section's tabs: Shop orders is the Shop tab of Orders. */
const SECTION_ALIASES: Record<string, string> = { "/shop-orders": "/orders" };

export function activeHref(rawPathname: string, hrefs: string[]): string | null {
  const alias = Object.keys(SECTION_ALIASES).find((a) => rawPathname === a || rawPathname.startsWith(a + "/"));
  const pathname = alias ? SECTION_ALIASES[alias] : rawPathname;
  const hits = hrefs.filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")));
  return hits.sort((a, b) => b.length - a.length)[0] ?? null;
}
