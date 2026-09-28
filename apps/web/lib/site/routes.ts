/**
 * Every customer route, with sample params (Task C5). The English-leak crawl
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
  { path: "/menu", group: "legacy", file: `${L}/menu/page.tsx` },
  { path: "/locations", group: "legacy", file: `${L}/locations/page.tsx` },
  { path: "/rewards", group: "site", file: "(site)/rewards/page.tsx" },
  { path: "/referral", group: "legacy", file: `${L}/referral/page.tsx`, auth: true },
  { path: "/member", group: "site", file: "(site)/member/page.tsx", auth: true },
  { path: "/member/orders", group: "site", file: "(site)/member/orders/page.tsx", auth: true },
  { path: "/member/credits", group: "site", file: "(site)/member/credits/page.tsx", auth: true },
  { path: "/order", group: "legacy", file: `${L}/order/page.tsx` },
  {
    path: "/order/location/:locationId",
    group: "legacy",
    file: `${L}/order/location/[locationId]/page.tsx`,
    params: { locationId: SAMPLE_LOCATION_ID },
  },
  { path: "/order/payment", group: "legacy", file: `${L}/order/payment/page.tsx` },
  { path: "/order/group-payment", group: "legacy", file: `${L}/order/group-payment/page.tsx` },
  { path: "/order/confirmation", group: "legacy", file: `${L}/order/confirmation/page.tsx` },
  { path: "/order/scan", group: "legacy", file: `${L}/order/scan/page.tsx` },
  { path: "/order/check-in", group: "legacy", file: `${L}/order/check-in/page.tsx` },
  // A DEMO- code: synthetic status (packages/api/src/demo/status-demo.js), no DB rows.
  { path: "/order/status", group: "legacy", file: `${L}/order/status/page.tsx`, query: "orderQrCode=DEMO-PLAN.PREPPING" },
  { path: "/pod", group: "legacy", file: `${L}/pod/page.tsx` },
  { path: "/group/:code", group: "legacy", file: `${L}/group/[code]/page.tsx`, params: { code: "SAMPLE" } },
  { path: "/gift-cards", group: "legacy", file: `${L}/gift-cards/page.tsx` },
  { path: "/gift-cards/purchase", group: "legacy", file: `${L}/gift-cards/purchase/page.tsx` },
  { path: "/gift-cards/balance", group: "legacy", file: `${L}/gift-cards/balance/page.tsx` },
  { path: "/store", group: "legacy", file: `${L}/store/page.tsx` },
  { path: "/store/cart", group: "legacy", file: `${L}/store/cart/page.tsx` },
  { path: "/store/checkout", group: "legacy", file: `${L}/store/checkout/page.tsx` },
  { path: "/store/scan", group: "legacy", file: `${L}/store/scan/page.tsx` },
  { path: "/store/item/:qrCode", group: "legacy", file: `${L}/store/item/[qrCode]/page.tsx`, params: { qrCode: "SAMPLE" } },
  {
    path: "/store/confirmation/:orderNumber",
    group: "legacy",
    file: `${L}/store/confirmation/[orderNumber]/page.tsx`,
    params: { orderNumber: "SAMPLE" },
  },
  { path: "/challenges/meal-for-stranger", group: "legacy", file: `${L}/challenges/meal-for-stranger/page.tsx` },
  { path: "/contact", group: "legacy", file: `${L}/contact/page.tsx` },
  { path: "/privacy", group: "legacy", file: `${L}/privacy/page.tsx` },
  { path: "/accessibility", group: "legacy", file: `${L}/accessibility/page.tsx` },
  { path: "/sms-consent", group: "legacy", file: `${L}/sms-consent/page.tsx` },
  { path: "/tenants", group: "legacy", file: `${L}/tenants/page.tsx`, internal: true },
];

/** The locale-free URL for a route, with params and query filled in. */
export function routeUrl(route: SiteRoute, resolve: (value: string) => string = (v) => v): string {
  let path = route.path;
  for (const [k, v] of Object.entries(route.params ?? {})) path = path.replace(`:${k}`, encodeURIComponent(resolve(v)));
  return route.query ? `${path}?${route.query}` : path;
}
