/**
 * The customer site's navigation model (Task C4). The dock, the More sheet
 * and the desktop nav all render from these lists, so every href lives here
 * and nowhere else: when a Phase D task rebuilds a route it flips the href in
 * this one file.
 *
 * Hrefs are locale-free ("/menu"); `localizedHref` adds the locale segment.
 * Labels come from `site.nav.<key>` in messages/*.json.
 */
import type { IconName } from "@/components/site/icons/paths";

export const SITE_NAV_KEYS = [
  "order",
  "menu",
  "rewards",
  "chappy",
  "locations",
  "experience",
  "store",
  "giftCards",
  "contact",
  "account",
] as const;

export type NavKey = (typeof SITE_NAV_KEYS)[number];

export interface NavLink {
  key: NavKey;
  href: string;
  icon: IconName;
  /** The one filled call to action (ember-deep with cream text). */
  primary?: boolean;
}

export interface NavAction {
  key: NavKey;
  action: "openChappy";
  icon: IconName;
}

export type NavItem = NavLink | NavAction;

export function isNavLink(item: NavItem): item is NavLink {
  return "href" in item;
}

/** The phone dock: four thumb-reach actions. */
export const DOCK_ITEMS: readonly NavItem[] = [
  { key: "order", href: "/order", icon: "bowl", primary: true },
  { key: "menu", href: "/menu", icon: "chopsticks" },
  // TODO(D7): /rewards replaces the legacy loyalty page.
  { key: "rewards", href: "/loyalty", icon: "seal" },
  { key: "chappy", action: "openChappy", icon: "chat" },
];

/** Everything else: the More sheet on phones, inline in the desktop nav. */
export const MORE_ITEMS: readonly NavLink[] = [
  { key: "locations", href: "/locations", icon: "pin" },
  // TODO(D2): /experience is built in D2; until then this link 404s.
  { key: "experience", href: "/experience", icon: "pod" },
  { key: "store", href: "/store", icon: "store" },
  { key: "giftCards", href: "/gift-cards", icon: "gift" },
  { key: "contact", href: "/contact", icon: "mail" },
];

/** Signed-in members go here; signed-out visitors get the Clerk sign-in modal instead. */
export const ACCOUNT_ITEM: NavLink = { key: "account", href: "/member", icon: "user" };

export function localizedHref(locale: string, href: string): string {
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

/** Strip a leading locale segment ("/zh-TW/menu" -> "/menu"). Any first segment shaped like a locale counts. */
function withoutLocale(pathname: string): string {
  const rest = pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/|$)/, "");
  return rest === "" ? "/" : rest;
}

/** True when `pathname` is the item's route or one of its subpaths. Used for aria-current. */
export function isNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const path = withoutLocale(pathname);
  return path === href || path.startsWith(`${href}/`);
}
