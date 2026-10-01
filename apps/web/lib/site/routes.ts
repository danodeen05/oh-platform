/**
 * Every customer route, with sample params (Task C5; F1 made the group code
 * and store order number look like real ones, since the pages echo them and
 * the crawl would otherwise flag its own "SAMPLE"). The English-leak crawl
 * (tests/e2e/site/english-leak.spec.ts) walks this list; the locale-parity
 * test checks it against the files under app/[locale]. Phase D tasks keep it
 * current: when a route moves from `(legacy)` to `(site)`, flip its `group`.
 *
 * Paths are locale-free. `:param` segments are filled from `params`; a value
 * of `SAMPLE_LOCATION_ID` is resolved at crawl time from the API's first
 * location. Excluded from this list on purpose: /plan (its own gate and
 * copy), kiosk, CNY, agents, and the dev-only (site)/lab routes.
 */

export type RouteGroup = "legacy" | "site";

export interface SiteRoute {
  /** Locale-free path, e.g. "/order/status". */
  path: string;
  group: RouteGroup;
  /** The page file under app/[locale], for the parity check and reports. */
  file: string;
  /** Values for `:param` segments in `path`. */
  params?: Record<string, string>;
  /** Query string to append (without "?"). */
  query?: string;
  /** Needs a signed-in member; a signed-out crawl lands on the Clerk sign-in page. */
  auth?: boolean;
  /** Not customer copy (a dev/debug page): kept for completeness, skipped by the crawl. */
  internal?: boolean;
}

export const SAMPLE_LOCATION_ID = "SAMPLE_LOCATION_ID";

const L = "(legacy)";

export const SITE_ROUTES: readonly SiteRoute[] = [
  { path: "/", group: "site", file: "(site)/page.tsx" },
  { path: "/menu", group: "site", file: "(site)/menu/page.tsx" },
  { path: "/locations", group: "site", file: "(site)/locations/page.tsx" },
  { path: "/locations/:slug", group: "site", file: "(site)/locations/[slug]/page.tsx", params: { slug: "city-creek" } },
  { path: "/rewards", group: "site", file: "(site)/rewards/page.tsx" },
  { path: "/experience", group: "site", file: "(site)/experience/page.tsx" },
  { path: "/giving", group: "site", file: "(site)/giving/page.tsx" },
  { path: "/referral", group: "site", file: "(site)/referral/page.tsx", auth: true },
  { path: "/member", group: "site", file: "(site)/member/page.tsx", auth: true },
  { path: "/member/orders", group: "site", file: "(site)/member/orders/page.tsx", auth: true },
  { path: "/member/credits", group: "site", file: "(site)/member/credits/page.tsx", auth: true },
  { path: "/order", group: "site", file: "(site)/order/page.tsx" },
  {
    path: "/order/location/:locationId",
    group: "site",
    file: "(site)/order/location/[locationId]/page.tsx",
    params: { locationId: SAMPLE_LOCATION_ID },
  },
  { path: "/order/payment", group: "site", file: "(site)/order/payment/page.tsx" },
  { path: "/order/group-payment", group: "site", file: "(site)/order/group-payment/page.tsx", query: "groupCode=7K2M9Q" },
  { path: "/order/confirmation", group: "site", file: "(site)/order/confirmation/page.tsx" },
  { path: "/order/scan", group: "site", file: "(site)/order/scan/page.tsx" },
  { path: "/order/check-in", group: "site", file: "(site)/order/check-in/page.tsx" },
  // A DEMO- code: synthetic status (packages/api/src/demo/status-demo.js), no DB rows.
  { path: "/order/status", group: "site", file: "(site)/order/status/page.tsx", query: "orderQrCode=DEMO-PLAN.PREPPING" },
  { path: "/pod", group: "site", file: "(site)/pod/page.tsx" },
  { path: "/group/:code", group: "site", file: "(site)/group/[code]/page.tsx", params: { code: "7K2M9Q" } },
  { path: "/gift-cards", group: "site", file: "(site)/gift-cards/page.tsx" },
  { path: "/gift-cards/purchase", group: "site", file: "(site)/gift-cards/purchase/page.tsx" },
  { path: "/gift-cards/balance", group: "site", file: "(site)/gift-cards/balance/page.tsx" },
  { path: "/store", group: "site", file: "(site)/store/page.tsx" },
  { path: "/store/cart", group: "site", file: "(site)/store/cart/page.tsx" },
  { path: "/store/checkout", group: "site", file: "(site)/store/checkout/page.tsx" },
  { path: "/store/scan", group: "site", file: "(site)/store/scan/page.tsx" },
  { path: "/store/item/:qrCode", group: "site", file: "(site)/store/item/[qrCode]/page.tsx", params: { qrCode: "SAMPLE" } },
  {
    path: "/store/confirmation/:orderNumber",
    group: "site",
    file: "(site)/store/confirmation/[orderNumber]/page.tsx",
    params: { orderNumber: "100200" },
  },
  { path: "/challenges", group: "site", file: "(site)/challenges/page.tsx" },
  { path: "/challenges/meal-for-stranger", group: "site", file: "(site)/challenges/meal-for-stranger/page.tsx" },
  { path: "/contact", group: "site", file: "(site)/contact/page.tsx" },
  { path: "/privacy", group: "site", file: "(site)/privacy/page.tsx" },
  { path: "/accessibility", group: "site", file: "(site)/accessibility/page.tsx" },
  { path: "/sms-consent", group: "site", file: "(site)/sms-consent/page.tsx" },
  // Private events: a slug the crawl's API may not have renders the (translated) event not-found page.
  { path: "/e/:slug", group: "site", file: "(site)/e/[slug]/page.tsx", params: { slug: "plan-test-oct5" } },
  { path: "/e/:slug/rsvp", group: "site", file: "(site)/e/[slug]/rsvp/page.tsx", params: { slug: "plan-test-oct5" } },
  // The bowl and done steps read the guest from this browser; without one they send the visitor back (rsvp, invite).
  { path: "/e/:slug/order", group: "site", file: "(site)/e/[slug]/order/page.tsx", params: { slug: "plan-test-oct5" } },
  { path: "/e/:slug/done", group: "site", file: "(site)/e/[slug]/done/page.tsx", params: { slug: "plan-test-oct5" } },
];

/** The locale-free URL for a route, with params and query filled in. */
export function routeUrl(route: SiteRoute, resolve: (value: string) => string = (v) => v): string {
  let path = route.path;
  for (const [k, v] of Object.entries(route.params ?? {})) path = path.replace(`:${k}`, encodeURIComponent(resolve(v)));
  return route.query ? `${path}?${route.query}` : path;
}
