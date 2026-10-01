/**
 * Which message namespaces reach the browser (Task G2a; per route since G2b).
 *
 * NextIntlClientProvider serializes every message it is given into the page
 * (the RSC payload inlined in the HTML). The whole catalog is about 260 KB of
 * JSON in English, so no page gets it:
 *
 * - The (site) layout (ScopedIntl scope="site") provides SITE_BASE_NAMESPACES:
 *   what the shell and the Chappy widget read on every page.
 * - Each top-level (site) route adds its own set: its segment layout renders
 *   <RouteIntl route="…">, which provides the base plus ROUTE_NAMESPACES[route]
 *   to that route's pages. (A nested provider replaces the messages it
 *   inherits, hence base plus route.) The home page wraps itself, since it
 *   has no segment of its own.
 * - Legacy pages (and kiosk, CNY, agents) get everything except
 *   SERVER_ONLY_NAMESPACES. The plan keeps its full catalog.
 *
 * `client-messages.test.ts` walks the import graph of the (site) layout and
 * of each route, including lazy chunks, and fails if a client component uses
 * a namespace its provider doesn't carry: production would render "" for it.
 *
 * Server components are unaffected: getTranslations reads the full catalog.
 */

type Messages = Record<string, unknown>;

/** The shell (top bar, dock, More sheet, footer, active-order pill) and the Chappy widget. */
export const SITE_BASE_NAMESPACES = ["site", "siteImages", "chappyWeb"] as const;

/** Per top-level (site) route segment ("home" is the / page). The guard test keeps these honest. */
export const ROUTE_NAMESPACES = {
  "accessibility": [],
  "challenges": ["challengesPage", "giveMeal", "orderFlow"],
  "contact": ["contactPage"],
  // Private events (/e/[slug]): the invite, RSVP, bowl builder, done and status pages.
  "e": ["events", "orderFlow", "afterOrder", "orderStatus"],
  "experience": [],
  "giving": [],
  "gift-cards": ["giftCards", "store"],
  "group": ["groupLobby", "combMap"],
  "locations": [],
  "member": ["loyalty", "passport"],
  "menu": ["menuPage"],
  // "store": the "Payment received" copy (store.checkout.received, store.errors.NEEDS_REVIEW) PayStep and GroupPayForm reuse (final review C1/I1).
  "order": ["orderFlow", "afterOrder", "orderStatus", "groupLobby", "groupOrder", "mealGiftSheet", "phoneCollection", "combMap", "store"],
  "pod": ["afterOrder", "orderFlow", "podCode", "combMap"],
  "privacy": [],
  "referral": ["referralPage"],
  "rewards": ["rewards", "loyalty"],
  "sms-consent": [],
  "store": ["store", "giftCards"],
  "home": ["home"],
} as const satisfies Record<string, readonly string[]>;

export type SiteRoute = keyof typeof ROUTE_NAMESPACES;

export function routeNamespaces(route: SiteRoute): readonly string[] {
  return [...SITE_BASE_NAMESPACES, ...(ROUTE_NAMESPACES[route] as readonly string[])];
}

/** Never needed by a client component outside the plan. */
export const SERVER_ONLY_NAMESPACES = ["plan"] as const;

export function pickNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const out: Messages = {};
  for (const ns of namespaces) if (ns in messages) out[ns] = messages[ns];
  return out;
}

export function omitNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const out: Messages = { ...messages };
  for (const ns of namespaces) delete out[ns];
  return out;
}
