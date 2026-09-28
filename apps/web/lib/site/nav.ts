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
import type { Tier } from "@/components/site/tiers/tier-paths";
import { locales } from "@/i18n/config";

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

/**
 * What a dock item shows above its label: an in-house brush icon, the
 * owner's traced tier mark (Rewards), or an image (Chappy's own face).
 * C4 fix round 1: brand marks over generic glyphs where one exists.
 */
export type NavGlyph = { icon: IconName } | { tier: Tier } | { avatar: string };

export type NavLink = {
  key: NavKey;
  href: string;
  /** The one filled call to action (ember-deep with cream text). */
  primary?: boolean;
} & NavGlyph;

export type NavAction = {
  key: NavKey;
  action: "openChappy";
} & NavGlyph;

export type NavItem = NavLink | NavAction;

/** A link drawn with an in-house icon (the More list, the account row). */
export type NavIconLink = NavLink & { icon: IconName };

export function isNavLink(item: NavItem): item is NavLink {
  return "href" in item;
}

/** Chappy's face, cropped round in the dock (96px source covers 24px at 3x and 32px at 2x). */
export const CHAPPY_AVATAR = "/plan/chappy-96.webp";

/** The phone dock: four thumb-reach actions. */
export const DOCK_ITEMS: readonly NavItem[] = [
  { key: "order", href: "/order", icon: "bowl", primary: true },
  { key: "menu", href: "/menu", icon: "chopsticks" },
  { key: "rewards", href: "/rewards", icon: "seal" },
  { key: "chappy", action: "openChappy", avatar: CHAPPY_AVATAR },
];

/** Everything else: the More sheet on phones, inline in the desktop nav. */
export const MORE_ITEMS: readonly NavIconLink[] = [
  { key: "locations", href: "/locations", icon: "pin" },
  { key: "experience", href: "/experience", icon: "pod" },
  { key: "store", href: "/store", icon: "store" },
  { key: "giftCards", href: "/gift-cards", icon: "gift" },
  { key: "contact", href: "/contact", icon: "mail" },
];

/** Signed-in members go here; signed-out visitors get the Clerk sign-in modal instead. */
export const ACCOUNT_ITEM: NavIconLink = { key: "account", href: "/member", icon: "user" };

export function localizedHref(locale: string, href: string): string {
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

/** Strip a leading locale segment ("/zh-TW/menu" -> "/menu"). Only the real locales count. */
function withoutLocale(pathname: string): string {
  const segments = pathname.split("/");
  if ((locales as readonly string[]).includes(segments[1] ?? "")) segments.splice(1, 1);
  const rest = segments.join("/");
  return rest === "" ? "/" : rest;
}

/** True when `pathname` is the item's route or one of its subpaths. Used for aria-current. */
export function isNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const path = withoutLocale(pathname);
  return path === href || path.startsWith(`${href}/`);
}
