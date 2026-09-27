# Admin Console Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the open console API routes now (Phase 0). Then rebuild `apps/admin` as a mobile-first, role-aware console in the website's Night look (Phase 1, one release).

**Architecture:**
- **Phase 0:** adds `packages/api/src/auth/console-guard.js`.
  - An `onRoute` hook attaches `requireAdminAuth` to a declared list of console-only routes.
  - A source-parsing test forces every API route to be classified as console or public.
- **Phase 1, API:** adds roles to `auth/admin.js` (`req.adminRole`, `requireRole`) and a registered module `admin/console-routes.js` that holds the Today, Orders and Team endpoints.
- **Phase 1, admin app:**
  - Adopts Tailwind v4 plus Night tokens and a small `components/ui` kit.
  - Moves pages into `app/(console)` (the shell) and `app/(display)` (Kitchen and Cleaning).
  - Rebuilds every console page on four patterns.
  - `lib/access.ts` drives the middleware, the nav and the gating.

**Tech Stack:**
- Next.js 16.1, React 19.2, `@clerk/nextjs` 6, Tailwind v4 (unlayered utilities, no preflight), vitest (new in admin)
- Fastify 4, Prisma, `@clerk/backend`, `node:test`
- Playwright via node scripts for visual checks

**Spec:** `docs/superpowers/specs/2026-09-27-admin-console-overhaul-design.md` (Part A above).

## Global Constraints

- **Mobile-first:**
  - Design at 390x844 first, then 1280.
  - Touch targets at least 44px (`min-h-11`), input text at least 16px, and `svh` units.
  - Safe-area insets on the dock (`env(safe-area-inset-bottom)`).
  - No horizontal page scroll at 390px.
- **Breakpoint:** `lg` (1024px) switches dock to sidebar and cards to tables. No other layout breakpoints are needed.
- **Palette:** only `--color-oh-*` tokens:
  - charcoal `#1C1B19`, ink `#2A2724`, stone `#3A3632`, ash `#8A8178`, mute `#9A9188`
  - cream `#F2EDE4`, paper `#FAF7F1`, linen `#EDE6DA`
  - ember `#C1502E`, ember-light `#E07A5A`, ember-deep `#A94422`
  - olive `#6B7355`, olive-light `#8F9A75`
  - gold `#C9A227`, clay `#8C5A3C`
  - Filled primary buttons are `bg-oh-ember-deep text-oh-cream`.
- **Type:** Instrument Serif (`font-display`) for titles and big numbers; Raleway (`font-body`) for everything else; `tabular-nums` for figures.
- **No inline styles** in `app/(console)/**` or `components/**`, except dynamic values marked `// style-ok: <reason>` on the same line (progress widths, gradient and brand-colour previews, drag offsets).
- **No `window.alert`, `confirm` or `prompt`** in console code. Use `useToast()` and `useConfirm()`.
- **Copy:** no em dashes (U+2014) and no emoji in console UI. Short, calm, declarative sentences.
- **Icons:** in-house SVG only (`components/ui/icons.tsx`). No icon libraries.
- **Kitchen and Cleaning internals are untouched** (`kitchen-display.tsx`, `pods-manager.tsx`). Only their route location and wrapper change.
- **Roles:** `owner | manager | station`.
  - An email in `ADMIN_EMAILS` (API) or `OWNER_EMAILS` (admin; default `danodeen@me.com,danodeen@gmail.com`) is always owner.
  - Otherwise the role comes from Clerk `publicMetadata.adminRole`.
- **API role sets:** `OWNER=["owner"]`, `STAFF=["owner","manager"]`, `FLOOR=["owner","manager","station"]`.
- **Money:** managers never reach card refunds. There are no partial card refunds anywhere.
- **Git:**
  - Stage explicit paths only; never `git add -A`, because other sessions share the checkout.
  - Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
  - Nothing reaches production without the owner's explicit OK at that moment.
- **Dev:**
  - Local Postgres (127.0.0.1). The main-checkout dev servers are API :4000, web :3000 and admin :3001.
  - Worktree servers use admin :3011 and API :4010 (`API_PORT=4010`).
  - Copy `apps/admin/.env.local` and `packages/api/.env` from the main checkout into the worktree; they are gitignored.
  - Playwright MCP can't launch here. Use node scripts with `chromium.launch({ args: ["--no-sandbox"] })`.
- **Site-overhaul coexistence:**
  - Don't edit files under `apps/web`.
  - Leave `PATCH /orders/:id` and `PATCH /kitchen/orders/:id/status` open; the customer site calls them, and the overhaul's payment-integrity work owns them.

## Review Focus

These are the five failure modes most likely to bite, most likely first. Each is pinned by a test in the task named.

1. **Guarding a route the customer site calls.** Web, kiosk, mobile and the Stripe webhook must keep working. `MUST_STAY_OPEN` is asserted to be disjoint from `CONSOLE_ROUTES`, and every console entry is asserted to exist in the source (Task P0.1, Task P0.2).
2. **A typo in a guarded path silently leaves the route open.** Every `CONSOLE_ROUTES` entry must match a parsed route, and every parsed route must be classified (Task P0.2).
3. **"Today" around midnight and DST in Denver.** `startOfDenverDay` returns 06:00Z in winter and 07:00Z in summer, including at 11:30 pm local and on the DST change days (Task 3).
4. **Role spoofing or a stale role.** An incoming `x-admin-role` request header is always overwritten by middleware. After a PATCH, `forget(userId)` drops the API's 5-minute role cache. Station requests to `/admin/*` get 403 (Tasks 1, 2 and 7).
5. **Optimistic sold-out toggle when the network fails.** The switch reverts, an error toast shows, and the undo toast never re-applies a failed change (Task 13).

---

## Phase 0: Console API guard hotfix (ships alone, first)

Work on branch `console-api-guard` from `main`, in worktree `.claude/worktrees/console-api-guard` (create it with `superpowers:using-git-worktrees`). Only `packages/api` changes.

### Task P0.1: `console-guard.js` (route list plus onRoute hook)

**Files:**
- Create: `packages/api/src/auth/console-guard.js`
- Test: `packages/api/src/auth/__tests__/console-guard.test.js`

**Interfaces:**
- Produces:
  - `OWNER`, `STAFF`, `FLOOR` (frozen string arrays)
  - `CONSOLE_ROUTES: {method, url, roles}[]` and `MUST_STAY_OPEN: {method, url}[]`
  - `routeKey(method, url) → "METHOD /url"`
  - `registerConsoleGuard(app, { requireAdminAuth, requireRole? })`
  - `adminPathRoles(url) → roles`
- Phase 1 passes `requireRole`; Phase 0 does not.

- [ ] **Step 1: Write the failing test**

```js
// packages/api/src/auth/__tests__/console-guard.test.js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  CONSOLE_ROUTES, MUST_STAY_OPEN, OWNER, STAFF, FLOOR,
  registerConsoleGuard, routeKey, adminPathRoles,
} from "../console-guard.js";

async function build({ requireRole } = {}) {
  const app = Fastify({ logger: false });
  const requireAdminAuth = async (req, reply) => {
    if (req.headers.authorization !== "Bearer ok") {
      return reply.code(401).send({ error: "Unauthorized - Admin authentication required" });
    }
    req.adminRole = req.headers["x-test-role"] || "owner";
  };
  registerConsoleGuard(app, { requireAdminAuth, requireRole });
  app.post("/tenants", async () => ({ ok: true }));
  app.get("/analytics/revenue", async () => ({ ok: true }));
  app.get("/kitchen/orders", { preHandler: async (req) => { req.sawExisting = true; } },
    async (req) => ({ existing: req.sawExisting === true }));
  app.post("/analytics/language", async () => ({ ok: true }));
  app.patch("/orders/:id", async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe("registerConsoleGuard", () => {
  test("console routes need admin auth", async () => {
    const app = await build();
    assert.equal((await app.inject({ method: "POST", url: "/tenants" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/analytics/revenue" })).statusCode, 401);
    assert.equal((await app.inject({ method: "HEAD", url: "/analytics/revenue" })).statusCode, 401);
    const ok = await app.inject({ method: "POST", url: "/tenants", headers: { authorization: "Bearer ok" } });
    assert.equal(ok.statusCode, 200);
  });

  test("existing route preHandlers still run after the guard", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/kitchen/orders", headers: { authorization: "Bearer ok" } });
    assert.deepEqual(res.json(), { existing: true });
  });

  test("customer routes stay open", async () => {
    const app = await build();
    assert.equal((await app.inject({ method: "POST", url: "/analytics/language" })).statusCode, 200);
    assert.equal((await app.inject({ method: "PATCH", url: "/orders/abc" })).statusCode, 200);
  });

  test("requireRole is applied with the entry's roles when given", async () => {
    const seen = [];
    const requireRole = (...roles) => async (req, reply) => {
      seen.push(roles.join(","));
      if (!roles.includes(req.adminRole)) return reply.code(403).send({ error: "Forbidden" });
    };
    const app = await build({ requireRole });
    const res = await app.inject({
      method: "POST", url: "/tenants",
      headers: { authorization: "Bearer ok", "x-test-role": "manager" },
    });
    assert.equal(res.statusCode, 403);
    assert.ok(seen.includes("owner"));
  });
});

describe("route lists", () => {
  test("no duplicates and valid roles", () => {
    const keys = CONSOLE_ROUTES.map((r) => routeKey(r.method, r.url));
    assert.equal(new Set(keys).size, keys.length);
    for (const r of CONSOLE_ROUTES) assert.ok([OWNER, STAFF, FLOOR].includes(r.roles), routeKey(r.method, r.url));
  });

  test("MUST_STAY_OPEN never overlaps CONSOLE_ROUTES", () => {
    const guarded = new Set(CONSOLE_ROUTES.map((r) => routeKey(r.method, r.url)));
    for (const r of MUST_STAY_OPEN) assert.ok(!guarded.has(routeKey(r.method, r.url)), routeKey(r.method, r.url));
  });

  test("adminPathRoles: owner-only prefixes, everything else staff", () => {
    assert.equal(adminPathRoles("/admin/plan/codes"), OWNER);
    assert.equal(adminPathRoles("/admin/gift-card-config/designs/1"), OWNER);
    assert.equal(adminPathRoles("/admin/team?x=1"), OWNER);
    assert.equal(adminPathRoles("/admin/gift-cards/stats"), STAFF);
    assert.equal(adminPathRoles("/admin/planner"), STAFF);
  });
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `cd packages/api && node --test src/auth/__tests__/console-guard.test.js`
Expected: FAIL, "Cannot find module '../console-guard.js'".

- [ ] **Step 3: Implement**

```js
// packages/api/src/auth/console-guard.js
/**
 * Console-only API routes that live outside /admin.
 *
 * Before 2026-09-27 only /admin/* was guarded, so these were open to anyone.
 * registerConsoleGuard adds requireAdminAuth (and, from Phase 1, a role check)
 * as the first preHandler of each listed route. It must be registered before
 * the routes are declared. Customer, kiosk, webhook and cron routes are listed
 * in public-routes.js; the classification test fails on any route in neither.
 */
export const OWNER = Object.freeze(["owner"]);
export const STAFF = Object.freeze(["owner", "manager"]);
export const FLOOR = Object.freeze(["owner", "manager", "station"]);

const r = (method, url, roles) => Object.freeze({ method, url, roles });

export const CONSOLE_ROUTES = Object.freeze([
  // Setup: tenants, locations, kiosk devices
  r("POST", "/tenants", OWNER),
  r("PATCH", "/tenants/:id", OWNER),
  r("DELETE", "/tenants/:id", OWNER),
  r("POST", "/locations", OWNER),
  r("PATCH", "/locations/:id", OWNER),
  r("DELETE", "/locations/:id", OWNER),
  r("POST", "/locations/geocode", OWNER),
  r("POST", "/locations/validate-address", OWNER),
  r("POST", "/kiosk-devices", OWNER),
  r("GET", "/kiosk-devices", OWNER),
  r("GET", "/kiosk-devices/:id", OWNER),
  r("PUT", "/kiosk-devices/:id", OWNER),
  r("POST", "/kiosk-devices/:id/rotate-key", OWNER),
  r("DELETE", "/kiosk-devices/:id", OWNER),
  // Menu and promos
  r("POST", "/menu", STAFF),
  r("PATCH", "/menu/:id", STAFF),
  r("DELETE", "/menu/:id", STAFF),
  r("GET", "/promo-codes", STAFF),
  r("GET", "/promo-codes/:id", STAFF),
  r("POST", "/promo-codes", STAFF),
  r("DELETE", "/promo-codes/:id", STAFF),
  r("POST", "/promo-codes/:id/apply", OWNER),
  // Seats and pods
  r("GET", "/seats", OWNER),
  r("POST", "/seats", OWNER),
  r("PATCH", "/seats/:id", OWNER),
  r("DELETE", "/seats/:id", OWNER),
  r("POST", "/seats/link-dual", STAFF),
  r("POST", "/seats/unlink-dual", STAFF),
  r("PATCH", "/seats/:id/clean", FLOOR),
  r("POST", "/seats/:id/force-clean", FLOOR),
  r("POST", "/orders/:id/assign-pod", OWNER),
  r("POST", "/orders/:id/confirm-pod", OWNER),
  r("POST", "/orders/:id/release-pod", OWNER),
  // Kitchen and cleaning displays
  r("GET", "/pod-calls", FLOOR),
  r("PATCH", "/pod-calls/:id/acknowledge", FLOOR),
  r("PATCH", "/pod-calls/:id/resolve", FLOOR),
  r("DELETE", "/pod-calls/:id", FLOOR),
  r("GET", "/kitchen/orders", FLOOR),
  r("GET", "/kitchen/pickup-orders", FLOOR),
  r("GET", "/kitchen/cny-stats", FLOOR),
  r("GET", "/kitchen/stats", FLOOR),
  r("GET", "/kitchen/average-processing-time", FLOOR),
  r("GET", "/cleaning/average-time", FLOOR),
  // Orders with customer data
  r("GET", "/orders", OWNER),
  r("GET", "/orders/by-number/:orderNumber", STAFF),
  // Analytics: money views are owner-only (spec A6)
  r("GET", "/analytics/overview", OWNER),
  r("GET", "/analytics/realtime", OWNER),
  r("GET", "/analytics/revenue", OWNER),
  r("GET", "/analytics/order-sources", OWNER),
  r("GET", "/analytics/customers", OWNER),
  r("GET", "/analytics/ga4/funnel", OWNER),
  r("GET", "/analytics/operations", STAFF),
  r("GET", "/analytics/menu", STAFF),
  r("GET", "/analytics/upselling", STAFF),
  r("GET", "/analytics/ga4/traffic", STAFF),
  r("GET", "/analytics/ga4/pages", STAFF),
  r("GET", "/analytics/ga4/sources", STAFF),
  r("GET", "/analytics/ga4/devices", STAFF),
  r("GET", "/analytics/ga4/geo", STAFF),
  r("GET", "/analytics/ga4/realtime", STAFF),
  r("GET", "/analytics/ga4/hourly", STAFF),
  r("GET", "/analytics/language", STAFF),
  r("GET", "/analytics/challenges", STAFF),
  r("GET", "/analytics/badges", STAFF),
  // Unused but dangerous when open
  r("POST", "/challenges", OWNER),
  r("PATCH", "/challenges/:id", OWNER),
  r("DELETE", "/challenges/:id", OWNER),
  r("GET", "/gift-cards/:id", STAFF),
  r("POST", "/gift-cards/:id/redeem", OWNER),
  r("PATCH", "/shop/products/:id/inventory", STAFF),
  r("GET", "/shop/products/inventory/low-stock", STAFF),
  r("GET", "/shop/orders/:id", STAFF),
  r("POST", "/shop/orders/:id/apply-credits", OWNER),
  r("GET", "/users/:id/shop-orders", OWNER),
  r("POST", "/payments/confirm", OWNER),
  r("POST", "/wallet/refresh-all", OWNER),
  r("GET", "/wallet/debug", OWNER),
  r("POST", "/wallet/test-push/:userId", OWNER),
  r("POST", "/meal-gifts/expire", OWNER),
  r("GET", "/notifications/status", OWNER),
]);

/** Called by the customer site, kiosks, mobile or the Stripe webhook without admin auth. */
export const MUST_STAY_OPEN = Object.freeze([
  { method: "PATCH", url: "/orders/:id" },
  { method: "PATCH", url: "/kitchen/orders/:id/status" },
  { method: "GET", url: "/orders/:id" },
  { method: "GET", url: "/orders/status" },
  { method: "POST", url: "/orders" },
  { method: "POST", url: "/orders/check-in" },
  { method: "GET", url: "/orders/lookup" },
  { method: "GET", url: "/orders/by-member" },
  { method: "POST", url: "/analytics/language" },
  { method: "POST", url: "/promo-codes/validate" },
  { method: "GET", url: "/menu" },
  { method: "GET", url: "/menu/steps" },
  { method: "GET", url: "/tenants" },
  { method: "GET", url: "/locations" },
  { method: "GET", url: "/locations/:id/seats" },
  { method: "GET", url: "/locations/:id/availability" },
  { method: "POST", url: "/kiosk/auth" },
  { method: "POST", url: "/kiosk/heartbeat" },
  { method: "PATCH", url: "/shop/orders/:id" },
  { method: "POST", url: "/gift-cards/:id/confirm-payment" },
  { method: "GET", url: "/catering/site-config/order-now" },
  { method: "GET", url: "/catering/kitchen-locations" },
]);

export function routeKey(method, url) {
  return `${String(method).toUpperCase()} ${url}`;
}

const OWNER_ADMIN_PREFIXES = ["/admin/plan", "/admin/gift-card-config", "/admin/team"];

/** Roles allowed on an /admin/* URL (Phase 1 applies it in the /admin onRequest hook). */
export function adminPathRoles(url) {
  const path = String(url).split("?")[0];
  return OWNER_ADMIN_PREFIXES.some((p) => path === p || path.startsWith(p + "/")) ? OWNER : STAFF;
}

export function registerConsoleGuard(app, { requireAdminAuth, requireRole, routes = CONSOLE_ROUTES }) {
  const index = new Map(routes.map((route) => [routeKey(route.method, route.url), route]));
  app.addHook("onRoute", (opts) => {
    const methods = Array.isArray(opts.method) ? opts.method : [opts.method];
    const entry = methods
      .map((m) => index.get(routeKey(m === "HEAD" ? "GET" : m, opts.url)))
      .find(Boolean);
    if (!entry) return;
    const existing = opts.preHandler ? [].concat(opts.preHandler) : [];
    const guards = [requireAdminAuth];
    if (requireRole) guards.push(requireRole(...entry.roles));
    opts.preHandler = [...guards, ...existing.filter((h) => !guards.includes(h))];
  });
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `cd packages/api && node --test src/auth/__tests__/console-guard.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/auth/console-guard.js packages/api/src/auth/__tests__/console-guard.test.js
git commit -m "feat(api): console route guard list and onRoute hook"
```

### Task P0.2: Route classification test plus wiring into the API

**Files:**
- Create: `packages/api/src/auth/public-routes.js`
- Test: `packages/api/src/auth/__tests__/route-classification.test.js`
- Modify: `packages/api/src/index.js:166-173` (register the guard before any route)

**Interfaces:**
- Consumes: `CONSOLE_ROUTES`, `MUST_STAY_OPEN`, `routeKey`, `registerConsoleGuard` (Task P0.1).
- Produces: `PUBLIC_ROUTES: {method, url, why}[]`, where `why` is one of `customer | kiosk | mobile | webhook | cron | wallet | public-read | agents | catering-public`.

- [ ] **Step 1: Write the failing test**

```js
// packages/api/src/auth/__tests__/route-classification.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONSOLE_ROUTES, MUST_STAY_OPEN, routeKey } from "../console-guard.js";
import { PUBLIC_ROUTES } from "../public-routes.js";

const SOURCES = ["../../index.js", "../../catering/routes.js", "../../autonomous/routes.js", "../../triggers/webhooks.js"];
const ROUTE_RE = /\b(?:app|fastify|server|instance)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;

function parsedRoutes() {
  const keys = new Set();
  for (const rel of SOURCES) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    for (const m of src.matchAll(ROUTE_RE)) {
      const url = m[2];
      if (url.startsWith("/admin") || url.startsWith("/plan")) continue;
      keys.add(routeKey(m[1], url));
    }
  }
  return keys;
}

test("the parser finds the API's routes", () => {
  assert.ok(parsedRoutes().size > 150, `only ${parsedRoutes().size} routes parsed; check ROUTE_RE against the sources`);
});

test("every route outside /admin and /plan is classified exactly once", () => {
  const consoleKeys = new Set(CONSOLE_ROUTES.map((r) => routeKey(r.method, r.url)));
  const publicKeys = new Set(PUBLIC_ROUTES.map((r) => routeKey(r.method, r.url)));
  const unclassified = [...parsedRoutes()].filter((k) => !consoleKeys.has(k) && !publicKeys.has(k));
  assert.deepEqual(unclassified, [], "classify these in console-guard.js or public-routes.js");
  const both = [...consoleKeys].filter((k) => publicKeys.has(k));
  assert.deepEqual(both, []);
});

test("every guarded entry matches a real route (a typo would leave it open)", () => {
  const parsed = parsedRoutes();
  const missing = CONSOLE_ROUTES.map((r) => routeKey(r.method, r.url)).filter((k) => !parsed.has(k));
  assert.deepEqual(missing, []);
});

test("routes the customer site calls are public", () => {
  const publicKeys = new Set(PUBLIC_ROUTES.map((r) => routeKey(r.method, r.url)));
  for (const r of MUST_STAY_OPEN) assert.ok(publicKeys.has(routeKey(r.method, r.url)), routeKey(r.method, r.url));
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `cd packages/api && node --test src/auth/__tests__/route-classification.test.js`
Expected: FAIL, "Cannot find module '../public-routes.js'".

- [ ] **Step 3: Generate the unclassified list**

Create `public-routes.js` with `export const PUBLIC_ROUTES = Object.freeze([]);` and run the test. The "classified exactly once" failure prints every unclassified route.

Classify each one with a `why`, using Appendix A (the route inventory at the end of this file):
- **customer:** web callers.
- **kiosk:** kiosk devices.
- **mobile:** `apps/mobile/lib/api.ts`.
- **webhook:** `/webhooks/*`, `/chappy/sms`, and the Next.js Stripe webhook's calls.
- **cron:** `/cron/*`, and `GET /cny/rsvps` with `?secret=`.
- **wallet:** `/wallet/v1/*` (pass-token auth).
- **public-read:** harmless reads with no caller, such as `GET /seats/:qrCode`, `GET /users/referral/:code`, `GET /shop/products/:slug` and `GET /challenges/:idOrSlug`.
- **agents:** `/agents/*`, proxied by the web server.
- **catering-public:** public `/catering/*`, already 404 unless `CATERING_PUBLIC_ENABLED`.

**If any route looks like it mutates money, menu or seats and isn't a customer, kiosk or webhook caller, stop and ask** rather than marking it public.

```js
// packages/api/src/auth/public-routes.js
/**
 * API routes that intentionally carry no admin auth, with the reason.
 * The classification test requires every route outside /admin and /plan to be
 * listed here or in console-guard.js CONSOLE_ROUTES.
 */
const p = (method, url, why) => Object.freeze({ method, url, why });

export const PUBLIC_ROUTES = Object.freeze([
  p("PATCH", "/orders/:id", "customer"),            // web marks PAID today; site overhaul owns the fix
  p("PATCH", "/kitchen/orders/:id/status", "customer"), // "I'm done eating"
  p("POST", "/analytics/language", "customer"),
  p("POST", "/promo-codes/validate", "customer"),
  p("GET", "/menu", "public-read"),
  // ...one line per remaining route, generated from the failing test output and Appendix A
]);
```

- [ ] **Step 4: Wire the guard into the API**

In `packages/api/src/index.js`, immediately after `const { requireAdminAuth } = createAdminAuth(...)` (line 163) and before any `app.get/post/...` route:

```js
import { registerConsoleGuard } from "./auth/console-guard.js"; // with the other imports at the top

// Console-only routes outside /admin (see auth/console-guard.js). Must run before routes are declared.
registerConsoleGuard(app, { requireAdminAuth });
```

Check that there is no route declaration above this line: `grep -n -E "^app\.(get|post|put|patch|delete)\(" packages/api/src/index.js | head -1` must print a line number greater than the guard's.

- [ ] **Step 5: Run the whole API suite**

Run: `cd packages/api && pnpm test`
Expected: PASS, including the existing `admin.test.js`, plan and demo tests.

- [ ] **Step 6: Smoke test locally with auth enforced**

In the worktree, start the API with auth forced on: `ADMIN_API_KEY=local-test API_PORT=4010 node src/index.js`. Then:

```bash
for u in /analytics/revenue /kiosk-devices /orders /promo-codes /pod-calls; do printf "%s " $u; curl -s -o /dev/null -w "%{http_code}\n" localhost:4010$u; done   # expect 401 each
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:4010/menu -H 'content-type: application/json' -d '{}'   # 401
curl -s -o /dev/null -w "%{http_code}\n" localhost:4010/menu -H 'x-tenant-slug: oh'        # 200
curl -s -o /dev/null -w "%{http_code}\n" localhost:4010/locations -H 'x-tenant-slug: oh'   # 200
curl -s -o /dev/null -w "%{http_code}\n" localhost:4010/analytics/revenue -H 'x-admin-api-key: local-test' -H 'x-tenant-slug: oh'  # 200
```

Then stop that process.

In dev, `requireAdminAuth` is a no-op without `ADMIN_API_KEY`, so the main-checkout dev servers are unaffected.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/auth/public-routes.js packages/api/src/auth/__tests__/route-classification.test.js packages/api/src/index.js
git commit -m "fix(api): require admin auth on console-only routes outside /admin"
```

### Task P0.3: Ship the hotfix (needs the owner's OK)

- [ ] **Step 1:** Ask the owner: "Phase 0 is ready: N routes locked, tests pass. OK to merge to main and deploy the API?" Wait for an explicit yes.
- [ ] **Step 2:** Merge `console-api-guard` into `main` (fast-forward or `--no-ff`) and push. Railway deploys `@oh/api`; the deploy quirks are in memory `prod-deploy-gotchas`. Watch it with `railway logs --service "@oh/api"`.
- [ ] **Step 3: Production smoke test.**
  - Unauthenticated `curl https://api.ohbeef.com/analytics/revenue` returns 401.
  - `GET /menu` and `GET /locations` with `x-tenant-slug: oh` return 200.
  - In a browser on https://www.ohbeef.com, the menu builder loads seats and availability.
  - On https://admin-oh-beef-noodle-soup.vercel.app, while signed in, Analytics, Kiosks, Promos and Kitchen load.
  - No live payment is attempted. Stripe is live (memory `stripe-live-mode`).
- [ ] **Step 4:** Report the result to the owner, including any route that needed a follow-up.

---

## Phase 1: Admin console overhaul (one release)

Work on branch `admin-overhaul` from `main`, after Phase 0 has merged, in worktree `.claude/worktrees/admin-overhaul`.

### Task 0: Worktree, docs and baselines

**Files:**
- Create: `docs/superpowers/specs/2026-09-27-admin-console-overhaul-design.md` (Part A of this file)
- Create: `docs/superpowers/plans/2026-09-27-admin-console-overhaul.md` (Part B of this file)
- Create: `apps/admin/scripts/baseline-displays.mjs`

- [ ] **Step 1:** Create the worktree (`superpowers:using-git-worktrees`). Copy the gitignored env files (`apps/admin/.env.local`, `packages/api/.env`) from the main checkout, then run `pnpm install`.
- [ ] **Step 2:** Copy Part A and Part B into the two docs files.
- [ ] **Step 3: Capture Kitchen and Cleaning baselines before anything moves.** Start admin in the worktree (`pnpm --filter @oh/admin exec next dev -p 3011`) against the main dev API (:4000). Write and run:

```js
// apps/admin/scripts/baseline-displays.mjs
// Screenshots Kitchen and Cleaning at the tablet sizes they run on, for before/after comparison.
import { chromium } from "playwright";
const base = process.env.ADMIN_URL || "http://localhost:3011";
const out = process.argv[2] || "baseline";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [w, h] of [[1280, 800], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const path of ["/kitchen", "/cleaning"]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/tmp/admin-${out}${path.replace("/", "-")}-${w}.png` });
  }
  await page.close();
}
await browser.close();
```

Run: `node apps/admin/scripts/baseline-displays.mjs baseline`. If `playwright` doesn't resolve, run `pnpm add -D -w playwright` and then `npx playwright install chromium`. Keep the PNGs in `/tmp` and don't commit them.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-27-admin-console-overhaul-design.md docs/superpowers/plans/2026-09-27-admin-console-overhaul.md apps/admin/scripts/baseline-displays.mjs
git commit -m "docs: admin console overhaul spec and plan"
```

### Task 1: API roles in `auth/admin.js`

**Files:**
- Modify: `packages/api/src/auth/admin.js`
- Test: `packages/api/src/auth/__tests__/admin.test.js` (extend it; keep the existing tests)

**Interfaces:**
- Produces:
  - `ADMIN_ROLES = ["owner","manager","station"]`
  - `roleFor({ email, metadata, adminEmails }) → role | null`
  - `createAdminAuth()` returns `{ requireAdminAuth, requireRole, resolveBearer, isAdminBearer, forget, adminEmails }`
- `requireAdminAuth` sets `req.adminRole`, and `req.adminUserId` for Bearer callers.
- `requireRole(...roles)` is a preHandler that returns 403 `{error:"Forbidden"}`.
- `forget(userId)` clears that user's cached role.

- [ ] **Step 1: Write the failing tests**

Append these to `admin.test.js`, reusing its `build`, `req`, `replyStub` and `prodEnv` helpers. Extend the stub `getUser` so the ids `"mgr"` and `"stn"` return users with the emails `m@x.com` and `s@x.com` and `publicMetadata.adminRole` values `"manager"` and `"station"`, and have `verifyToken` map the tokens `"manager"` to sub `"mgr"` and `"station"` to sub `"stn"`.

```js
import { roleFor, ADMIN_ROLES } from "../admin.js";

describe("roleFor", () => {
  const adminEmails = ["owner@x.com"];
  test("allowlisted email is owner regardless of metadata", () => {
    assert.equal(roleFor({ email: "Owner@x.com", metadata: { adminRole: "station" }, adminEmails }), "owner");
  });
  test("metadata role is used for everyone else", () => {
    assert.equal(roleFor({ email: "m@x.com", metadata: { adminRole: "manager" }, adminEmails }), "manager");
    assert.equal(roleFor({ email: "s@x.com", metadata: { adminRole: "station" }, adminEmails }), "station");
  });
  test("unknown or missing role is null", () => {
    assert.equal(roleFor({ email: "z@x.com", metadata: { adminRole: "god" }, adminEmails }), null);
    assert.equal(roleFor({ email: "z@x.com", metadata: undefined, adminEmails }), null);
  });
  test("ADMIN_ROLES is the closed set", () => assert.deepEqual([...ADMIN_ROLES], ["owner", "manager", "station"]));
});

describe("roles on requireAdminAuth (production)", () => {
  test("sets req.adminRole from the bearer", async () => {
    const { auth } = build();
    const r = req({ authorization: "Bearer manager" });
    const reply = replyStub();
    await auth.requireAdminAuth(r, reply);
    assert.equal(reply.statusCode, 200);
    assert.equal(r.adminRole, "manager");
  });
  test("api key is owner", async () => {
    const { auth } = build();
    const r = req({ "x-admin-api-key": "key-123" });
    await auth.requireAdminAuth(r, replyStub());
    assert.equal(r.adminRole, "owner");
  });
  test("requireRole rejects other roles with 403", async () => {
    const { auth } = build();
    const r = req({ authorization: "Bearer station" });
    await auth.requireAdminAuth(r, replyStub());
    const reply = replyStub();
    await auth.requireRole("owner", "manager")(r, reply);
    assert.equal(reply.statusCode, 403);
  });
  test("forget drops the cached role so a change applies on the next call", async () => {
    const { auth, calls } = build();
    await auth.resolveBearer("manager");
    await auth.resolveBearer("manager");
    const before = calls.getUser;
    auth.forget("mgr");
    await auth.resolveBearer("manager");
    assert.equal(calls.getUser, before + 1);
  });
});

describe("dev bypass", () => {
  test("uses DEV_ADMIN_ROLE when valid, owner otherwise", async () => {
    const dev = createAdminAuth({ env: { NODE_ENV: "development", DEV_ADMIN_ROLE: "manager" } });
    const r = req({});
    await dev.requireAdminAuth(r, replyStub());
    assert.equal(r.adminRole, "manager");
    const dev2 = createAdminAuth({ env: { NODE_ENV: "development", DEV_ADMIN_ROLE: "nope" } });
    const r2 = req({});
    await dev2.requireAdminAuth(r2, replyStub());
    assert.equal(r2.adminRole, "owner");
  });
});
```

If `build()` doesn't already return a `calls` counter, extend it to return `{ auth, calls }`, where `calls.getUser` increments inside the stub. Update the existing call sites.

- [ ] **Step 2: Run the tests and check they fail**

Run: `cd packages/api && node --test src/auth/__tests__/admin.test.js`
Expected: FAIL (`roleFor` is not exported).

- [ ] **Step 3: Implement.** Replace the body of `isAdminBearer` and `requireAdminAuth` in `admin.js`, keeping the existing verification flow:

```js
export const ADMIN_ROLES = Object.freeze(["owner", "manager", "station"]);

/** Allowlisted email = owner; otherwise Clerk publicMetadata.adminRole if it is a known role. */
export function roleFor({ email, metadata, adminEmails }) {
  if (typeof email === "string" && adminEmails.includes(email.toLowerCase())) return "owner";
  const role = metadata?.adminRole;
  return ADMIN_ROLES.includes(role) ? role : null;
}

// inside createAdminAuth, replacing isAdminBearer:
  async function resolveBearer(token) {
    if (secretKeys.length === 0 || !token) return null;
    const verified = await verifyAgainstAny(token);
    if (!verified) return null;
    const userId = verified.payload?.sub;
    if (!userId) return null;
    const cacheKey = `${verified.secretKey.slice(-6)}:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.exp > now()) return cached.role ? { role: cached.role, userId } : null;

    let role = null;
    try {
      const user = await getUser(userId, verified.secretKey);
      const primary = (user.emailAddresses || []).find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
      role = roleFor({ email: primary, metadata: user.publicMetadata, adminEmails });
    } catch (err) {
      log("admin user lookup failed", err?.message);
    }
    if (cache.size > 1000) cache.clear();
    cache.set(cacheKey, { role, exp: now() + CACHE_MS });
    return role ? { role, userId } : null;
  }

  async function isAdminBearer(token) {
    return Boolean(await resolveBearer(token));
  }

  function forget(userId) {
    for (const key of cache.keys()) if (key.endsWith(`:${userId}`)) cache.delete(key);
  }

  const devRole = ADMIN_ROLES.includes(env.DEV_ADMIN_ROLE) ? env.DEV_ADMIN_ROLE : "owner";

  async function requireAdminAuth(req, reply) {
    if (!isProduction && !apiKey) {
      req.adminRole = devRole;
      return;
    }
    const headerKey = req.headers["x-admin-api-key"];
    if (apiKey && timingSafeEqual(typeof headerKey === "string" ? headerKey : "", apiKey)) {
      req.adminRole = "owner";
      return;
    }
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const who = await resolveBearer(authHeader.slice(7).trim());
      if (who) {
        req.adminRole = who.role;
        req.adminUserId = who.userId;
        return;
      }
    }
    return reply.code(401).send({ error: "Unauthorized - Admin authentication required" });
  }

  function requireRole(...roles) {
    return async function requireRoleHandler(req, reply) {
      if (!roles.includes(req.adminRole)) return reply.code(403).send({ error: "Forbidden" });
    };
  }

  return { requireAdminAuth, requireRole, resolveBearer, isAdminBearer, forget, adminEmails };
```

Update the file's header comment: the three ways in now set `req.adminRole`, and an allowlisted email is always owner.

- [ ] **Step 4: Run the tests and check they pass**

Run: `cd packages/api && node --test src/auth/__tests__/admin.test.js && pnpm test`
Expected: PASS. Existing callers of `isAdminBearer` still get a boolean; check them with `grep -rn isAdminBearer packages/api/src`.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/auth/admin.js packages/api/src/auth/__tests__/admin.test.js
git commit -m "feat(api): owner, manager and station roles on admin auth"
```

### Task 2: Enforce roles on console routes and `/admin/*`

**Files:**
- Modify: `packages/api/src/index.js:160-175`
- Create: `packages/api/src/auth/admin-hook.js`
- Test: `packages/api/src/auth/__tests__/admin-hook.test.js`

**Interfaces:**
- Consumes: `adminPathRoles`, `registerConsoleGuard` (Task P0.1); `requireAdminAuth`, `requireRole` (Task 1).
- Produces: `registerAdminAuthHooks(app, { requireAdminAuth, requireRole })`, which does both the `/admin` onRequest hook and the console guard.

- [ ] **Step 1: Write the failing test**

```js
// packages/api/src/auth/__tests__/admin-hook.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAdminAuthHooks } from "../admin-hook.js";

async function build() {
  const app = Fastify({ logger: false });
  const requireAdminAuth = async (req, reply) => {
    const role = req.headers["x-test-role"];
    if (!role) return reply.code(401).send({ error: "Unauthorized" });
    req.adminRole = role;
  };
  const requireRole = (...roles) => async (req, reply) => {
    if (!roles.includes(req.adminRole)) return reply.code(403).send({ error: "Forbidden" });
  };
  registerAdminAuthHooks(app, { requireAdminAuth, requireRole });
  app.get("/admin/plan/codes", async () => ({ ok: 1 }));
  app.get("/admin/shop/orders", async () => ({ ok: 1 }));
  app.get("/analytics/revenue", async () => ({ ok: 1 }));
  app.get("/analytics/operations", async () => ({ ok: 1 }));
  app.get("/kitchen/orders", async () => ({ ok: 1 }));
  await app.ready();
  return app;
}
const call = (app, url, role) => app.inject({ method: "GET", url, headers: role ? { "x-test-role": role } : {} });

test("owner-only /admin prefixes", async () => {
  const app = await build();
  assert.equal((await call(app, "/admin/plan/codes", "owner")).statusCode, 200);
  assert.equal((await call(app, "/admin/plan/codes", "manager")).statusCode, 403);
});
test("station cannot reach any /admin route", async () => {
  const app = await build();
  assert.equal((await call(app, "/admin/shop/orders", "station")).statusCode, 403);
  assert.equal((await call(app, "/admin/shop/orders", "manager")).statusCode, 200);
});
test("console route roles", async () => {
  const app = await build();
  assert.equal((await call(app, "/analytics/revenue", "manager")).statusCode, 403);
  assert.equal((await call(app, "/analytics/operations", "manager")).statusCode, 200);
  assert.equal((await call(app, "/analytics/operations", "station")).statusCode, 403);
  assert.equal((await call(app, "/kitchen/orders", "station")).statusCode, 200);
  assert.equal((await call(app, "/kitchen/orders")).statusCode, 401);
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `cd packages/api && node --test src/auth/__tests__/admin-hook.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// packages/api/src/auth/admin-hook.js
import { adminPathRoles, registerConsoleGuard } from "./console-guard.js";

/**
 * All admin auth wiring in one place: /admin/* needs a role allowed by
 * adminPathRoles, and console-only routes elsewhere get their listed roles.
 * Call before any route is declared.
 */
export function registerAdminAuthHooks(app, { requireAdminAuth, requireRole }) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin")) return;
    await requireAdminAuth(req, reply);
    if (reply.sent) return reply;
    await requireRole(...adminPathRoles(req.url))(req, reply);
    if (reply.sent) return reply;
  });
  registerConsoleGuard(app, { requireAdminAuth, requireRole });
}
```

In `index.js`, replace the inline `/admin` hook (lines 168-173) and the Phase 0 `registerConsoleGuard(...)` call with:

```js
const { requireAdminAuth, requireRole, forget: forgetAdminRole } = createAdminAuth({ log: (...args) => app.log.warn({ args }, "admin auth") });
registerAdminAuthHooks(app, { requireAdminAuth, requireRole });
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `cd packages/api && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/auth/admin-hook.js packages/api/src/auth/__tests__/admin-hook.test.js packages/api/src/index.js
git commit -m "feat(api): role checks on /admin and console routes"
```

### Task 3: `GET /admin/today`, `GET /admin/orders` and `GET /admin/orders/:id`

**Files:**
- Create: `packages/api/src/admin/console-routes.js`
- Create: `packages/api/src/admin/time.js`
- Test: `packages/api/src/admin/__tests__/time.test.js`
- Test: `packages/api/src/admin/__tests__/console-routes.test.js`
- Modify: `packages/api/src/index.js` (register it next to `registerPlanRoutes`)

**Interfaces:**
- Produces:
  - `startOfDenverDay(now: Date) → Date`
  - `registerAdminConsoleRoutes(app, { prisma, resolveTenant: (req) => Promise<{id}|null>, now?: () => Date })`
- **`GET /admin/today?locationId=`** returns:
  ```
  { date: ISO, ordersToday, activeDiners, openPodCalls, shopToShip, cateringNext7,
    salesCents?, unansweredQuestions?, countersignerMissing? }
  ```
  The three optional fields are present only when `req.adminRole === "owner"`.
- **`GET /admin/orders?q=&locationId=&limit=`** returns `{ orders: OrderSummary[] }`. With no `q` it returns today's orders.
  - `OrderSummary` is `{ id, orderNumber, kitchenOrderNumber, status, paymentStatus, totalCents, createdAt, locationName, seatNumber, customerName, phoneLast4, orderSource }`.
- **`GET /admin/orders/:id`** returns `{ order }`, the detail described in Step 3.

- [ ] **Step 1: Write the failing time tests**

```js
// packages/api/src/admin/__tests__/time.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { startOfDenverDay } from "../time.js";

test("winter (MST, UTC-7): local midnight is 07:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-01-15T20:00:00Z")).toISOString(), "2026-01-15T07:00:00.000Z");
});
test("summer (MDT, UTC-6): local midnight is 06:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-07-15T20:00:00Z")).toISOString(), "2026-07-15T06:00:00.000Z");
});
test("11:30 pm local still belongs to that local day", () => {
  // 2026-07-15 23:30 MDT = 2026-07-16T05:30Z
  assert.equal(startOfDenverDay(new Date("2026-07-16T05:30:00Z")).toISOString(), "2026-07-15T06:00:00.000Z");
});
test("DST start day (2026-03-08) starts at 07:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-03-08T18:00:00Z")).toISOString(), "2026-03-08T07:00:00.000Z");
});
test("DST end day (2026-11-01) starts at 06:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-11-01T18:00:00Z")).toISOString(), "2026-11-01T06:00:00.000Z");
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `cd packages/api && node --test src/admin/__tests__/time.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `time.js`**

```js
// packages/api/src/admin/time.js
const TZ = "America/Denver";

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Offset (ms) of Denver from UTC at the given instant: local wall time minus UTC. */
function offsetAt(date) {
  const p = zonedParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of local midnight on the Denver calendar day containing `now`. */
export function startOfDenverDay(now = new Date()) {
  const p = zonedParts(now);
  const guess = new Date(Date.UTC(p.y, p.m - 1, p.d) - offsetAt(now));
  // The offset at midnight can differ from now's on DST days; correct once.
  return new Date(Date.UTC(p.y, p.m - 1, p.d) - offsetAt(guess));
}
```

- [ ] **Step 4: Run the time tests and check they pass**

Run: `cd packages/api && node --test src/admin/__tests__/time.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing route tests**

Build a minimal Prisma stub inline, following the pattern in `plan/__tests__/routes.test.js`. Each model method records its args and returns fixtures.

```js
// packages/api/src/admin/__tests__/console-routes.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAdminConsoleRoutes } from "../console-routes.js";

function prismaStub() {
  const calls = {};
  const rec = (name, value) => async (args) => { (calls[name] ||= []).push(args); return value; };
  return {
    calls,
    order: {
      count: rec("order.count", 3),
      aggregate: rec("order.aggregate", { _sum: { totalCents: 4200 } }),
      findMany: rec("order.findMany", [{
        id: "o1", orderNumber: "A100", kitchenOrderNumber: "12", status: "PREPPING", paymentStatus: "PAID",
        totalCents: 1899, createdAt: new Date("2026-09-27T18:00:00Z"), orderSource: "WEB",
        guestName: "Mei", guestPhone: "8015550142", user: null,
        location: { name: "SoHo" }, seat: { number: 7 },
      }]),
      findFirst: rec("order.findFirst", null),
    },
    podCall: { count: rec("podCall.count", 2) },
    shopOrder: { count: rec("shopOrder.count", 1) },
    cateringEvent: { count: rec("cateringEvent.count", 4) },
    planQuestion: { count: rec("planQuestion.count", 5) },
    planNdaCountersigner: { findUnique: rec("planNdaCountersigner.findUnique", null) },
  };
}

async function build(role = "owner", prisma = prismaStub()) {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", async (req) => { req.adminRole = role; });
  await registerAdminConsoleRoutes(app, {
    prisma, resolveTenant: async () => ({ id: "t1" }), now: () => new Date("2026-09-27T20:00:00Z"),
  });
  await app.ready();
  return { app, prisma };
}

test("today: owner gets money and owner rows", async () => {
  const { app } = await build("owner");
  const body = (await app.inject({ url: "/admin/today" })).json();
  assert.equal(body.ordersToday, 3);
  assert.equal(body.salesCents, 4200);
  assert.equal(body.unansweredQuestions, 5);
  assert.equal(body.countersignerMissing, true);
});

test("today: manager never receives sales or owner rows", async () => {
  const { app } = await build("manager");
  const body = (await app.inject({ url: "/admin/today" })).json();
  assert.equal(body.ordersToday, 3);
  assert.ok(!("salesCents" in body));
  assert.ok(!("unansweredQuestions" in body));
  assert.ok(!("countersignerMissing" in body));
});

test("today: counts start at Denver midnight and honour locationId", async () => {
  const { app, prisma } = await build("owner");
  await app.inject({ url: "/admin/today?locationId=L1" });
  const where = prisma.calls["order.count"][0].where;
  assert.equal(where.createdAt.gte.toISOString(), "2026-09-27T06:00:00.000Z");
  assert.equal(where.locationId, "L1");
  assert.equal(where.tenantId, "t1");
});

test("orders: search masks phone to last 4 and flattens names", async () => {
  const { app, prisma } = await build("manager");
  const body = (await app.inject({ url: "/admin/orders?q=mei" })).json();
  assert.deepEqual(body.orders[0], {
    id: "o1", orderNumber: "A100", kitchenOrderNumber: "12", status: "PREPPING", paymentStatus: "PAID",
    totalCents: 1899, createdAt: "2026-09-27T18:00:00.000Z", orderSource: "WEB",
    locationName: "SoHo", seatNumber: 7, customerName: "Mei", phoneLast4: "0142",
  });
  const where = prisma.calls["order.findMany"][0].where;
  assert.ok(Array.isArray(where.OR), "search uses OR across fields");
});

test("orders: blank q lists today; limit is capped at 100", async () => {
  const { app, prisma } = await build("manager");
  await app.inject({ url: "/admin/orders?limit=5000" });
  const args = prisma.calls["order.findMany"][0];
  assert.equal(args.take, 100);
  assert.equal(args.where.createdAt.gte.toISOString(), "2026-09-27T06:00:00.000Z");
});

test("order detail: 404 when missing", async () => {
  const { app } = await build("manager");
  assert.equal((await app.inject({ url: "/admin/orders/nope" })).statusCode, 404);
});
```

- [ ] **Step 6: Run them and check they fail**

Run: `cd packages/api && node --test src/admin/__tests__/console-routes.test.js`
Expected: FAIL, module not found.

- [ ] **Step 7: Implement `console-routes.js`**

First check the relation names on `Order` (`schema.prisma:266`): `seat`, `location`, `user`, `items` (OrderItem with `menuItem`) and `podCalls`. Adjust the `include`/`select` below to match exactly.

```js
// packages/api/src/admin/console-routes.js
import { startOfDenverDay } from "./time.js";

const ACTIVE = ["QUEUED", "PREPPING", "READY", "SERVING"];
const COUNTED = { notIn: ["PENDING_PAYMENT", "CANCELLED"] };

const last4 = (phone) => (typeof phone === "string" && phone.replace(/\D/g, "").length >= 4
  ? phone.replace(/\D/g, "").slice(-4) : null);

function summary(o) {
  return {
    id: o.id, orderNumber: o.orderNumber, kitchenOrderNumber: o.kitchenOrderNumber ?? null,
    status: o.status, paymentStatus: o.paymentStatus, totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(), orderSource: o.orderSource,
    locationName: o.location?.name ?? null, seatNumber: o.seat?.number ?? null,
    customerName: o.user?.name || o.guestName || "Guest",
    phoneLast4: last4(o.user?.phone || o.guestPhone),
  };
}

export async function registerAdminConsoleRoutes(app, { prisma, resolveTenant, now = () => new Date() }) {
  async function tenantOr404(req, reply) {
    const tenant = await resolveTenant(req);
    if (!tenant) reply.code(404).send({ error: "Tenant not found" });
    return tenant;
  }

  app.get("/admin/today", async (req, reply) => {
    const tenant = await tenantOr404(req, reply);
    if (!tenant) return reply;
    const at = now();
    const dayStart = startOfDenverDay(at);
    const locationId = typeof req.query.locationId === "string" && req.query.locationId !== "all" ? req.query.locationId : undefined;
    const base = { tenantId: tenant.id, ...(locationId ? { locationId } : {}) };
    const in7 = new Date(at.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [ordersToday, activeDiners, openPodCalls, shopToShip, cateringNext7] = await Promise.all([
      prisma.order.count({ where: { ...base, createdAt: { gte: dayStart }, status: COUNTED } }),
      prisma.order.count({ where: { ...base, status: { in: ACTIVE } } }),
      prisma.podCall.count({ where: { ...(locationId ? { locationId } : {}), status: { in: ["PENDING", "ACKNOWLEDGED"] } } }),
      prisma.shopOrder.count({ where: { paymentStatus: "PAID", fulfillmentStatus: { in: ["PENDING", "PROCESSING"] } } }),
      prisma.cateringEvent.count({ where: { eventDate: { gte: dayStart, lt: in7 }, status: { not: "COMPLETED" } } }),
    ]);
    const body = { date: dayStart.toISOString(), ordersToday, activeDiners, openPodCalls, shopToShip, cateringNext7 };

    if (req.adminRole === "owner") {
      const [sales, unansweredQuestions, countersigner] = await Promise.all([
        prisma.order.aggregate({ _sum: { totalCents: true }, where: { ...base, createdAt: { gte: dayStart }, paymentStatus: "PAID" } }),
        prisma.planQuestion.count({ where: { answeredAt: null } }),
        prisma.planNdaCountersigner.findUnique({ where: { id: "default" } }),
      ]);
      body.salesCents = sales._sum.totalCents || 0;
      body.unansweredQuestions = unansweredQuestions;
      body.countersignerMissing = !countersigner;
    }
    return body;
  });

  app.get("/admin/orders", async (req, reply) => {
    const tenant = await tenantOr404(req, reply);
    if (!tenant) return reply;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const locationId = typeof req.query.locationId === "string" && req.query.locationId !== "all" ? req.query.locationId : undefined;
    const digits = q.replace(/\D/g, "");
    const where = { tenantId: tenant.id, ...(locationId ? { locationId } : {}) };
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { kitchenOrderNumber: q },
        { guestName: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        ...(digits.length >= 4 ? [{ guestPhone: { contains: digits } }, { user: { phone: { contains: digits } } }] : []),
      ];
    } else {
      where.createdAt = { gte: startOfDenverDay(now()) };
    }
    const rows = await prisma.order.findMany({
      where, take, orderBy: { createdAt: "desc" },
      include: { location: { select: { name: true } }, seat: { select: { number: true } }, user: { select: { name: true, phone: true } } },
    });
    return { orders: rows.map(summary) };
  });

  app.get("/admin/orders/:id", async (req, reply) => {
    const tenant = await tenantOr404(req, reply);
    if (!tenant) return reply;
    const o = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: {
        location: { select: { name: true } }, seat: { select: { number: true } },
        user: { select: { name: true, email: true, phone: true } },
        items: { include: { menuItem: { select: { name: true } } } },
        podCalls: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!o) return reply.code(404).send({ error: "Order not found" });
    return {
      order: {
        ...summary(o),
        customerEmail: o.user?.email ?? null,
        customerPhone: o.user?.phone || o.guestPhone || null,
        items: o.items.map((i) => ({ name: i.menuItem?.name ?? "Item", quantity: i.quantity, priceCents: i.priceCents, selectedValue: i.selectedValue ?? null })),
        taxCents: o.taxCents, promoDiscountCents: o.promoDiscountCents,
        paymentMethodBrand: o.paymentMethodBrand ?? null, paymentMethodLast4: o.paymentMethodLast4 ?? null,
        timeline: ["createdAt", "paidAt", "arrivedAt", "queuedAt", "prepStartTime", "readyTime", "deliveredAt", "completedTime"]
          .filter((k) => o[k]).map((k) => ({ step: k, at: new Date(o[k]).toISOString() })),
        podCalls: o.podCalls.map((c) => ({ id: c.id, reason: c.reason, status: c.status, createdAt: c.createdAt.toISOString() })),
      },
    };
  });
}
```

In `index.js`, beside `await registerPlanRoutes(app)`, add:

```js
await registerAdminConsoleRoutes(app, {
  prisma,
  resolveTenant: (req) => prisma.tenant.findUnique({ where: { slug: getTenantContext(req) }, select: { id: true } }),
});
```

`getTenantContext` is a function declaration, so it is hoisted.

- [ ] **Step 8: Run the tests and check they pass**

Run: `cd packages/api && pnpm test`
Expected: PASS.

- [ ] **Step 9: Test against the dev database**

Run the worktree API on :4010 and `curl -s localhost:4010/admin/today -H 'x-tenant-slug: oh' | jq` to see real counts. Then run `curl -s "localhost:4010/admin/orders?q=a" -H 'x-tenant-slug: oh' | jq '.orders[0]'`.

- [ ] **Step 10: Commit**

```bash
git add packages/api/src/admin packages/api/src/index.js
git commit -m "feat(api): admin today pulse and dine-in order lookup"
```

### Task 4: Team endpoints (owner)

**Files:**
- Create: `packages/api/src/admin/team-routes.js`
- Test: `packages/api/src/admin/__tests__/team-routes.test.js`
- Modify: `packages/api/src/index.js` (register it)

**Interfaces:**
- Consumes: `forget(userId)` (Task 1), passed as `forgetRole`; `adminEmails`.
- Produces: `registerTeamRoutes(app, { clerk, adminEmails, forgetRole, adminUrl })`, where `clerk` is `{ users: { getUserList, updateUserMetadata }, invitations: { getInvitationList, createInvitation, revokeInvitation } }`. Routes (owner-only through `adminPathRoles`):
  - `GET /admin/team` returns `{ members: [{ userId, email, name, role, locked }], invites: [{ id, email, role, createdAt }] }`. `locked` is true for `ADMIN_EMAILS` owners.
  - `POST /admin/team/invite {email, role: "manager"|"station"}`:
    - If a user with that email exists, updates their metadata and returns `{ kind: "updated" }`.
    - Otherwise creates a Clerk invitation (`publicMetadata: {adminRole}`, `redirectUrl: adminUrl + "/sign-up"`) and returns `{ kind: "invited" }`.
  - `PATCH /admin/team/:userId {role: "manager"|"station"|null}` returns `{ ok: true }`. A locked owner returns 409. It calls `forgetRole(userId)`.
  - `DELETE /admin/team/invites/:id` returns `{ ok: true }`.

- [ ] **Step 1: Write the failing tests** using a stub Clerk client:

```js
// packages/api/src/admin/__tests__/team-routes.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerTeamRoutes } from "../team-routes.js";

function clerkStub() {
  const calls = [];
  const users = [
    { id: "u1", firstName: "Dan", lastName: "O", primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "owner@x.com" }], publicMetadata: {} },
    { id: "u2", firstName: "Mia", lastName: "", primaryEmailAddressId: "e2", emailAddresses: [{ id: "e2", emailAddress: "mia@x.com" }], publicMetadata: { adminRole: "manager" } },
    { id: "u3", firstName: "Guest", lastName: "", primaryEmailAddressId: "e3", emailAddresses: [{ id: "e3", emailAddress: "g@x.com" }], publicMetadata: {} },
  ];
  return {
    calls,
    users: {
      getUserList: async (args) => { calls.push(["getUserList", args]); const e = args?.emailAddress?.[0]; return { data: e ? users.filter((u) => u.emailAddresses[0].emailAddress === e) : users }; },
      updateUserMetadata: async (id, body) => { calls.push(["updateUserMetadata", id, body]); return {}; },
    },
    invitations: {
      getInvitationList: async () => ({ data: [{ id: "i1", emailAddress: "new@x.com", publicMetadata: { adminRole: "station" }, createdAt: 1 }] }),
      createInvitation: async (body) => { calls.push(["createInvitation", body]); return { id: "i2" }; },
      revokeInvitation: async (id) => { calls.push(["revokeInvitation", id]); return {}; },
    },
  };
}

async function build() {
  const clerk = clerkStub();
  const forgotten = [];
  const app = Fastify({ logger: false });
  await registerTeamRoutes(app, { clerk, adminEmails: ["owner@x.com"], forgetRole: (id) => forgotten.push(id), adminUrl: "https://admin.test" });
  await app.ready();
  return { app, clerk, forgotten };
}

test("lists only admin members plus pending invites; allowlisted owner is locked", async () => {
  const { app } = await build();
  const body = (await app.inject({ url: "/admin/team" })).json();
  assert.deepEqual(body.members.map((m) => [m.email, m.role, m.locked]), [["owner@x.com", "owner", true], ["mia@x.com", "manager", false]]);
  assert.deepEqual(body.invites.map((i) => [i.email, i.role]), [["new@x.com", "station"]]);
});

test("invite: existing user is updated, new email gets an invitation", async () => {
  const { app, clerk } = await build();
  const a = await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "g@x.com", role: "station" } });
  assert.equal(a.json().kind, "updated");
  const b = await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "NEW2@x.com", role: "manager" } });
  assert.equal(b.json().kind, "invited");
  const inv = clerk.calls.find((c) => c[0] === "createInvitation")[1];
  assert.deepEqual(inv, { emailAddress: "new2@x.com", publicMetadata: { adminRole: "manager" }, redirectUrl: "https://admin.test/sign-up", ignoreExisting: true });
});

test("invite rejects owner role and bad emails", async () => {
  const { app } = await build();
  assert.equal((await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "x@x.com", role: "owner" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "nope", role: "manager" } })).statusCode, 400);
});

test("patch: locked owner is 409; others update and forget the cached role", async () => {
  const { app, forgotten } = await build();
  assert.equal((await app.inject({ method: "PATCH", url: "/admin/team/u1", payload: { role: "manager" } })).statusCode, 409);
  const res = await app.inject({ method: "PATCH", url: "/admin/team/u2", payload: { role: null } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(forgotten, ["u2"]);
});
```

The PATCH handler needs the user's email to decide `locked`. Add `getUser: async (id) => users.find((u) => u.id === id)` to the stub's `users`.

- [ ] **Step 2: Run them and check they fail**

Run: `cd packages/api && node --test src/admin/__tests__/team-routes.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// packages/api/src/admin/team-routes.js
import { roleFor } from "../auth/admin.js";

const INVITABLE = ["manager", "station"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const primaryEmail = (u) => (u.emailAddresses || []).find((e) => e.id === u.primaryEmailAddressId)?.emailAddress?.toLowerCase() ?? null;

export async function registerTeamRoutes(app, { clerk, adminEmails, forgetRole, adminUrl }) {
  app.get("/admin/team", async () => {
    const [{ data: users }, { data: invites }] = await Promise.all([
      clerk.users.getUserList({ limit: 200 }),
      clerk.invitations.getInvitationList({ status: "pending" }),
    ]);
    const members = users
      .map((u) => {
        const email = primaryEmail(u);
        const role = roleFor({ email, metadata: u.publicMetadata, adminEmails });
        return role && { userId: u.id, email, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null, role, locked: adminEmails.includes(email) };
      })
      .filter(Boolean);
    return {
      members,
      invites: invites
        .filter((i) => INVITABLE.includes(i.publicMetadata?.adminRole))
        .map((i) => ({ id: i.id, email: i.emailAddress, role: i.publicMetadata.adminRole, createdAt: new Date(i.createdAt).toISOString() })),
    };
  });

  app.post("/admin/team/invite", async (req, reply) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = req.body?.role;
    if (!EMAIL_RE.test(email) || !INVITABLE.includes(role)) return reply.code(400).send({ error: "Enter an email and choose manager or station." });
    if (adminEmails.includes(email)) return reply.code(409).send({ error: "That person is already an owner." });
    const { data: existing } = await clerk.users.getUserList({ emailAddress: [email] });
    if (existing.length > 0) {
      await clerk.users.updateUserMetadata(existing[0].id, { publicMetadata: { adminRole: role } });
      forgetRole(existing[0].id);
      return { kind: "updated" };
    }
    await clerk.invitations.createInvitation({ emailAddress: email, publicMetadata: { adminRole: role }, redirectUrl: `${adminUrl}/sign-up`, ignoreExisting: true });
    return { kind: "invited" };
  });

  app.patch("/admin/team/:userId", async (req, reply) => {
    const role = req.body?.role ?? null;
    if (role !== null && !INVITABLE.includes(role)) return reply.code(400).send({ error: "Role must be manager, station or none." });
    const user = await clerk.users.getUser(req.params.userId);
    if (adminEmails.includes(primaryEmail(user))) return reply.code(409).send({ error: "Owners on the allowlist can't be changed here." });
    await clerk.users.updateUserMetadata(req.params.userId, { publicMetadata: { adminRole: role } });
    forgetRole(req.params.userId);
    return { ok: true };
  });

  app.delete("/admin/team/invites/:id", async (req) => {
    await clerk.invitations.revokeInvitation(req.params.id);
    return { ok: true };
  });
}
```

In `index.js`:

```js
import { createClerkClient } from "@clerk/backend";
import { registerTeamRoutes } from "./admin/team-routes.js";
// after registerAdminConsoleRoutes:
if (process.env.CLERK_SECRET_KEY) {
  await registerTeamRoutes(app, {
    clerk: createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    adminEmails: parseAdminEmails(process.env.ADMIN_EMAILS),
    forgetRole: forgetAdminRole,
    adminUrl: process.env.ADMIN_URL || "https://admin-oh-beef-noodle-soup.vercel.app",
  });
}
```

`parseAdminEmails` is imported from `./auth/admin.js`.

- [ ] **Step 4: Run the tests and check they pass**

Run: `cd packages/api && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/admin/team-routes.js packages/api/src/admin/__tests__/team-routes.test.js packages/api/src/index.js
git commit -m "feat(api): owner team management via Clerk roles"
```

### Task 5: Admin foundation (Tailwind, Night tokens, fonts, alias, vitest, manifest)

**Files:**
- Modify: `apps/admin/package.json`, `apps/admin/tsconfig.json`, `apps/admin/app/layout.tsx`
- Create:
  - `apps/admin/postcss.config.mjs`, `apps/admin/app/globals.css`, `apps/admin/lib/fonts.ts`
  - `apps/admin/vitest.config.ts`, `apps/admin/app/manifest.ts`
  - `apps/admin/public/icon-192.png`, `apps/admin/public/icon-512.png`, `apps/admin/public/apple-touch-icon.png`
- Test: `apps/admin/lib/__tests__/tokens.test.ts`

**Interfaces:**
- Produces:
  - Tailwind classes such as `bg-oh-charcoal`, `text-oh-cream`, `font-display`, `font-body`, `rounded-card` and `shadow-card`.
  - The `@/` import alias, which maps to `apps/admin/`.
  - `pnpm --filter @oh/admin test` runs vitest.

- [ ] **Step 1: Add the dependencies**

Run: `pnpm --filter @oh/admin add -D tailwindcss@^4.3.3 @tailwindcss/postcss@^4.3.3 vitest@^5.0.1`. The versions match `apps/web/package.json`.

In `apps/admin/package.json`, add `"test": "vitest run"` to `scripts`.

- [ ] **Step 2: Write the failing token test.** It guards against the palette drifting from the website.

```ts
// apps/admin/lib/__tests__/tokens.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const admin = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const web = readFileSync(path.resolve(__dirname, "../../../web/app/globals.css"), "utf8");
const tokens = (css: string) => Object.fromEntries([...css.matchAll(/--color-oh-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]));

describe("Night tokens", () => {
  test("every web token exists in admin with the same value", () => {
    const a = tokens(admin);
    for (const [name, hex] of Object.entries(tokens(web))) expect(a[name], name).toBe(hex);
  });
  test("admin adds linen", () => expect(tokens(admin).linen).toBe("#EDE6DA"));
});
```

- [ ] **Step 3: Configure vitest, the alias and postcss**

```ts
// apps/admin/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for admin helpers and source guards. Run: pnpm --filter @oh/admin test
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["lib/**/__tests__/**/*.test.ts", "components/**/__tests__/**/*.test.ts"], environment: "node" },
});
```

In `tsconfig.json`, under `compilerOptions`, add `"baseUrl": "."` and `"paths": { "@/*": ["./*"] }`.

```js
// apps/admin/postcss.config.mjs
// Tailwind v4 with no preflight (see app/globals.css) so Kitchen and Cleaning inline styles are untouched.
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

- [ ] **Step 4: Write `globals.css`**

```css
/*
 * Tailwind v4 for the admin console. Mirrors apps/web/app/globals.css: theme
 * plus unlayered utilities, no preflight, so the Kitchen and Cleaning displays
 * (inline styles) render exactly as before. Palette values must match the web
 * app; lib/__tests__/tokens.test.ts enforces it.
 */
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css";
@source "../app";
@source "../components";
@source "../lib";

@theme {
  --color-oh-charcoal: #1C1B19;
  --color-oh-ink: #2A2724;
  --color-oh-stone: #3A3632;
  --color-oh-ash: #8A8178;
  --color-oh-mute: #9A9188;
  --color-oh-cream: #F2EDE4;
  --color-oh-paper: #FAF7F1;
  --color-oh-linen: #EDE6DA;
  --color-oh-ember: #C1502E;
  --color-oh-ember-light: #E07A5A;
  --color-oh-ember-deep: #A94422;
  --color-oh-olive: #6B7355;
  --color-oh-olive-light: #8F9A75;
  --color-oh-gold: #C9A227;
  --color-oh-clay: #8C5A3C;
  --radius-card: 14px;
  --shadow-card: 0 1px 2px rgb(28 27 25 / 0.06), 0 4px 16px rgb(28 27 25 / 0.05);
}

@theme inline {
  --font-display: var(--font-instrument-serif), Georgia, "Times New Roman", serif;
  --font-body: var(--font-raleway), system-ui, -apple-system, "Segoe UI", sans-serif;
}

/* Console-only base: scoped to .oh-console so display routes keep browser defaults. */
.oh-console { font-family: var(--font-body); color: var(--color-oh-charcoal); background: var(--color-oh-paper); -webkit-tap-highlight-color: transparent; }
.oh-console *, .oh-console *::before, .oh-console *::after { box-sizing: border-box; }
.oh-console :where(h1, h2, h3, p) { margin: 0; }
.oh-console :where(button) { font: inherit; cursor: pointer; }
.oh-console :where(input, select, textarea) { font: inherit; font-size: max(16px, 1em); }
.oh-console :where(a) { color: inherit; text-decoration: none; }
.oh-console :focus-visible { outline: 2px solid var(--color-oh-gold); outline-offset: 2px; }

@keyframes oh-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes oh-sheet-up { from { transform: translateY(100%) } to { transform: none } }
@keyframes oh-sheet-left { from { transform: translateX(100%) } to { transform: none } }
@keyframes oh-toast-in { from { transform: translateY(12px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes oh-pulse { 50% { opacity: .45 } }
@media (prefers-reduced-motion: reduce) { .oh-console * { animation: none !important; transition: none !important; } }
```

- [ ] **Step 5: Fonts, root layout and manifest**

```ts
// apps/admin/lib/fonts.ts
import { Instrument_Serif, Raleway } from "next/font/google";

export const instrumentSerif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-instrument-serif", display: "swap" });
export const raleway = Raleway({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-raleway", display: "swap" });
export const fontVariables = `${instrumentSerif.variable} ${raleway.variable}`;
```

The root layout keeps only the providers. The chrome moves to `(console)/layout.tsx` in Task 11.

```tsx
// apps/admin/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ApiAuthInit from "../components/ApiAuthInit";
import { fontVariables } from "../lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Oh! Admin", template: "%s · Oh! Admin" },
  appleWebApp: { capable: true, title: "Oh! Admin", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1C1B19" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={fontVariables}>
        <body style={{ margin: 0 }}>
          <ApiAuthInit />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

```ts
// apps/admin/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oh! Admin", short_name: "Oh! Admin", start_url: "/", display: "standalone",
    background_color: "#1C1B19", theme_color: "#1C1B19",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

Generate the icons from `apps/admin/public/Oh_Logo_Mark_Light.png`, centred on charcoal `#1C1B19` with about 18% padding, at 192, 512 and 180 (`apple-touch-icon.png`). Use `sharp`, which the web app already has, in a one-off `node -e` script. Don't commit the script.

Until Task 11 moves the old chrome, the pages temporarily render with no nav. That's expected mid-branch.

- [ ] **Step 6: Run the tests and a build**

Run: `pnpm --filter @oh/admin test && pnpm --filter @oh/admin build`
Expected: the tests PASS and the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/package.json pnpm-lock.yaml apps/admin/tsconfig.json apps/admin/postcss.config.mjs apps/admin/app/globals.css apps/admin/lib/fonts.ts apps/admin/app/layout.tsx apps/admin/app/manifest.ts apps/admin/public/icon-192.png apps/admin/public/icon-512.png apps/admin/public/apple-touch-icon.png apps/admin/vitest.config.ts apps/admin/lib/__tests__/tokens.test.ts
git commit -m "feat(admin): Tailwind v4, Night tokens, fonts and home screen manifest"
```

### Task 6: Access map and nav model

**Files:**
- Create: `apps/admin/lib/access.ts`, `apps/admin/lib/nav.ts`
- Test: `apps/admin/lib/__tests__/access.test.ts`, `apps/admin/lib/__tests__/nav.test.ts`

**Interfaces:**
- Produces:
  - `type AdminRole = "owner" | "manager" | "station"`, `ROLES`, `parseRole(v: unknown): AdminRole | null`
  - `canAccess(role: AdminRole | null, pathname: string): boolean`
  - `homeFor(role: AdminRole): string`
  - `decide(role: AdminRole | null, pathname: string): { kind: "next" } | { kind: "redirect"; to: string }`
  - `type IconName` (string union, defined in `components/ui/icons.tsx` in Task 9; until then `nav.ts` declares `type IconName = string` and Task 9 swaps in the import)
  - `type NavItem = { href: string; label: string; icon: IconName }`
  - `DOCK_ITEMS: NavItem[]` (Today, Orders, Menu)
  - `NAV_GROUPS: { title: string; items: NavItem[] }[]`
  - `navFor(role): { dock: NavItem[]; groups: { title: string; items: NavItem[] }[] }`
  - `activeHref(pathname: string, hrefs: string[]): string | null`
  - `HAS_SUPPORT: boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/admin/lib/__tests__/access.test.ts
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { canAccess, decide, homeFor, parseRole, ACCESS_RULES } from "../access";

describe("canAccess", () => {
  test("owner sees everything", () => {
    for (const p of ["/", "/plan-access", "/analytics/revenue", "/team", "/kitchen", "/gift-cards/config"]) expect(canAccess("owner", p)).toBe(true);
  });
  test("manager: day-to-day yes, owner areas no", () => {
    for (const p of ["/", "/orders", "/menu", "/promos", "/gift-cards/abc", "/catering/1", "/cleaning/config", "/analytics", "/analytics/operations", "/kitchen"]) expect(canAccess("manager", p), p).toBe(true);
    for (const p of ["/plan-access", "/plan-access/x", "/analytics/revenue", "/analytics/customers", "/analytics/funnel", "/locations", "/tenants", "/kiosks", "/team", "/gift-cards/config"]) expect(canAccess("manager", p), p).toBe(false);
  });
  test("station: displays only", () => {
    expect(canAccess("station", "/kitchen")).toBe(true);
    expect(canAccess("station", "/cleaning")).toBe(true);
    for (const p of ["/", "/cleaning/config", "/menu", "/orders"]) expect(canAccess("station", p), p).toBe(false);
  });
  test("public paths need no role; unknown paths are owner-only", () => {
    expect(canAccess(null, "/unauthorized")).toBe(true);
    expect(canAccess(null, "/sign-in/factor-one")).toBe(true);
    expect(canAccess(null, "/")).toBe(false);
    expect(canAccess("manager", "/some-new-page")).toBe(false);
  });
  test("prefix match does not bleed across names", () => {
    expect(canAccess("manager", "/menu-secret")).toBe(false);
  });
});

describe("decide", () => {
  test("no role goes to /unauthorized; station goes to /kitchen; manager to /", () => {
    expect(decide(null, "/menu")).toEqual({ kind: "redirect", to: "/unauthorized" });
    expect(decide("station", "/")).toEqual({ kind: "redirect", to: "/kitchen" });
    expect(decide("manager", "/team")).toEqual({ kind: "redirect", to: "/" });
    expect(decide("manager", "/menu")).toEqual({ kind: "next" });
  });
  test("homeFor", () => { expect(homeFor("station")).toBe("/kitchen"); expect(homeFor("owner")).toBe("/"); });
  test("parseRole", () => { expect(parseRole("manager")).toBe("manager"); expect(parseRole("x")).toBeNull(); expect(parseRole(null)).toBeNull(); });
});

describe("every page has a rule", () => {
  test("each app route segment is covered by ACCESS_RULES or public", () => {
    const appDir = path.resolve(__dirname, "../../app");
    const pages: string[] = [];
    const walk = (dir: string, route: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name.startsWith("_") || name === "api") continue;
          const seg = name.startsWith("(") ? "" : name.startsWith("[") ? "x" : name;
          walk(full, seg ? `${route}/${seg}` : route);
        } else if (name === "page.tsx") pages.push(route || "/");
      }
    };
    walk(appDir, "");
    const covered = (p: string) => p.startsWith("/unauthorized") || p.startsWith("/sign-") || ACCESS_RULES.some((r) => (r.exact ? p === r.path : p === r.path || p.startsWith(r.path + "/")));
    expect(pages.filter((p) => !covered(p))).toEqual([]);
  });
});
```

```ts
// apps/admin/lib/__tests__/nav.test.ts
import { describe, expect, test } from "vitest";
import { activeHref, navFor, NAV_GROUPS, DOCK_ITEMS } from "../nav";
import { canAccess } from "../access";

describe("navFor", () => {
  test("never shows an item the role can't open", () => {
    for (const role of ["owner", "manager", "station"] as const) {
      const { dock, groups } = navFor(role);
      for (const item of [...dock, ...groups.flatMap((g) => g.items)]) expect(canAccess(role, item.href), `${role} ${item.href}`).toBe(true);
    }
  });
  test("manager has no Owner group; empty groups are dropped", () => {
    expect(navFor("manager").groups.map((g) => g.title)).toEqual(["Sell", "Stores", "Insights"]);
    expect(navFor("station").dock).toEqual([]);
    expect(navFor("station").groups.map((g) => g.title)).toEqual(["Stores"]);
  });
  test("every nav href is unique", () => {
    const hrefs = [...DOCK_ITEMS, ...NAV_GROUPS.flatMap((g) => g.items)].map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("activeHref", () => {
  const hrefs = ["/", "/cleaning", "/cleaning/config", "/gift-cards", "/gift-cards/config", "/orders"];
  test("longest prefix wins; / only matches exactly", () => {
    expect(activeHref("/cleaning/config", hrefs)).toBe("/cleaning/config");
    expect(activeHref("/cleaning", hrefs)).toBe("/cleaning");
    expect(activeHref("/gift-cards/abc123", hrefs)).toBe("/gift-cards");
    expect(activeHref("/", hrefs)).toBe("/");
    expect(activeHref("/orders/o1", hrefs)).toBe("/orders");
    expect(activeHref("/menu", hrefs)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm --filter @oh/admin test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

```ts
// apps/admin/lib/access.ts
/**
 * Single source of truth for who can open which admin page. Middleware,
 * the nav and the page guards all read this. The API enforces the same
 * split on its side (packages/api/src/auth/console-guard.js).
 */
export type AdminRole = "owner" | "manager" | "station";
export const ROLES: readonly AdminRole[] = ["owner", "manager", "station"];

const O: AdminRole[] = ["owner"];
const S: AdminRole[] = ["owner", "manager"];
const F: AdminRole[] = ["owner", "manager", "station"];

export type AccessRule = { path: string; roles: AdminRole[]; exact?: boolean };

export const ACCESS_RULES: AccessRule[] = [
  { path: "/", roles: S, exact: true },
  { path: "/orders", roles: S },
  { path: "/shop-orders", roles: S },
  { path: "/support", roles: S },
  { path: "/menu", roles: S },
  { path: "/promos", roles: S },
  { path: "/gift-cards", roles: S },
  { path: "/gift-cards/config", roles: O },
  { path: "/products", roles: S },
  { path: "/catering", roles: S },
  { path: "/kitchen", roles: F },
  { path: "/cleaning", roles: F },
  { path: "/cleaning/config", roles: S },
  { path: "/analytics", roles: S },
  { path: "/analytics/revenue", roles: O },
  { path: "/analytics/customers", roles: O },
  { path: "/analytics/funnel", roles: O },
  { path: "/plan-access", roles: O },
  { path: "/locations", roles: O },
  { path: "/tenants", roles: O },
  { path: "/kiosks", roles: O },
  { path: "/team", roles: O },
  { path: "/ui-kit", roles: S },
];

export const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/unauthorized"];

const matches = (rule: AccessRule, p: string) => (rule.exact ? p === rule.path : p === rule.path || p.startsWith(rule.path + "/"));

export function parseRole(value: unknown): AdminRole | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value) ? (value as AdminRole) : null;
}

export function ruleFor(pathname: string): AccessRule | undefined {
  return ACCESS_RULES.filter((r) => matches(r, pathname)).sort((a, b) => b.path.length - a.path.length)[0];
}

export function canAccess(role: AdminRole | null, pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (!role) return false;
  const rule = ruleFor(pathname);
  return rule ? rule.roles.includes(role) : role === "owner";
}

export function homeFor(role: AdminRole): string {
  return role === "station" ? "/kitchen" : "/";
}

export type Decision = { kind: "next" } | { kind: "redirect"; to: string };

export function decide(role: AdminRole | null, pathname: string): Decision {
  if (canAccess(role, pathname)) return { kind: "next" };
  return { kind: "redirect", to: role ? homeFor(role) : "/unauthorized" };
}
```

```ts
// apps/admin/lib/nav.ts
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

export function activeHref(pathname: string, hrefs: string[]): string | null {
  const hits = hrefs.filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")));
  return hits.sort((a, b) => b.length - a.length)[0] ?? null;
}
```

Until Task 9 creates `components/ui/icons.tsx`, create it with just `export type IconName = string;` so this compiles. Task 9 replaces it.

- [ ] **Step 4: Run the tests and check they pass**

Run: `pnpm --filter @oh/admin test`
Expected: PASS. The "every page has a rule" test passes on the current tree: `/tenants`, `/unauthorized` and the rest are covered.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/access.ts apps/admin/lib/nav.ts apps/admin/components/ui/icons.tsx apps/admin/lib/__tests__/access.test.ts apps/admin/lib/__tests__/nav.test.ts
git commit -m "feat(admin): role access map and grouped nav model"
```

### Task 7: Role-aware middleware

**Files:**
- Create: `apps/admin/lib/roles.ts`
- Modify: `apps/admin/middleware.ts`
- Test: `apps/admin/lib/__tests__/roles.test.ts`

**Interfaces:**
- Consumes: `decide`, `parseRole`, `AdminRole` (Task 6).
- Produces:
  - `ROLE_HEADER = "x-admin-role"` and `DEFAULT_OWNER_EMAILS`
  - `ownerEmails(env?: string): string[]`
  - `resolveRole(email, metadata, owners?): AdminRole | null`
  - `devRole(env?: string): AdminRole`
  - `requestHeadersWithRole(incoming: Headers, role: AdminRole | null): Headers`, which always overwrites the header
- The middleware forwards `x-admin-role` to server components.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/admin/lib/__tests__/roles.test.ts
import { describe, expect, test } from "vitest";
import { devRole, ownerEmails, requestHeadersWithRole, resolveRole, ROLE_HEADER } from "../roles";

describe("resolveRole", () => {
  const owners = ["owner@x.com"];
  test("owner allowlist wins, case-insensitive", () => expect(resolveRole("OWNER@x.com", { adminRole: "station" }, owners)).toBe("owner"));
  test("metadata role otherwise", () => expect(resolveRole("m@x.com", { adminRole: "manager" }, owners)).toBe("manager"));
  test("nothing valid is null", () => {
    expect(resolveRole("m@x.com", { adminRole: "boss" }, owners)).toBeNull();
    expect(resolveRole(undefined, undefined, owners)).toBeNull();
  });
});

test("ownerEmails parses env and falls back to the defaults", () => {
  expect(ownerEmails(" A@x.com, b@x.com ")).toEqual(["a@x.com", "b@x.com"]);
  expect(ownerEmails("")).toEqual(["danodeen@me.com", "danodeen@gmail.com"]);
});

test("devRole", () => { expect(devRole("manager")).toBe("manager"); expect(devRole("x")).toBe("owner"); expect(devRole(undefined)).toBe("owner"); });

test("requestHeadersWithRole overwrites a spoofed header", () => {
  const h = requestHeadersWithRole(new Headers({ [ROLE_HEADER]: "owner", cookie: "c" }), "manager");
  expect(h.get(ROLE_HEADER)).toBe("manager");
  expect(h.get("cookie")).toBe("c");
  expect(requestHeadersWithRole(new Headers({ [ROLE_HEADER]: "owner" }), null).get(ROLE_HEADER)).toBeNull();
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm --filter @oh/admin test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// apps/admin/lib/roles.ts
import { parseRole, type AdminRole } from "./access";

export const ROLE_HEADER = "x-admin-role";
export const DEFAULT_OWNER_EMAILS = ["danodeen@me.com", "danodeen@gmail.com"];

export function ownerEmails(env: string | undefined = process.env.OWNER_EMAILS): string[] {
  const list = (env || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_OWNER_EMAILS;
}

/** Same rule as the API's roleFor: allowlisted email is owner, else Clerk publicMetadata.adminRole. */
export function resolveRole(email: string | null | undefined, metadata: Record<string, unknown> | null | undefined, owners = ownerEmails()): AdminRole | null {
  if (email && owners.includes(email.toLowerCase())) return "owner";
  return parseRole(metadata?.adminRole);
}

/** Local dev skips Clerk; ADMIN_DEV_ROLE lets you preview the console as manager or station. */
export function devRole(env: string | undefined = process.env.ADMIN_DEV_ROLE): AdminRole {
  return parseRole(env) ?? "owner";
}

export function requestHeadersWithRole(incoming: Headers, role: AdminRole | null): Headers {
  const headers = new Headers(incoming);
  headers.delete(ROLE_HEADER);
  if (role) headers.set(ROLE_HEADER, role);
  return headers;
}
```

Replace `withClerk` in `middleware.ts`. Keep the foreign-cookie wrapper and the `config.matcher` exactly as they are.

```ts
import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { expireForeignHandshakeCookies, withoutForeignHandshakeCookies } from "./lib/clerk-foreign-cookies";
import { decide, type AdminRole } from "./lib/access";
import { devRole, requestHeadersWithRole, resolveRole } from "./lib/roles";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/unauthorized(.*)"]);

const withClerk = clerkMiddleware(async (auth, request) => {
  let role: AdminRole | null = null;
  if (process.env.NODE_ENV === "development") {
    role = devRole();
  } else if (!isPublicRoute(request)) {
    const { userId } = await auth.protect();
    const user = await (await clerkClient()).users.getUser(userId);
    const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
    role = resolveRole(email, user.publicMetadata as Record<string, unknown>);
  }
  const decision = decide(role, request.nextUrl.pathname);
  if (decision.kind === "redirect") return NextResponse.redirect(new URL(decision.to, request.url));
  return NextResponse.next({ request: { headers: requestHeadersWithRole(request.headers, role) } });
});
```

- [ ] **Step 4: Run the tests and a type check**

Run: `pnpm --filter @oh/admin test && pnpm --filter @oh/admin exec tsc --noEmit -p .`
Expected: the tests PASS. `tsc` shows no new errors in `lib/` or `middleware.ts`; the pre-existing React type noise in untouched files is acceptable, per `next.config.mjs`.

- [ ] **Step 5: Manual check in dev**

Run `ADMIN_DEV_ROLE=station pnpm --filter @oh/admin exec next dev -p 3011`.
- `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" localhost:3011/menu` returns 307 to `/kitchen`.
- Restart with `ADMIN_DEV_ROLE=manager`. `/team` returns 307 to `/`.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/lib/roles.ts apps/admin/middleware.ts apps/admin/lib/__tests__/roles.test.ts
git commit -m "feat(admin): role-aware middleware with station and manager routing"
```

### Task 8: API client, URLs and location context

**Files:**
- Create: `apps/admin/lib/api.ts`, `apps/admin/lib/api-server.ts`, `apps/admin/lib/urls.ts`, `apps/admin/lib/format.ts`
- Create: `apps/admin/components/providers/LocationProvider.tsx`, `apps/admin/components/providers/RoleProvider.tsx`
- Test: `apps/admin/lib/__tests__/api.test.ts`, `apps/admin/lib/__tests__/format.test.ts`

**Interfaces:**
- Produces:
  - `API_BASE`, and `class ApiError extends Error { status: number; body: unknown }`
  - `api<T>(path, opts?: { method?; body?; signal?; query?: Record<string, string | number | boolean | undefined | null> }) → Promise<T>`. It sends JSON and `x-tenant-slug: oh`; `ApiAuthInit` adds the Bearer.
  - `serverApi<T>(path)`, a server component fetch that forwards the Clerk token.
  - `webUrl(): string` (the logic from kiosks and catering) and `planInviteUrl(code)`.
  - `money(cents): string`, `shortDate(iso)`, `relativeTime(iso, now?)` and `denverDateTime(iso)`.
  - `useLocationFilter(): { locations: Location[]; locationId: string; setLocationId(id: string): void }`, where `"all"` means every location and the choice is saved in `localStorage` `oh-admin-location`.
  - `useRole(): AdminRole` and `<RoleProvider role>`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/admin/lib/__tests__/api.test.ts
import { afterEach, expect, test, vi } from "vitest";
import { api, ApiError } from "../api";

afterEach(() => vi.unstubAllGlobals());

test("sends tenant header, JSON body and query; returns parsed JSON", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  const out = await api<{ ok: number }>("/menu/1", { method: "PATCH", body: { isAvailable: false }, query: { a: "x", b: undefined } });
  expect(out).toEqual({ ok: 1 });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url.endsWith("/menu/1?a=x")).toBe(true);
  expect((init.headers as Record<string, string>)["x-tenant-slug"]).toBe("oh");
  expect(init.body).toBe(JSON.stringify({ isAvailable: false }));
});

test("throws ApiError with the server's error message", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Nope" }), { status: 403 })));
  await expect(api("/x")).rejects.toMatchObject({ status: 403, message: "Nope" });
  await expect(api("/x")).rejects.toBeInstanceOf(ApiError);
});

test("network failure becomes a friendly ApiError", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
  await expect(api("/x")).rejects.toMatchObject({ status: 0, message: "Can't reach the server. Check your connection." });
});
```

```ts
// apps/admin/lib/__tests__/format.test.ts
import { expect, test } from "vitest";
import { money, relativeTime } from "../format";

test("money", () => { expect(money(123456)).toBe("$1,234.56"); expect(money(0)).toBe("$0.00"); expect(money(null)).toBe("$0.00"); });
test("relativeTime", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  expect(relativeTime("2026-09-27T11:59:30Z", now)).toBe("Just now");
  expect(relativeTime("2026-09-27T11:45:00Z", now)).toBe("15m ago");
  expect(relativeTime("2026-09-27T09:00:00Z", now)).toBe("3h ago");
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm --filter @oh/admin test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

```ts
// apps/admin/lib/api.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown = null) { super(message); }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path;
}

/** Client fetch to the API. ApiAuthInit adds the Clerk Bearer token. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal; query?: Query } = {}): Promise<T> {
  const headers: Record<string, string> = { "x-tenant-slug": "oh" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${withQuery(path, opts.query)}`, {
      method: opts.method || "GET", headers, signal: opts.signal, cache: "no-store",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
      ? (data as { error: string }).error : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}
```

```ts
// apps/admin/lib/api-server.ts
import "server-only";
import { auth } from "@clerk/nextjs/server";
import { API_BASE, ApiError, withQuery } from "./api";

/** Server component fetch that forwards the signed-in user's Clerk token. */
export async function serverApi<T>(path: string, query?: Parameters<typeof withQuery>[1]): Promise<T> {
  const headers: Record<string, string> = { "x-tenant-slug": "oh" };
  if (process.env.NODE_ENV !== "development") {
    const token = await (await auth()).getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${withQuery(path, query)}`, { cache: "no-store", headers });
  if (!res.ok) throw new ApiError(res.status, `API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}
```

If `server-only` isn't installed, run `pnpm --filter @oh/admin add server-only`.

```ts
// apps/admin/lib/urls.ts
/** Customer web origin for links and QR codes (was duplicated in kiosks and catering). */
export function webUrl(): string {
  if (process.env.NEXT_PUBLIC_WEB_URL) return process.env.NEXT_PUBLIC_WEB_URL;
  if (typeof window === "undefined") return "https://www.ohbeef.com";
  const host = window.location.hostname;
  if (host.includes("devadmin") || host.includes("localhost")) return host.includes("localhost") ? "http://localhost:3000" : "https://devwebapp.ohbeef.com";
  return "https://www.ohbeef.com";
}
export const planInviteUrl = (code: string) => `${webUrl()}/plan?c=${encodeURIComponent(code)}`;
```

```ts
// apps/admin/lib/format.ts
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const money = (cents: number | null | undefined) => usd.format((cents || 0) / 100);
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" });
export const denverDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });
export function relativeTime(iso: string, now = new Date()): string {
  const s = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return shortDate(iso);
}
```

```tsx
// apps/admin/components/providers/RoleProvider.tsx
"use client";
import { createContext, useContext } from "react";
import type { AdminRole } from "../../lib/access";

const RoleContext = createContext<AdminRole>("owner");
export const RoleProvider = ({ role, children }: { role: AdminRole; children: React.ReactNode }) => <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
export const useRole = () => useContext(RoleContext);
```

```tsx
// apps/admin/components/providers/LocationProvider.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../../lib/api";

export type Location = { id: string; name: string; city?: string };
type Ctx = { locations: Location[]; locationId: string; setLocationId: (id: string) => void };
const KEY = "oh-admin-location";
const LocationContext = createContext<Ctx>({ locations: [], locationId: "all", setLocationId: () => {} });

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setId] = useState("all");
  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (saved) setId(saved); } catch { /* storage blocked */ }
    api<Location[]>("/locations").then(setLocations).catch(() => setLocations([]));
  }, []);
  useEffect(() => {
    if (locations.length && locationId !== "all" && !locations.some((l) => l.id === locationId)) setId("all");
  }, [locations, locationId]);
  const setLocationId = useCallback((id: string) => {
    setId(id);
    try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
  }, []);
  return <LocationContext.Provider value={{ locations, locationId, setLocationId }}>{children}</LocationContext.Provider>;
}
export const useLocationFilter = () => useContext(LocationContext);
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `pnpm --filter @oh/admin test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/api.ts apps/admin/lib/api-server.ts apps/admin/lib/urls.ts apps/admin/lib/format.ts apps/admin/components/providers apps/admin/lib/__tests__/api.test.ts apps/admin/lib/__tests__/format.test.ts apps/admin/package.json pnpm-lock.yaml
git commit -m "feat(admin): API client, server fetch with Clerk token, location and role context"
```

### Task 9: UI kit, part 1 (icons, Button, Card, ListRow, Badge, StatTile, EmptyState, Skeleton, ErrorCard, PageHeader)

**Files:**
- Create: `apps/admin/components/ui/{icons,Button,Card,ListRow,Badge,StatTile,EmptyState,Skeleton,ErrorCard,PageHeader,index}.tsx` (`index.ts` for the barrel)
- Create: `apps/admin/app/(console)/ui-kit/page.tsx`, which is dev-only (`notFound()` in production)
- Test: `apps/admin/components/__tests__/source-guards.test.ts`

**Interfaces:**
- Produces, all exported from `components/ui/index.ts`:
  - `Icon({ name: IconName; size?: number; className?: string })`. The `IconName` values are: `today`, `receipt`, `bowl`, `more`, `search`, `close`, `chevron-right`, `chevron-left`, `plus`, `check`, `alert`, `tag`, `gift`, `bag`, `calendar`, `flame`, `sparkle`, `seat`, `chart`, `key`, `pin`, `tablet`, `settings`, `users`, `copy`, `external`, `trash`, `edit`, `filter`, `logout`, `undo`, `switch`, `phone`, `mail`, `clock`.
  - `Button({ variant?: "primary"|"secondary"|"ghost"|"danger"; size?: "md"|"sm"; loading?: boolean; icon?: IconName } & ButtonHTMLAttributes)`
  - `IconButton({ icon, label, ...button })`, which is 44x44 with `aria-label`
  - `LinkButton` (the same styles on a Next `Link`)
  - `Card({ title?, action?, children, className?, padded? })`
  - `ListRow({ href?, onClick?, leading?, title, meta?, trailing?, chevron? })`
  - `Badge({ tone: "neutral"|"good"|"pending"|"alert"|"info"; children })`, which always renders a dot plus text
  - `StatTile({ label, value, hint?, tone?, href? })`
  - `EmptyState({ title, body?, action? })`
  - `Skeleton({ className })` and `SkeletonList({ rows? })`
  - `ErrorCard({ message, onRetry? })`
  - `PageHeader({ title, subtitle?, back?: { href; label }, actions? })`

- [ ] **Step 1: Write the failing source-guard test.** It enforces the global constraints across every console file.

```ts
// apps/admin/components/__tests__/source-guards.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = path.resolve(__dirname, "../..");
const DIRS = ["app/(console)", "components"];
function files(dir: string): string[] {
  const full = path.join(root, dir);
  try { statSync(full); } catch { return []; }
  return readdirSync(full, { recursive: true }).map(String).filter((f) => /\.(tsx?|ts)$/.test(f) && !f.includes("__tests__")).map((f) => path.join(full, f));
}
const all = DIRS.flatMap(files);
const offenders = (re: RegExp, allow?: RegExp) =>
  all.flatMap((f) => readFileSync(f, "utf8").split("\n").map((line, i) => ({ f: path.relative(root, f), i: i + 1, line }))
    .filter(({ line }) => re.test(line) && !(allow && allow.test(line))).map(({ f, i }) => `${f}:${i}`));

describe("console source guards", () => {
  test("no inline styles except marked dynamic values", () => {
    expect(offenders(/style=\{\{/, /style-ok:/).filter((o) => !o.startsWith("components/ApiAuthInit"))).toEqual([]);
  });
  test("no alert/confirm/prompt", () => {
    expect(offenders(/\b(window\.)?(alert|confirm|prompt)\(/, /useConfirm|confirm\(\{|\.confirm\(|onConfirm/)).toEqual([]);
  });
  test("no em dashes", () => expect(offenders(/—/)).toEqual([]));
  test("no emoji", () => expect(offenders(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)).toEqual([]));
});
```

This test goes red as soon as pages move into `(console)` (Task 11), and it goes green again as each page is rebuilt. **Until Task 29, run it only against files already rebuilt:** `LEGACY` is a list of not-yet-rebuilt paths that the test skips. Declare it at the top of the file, before the `all` computation:

```ts
// Paths not yet rebuilt; each rebuild task deletes its entries. Task 29 asserts this is empty.
export const LEGACY: string[] = [];
const all = DIRS.flatMap(files).filter((f) => !LEGACY.some((l) => path.relative(root, f).startsWith(l)));
```

- [ ] **Step 2: Run the test.** It passes now, because `(console)` doesn't exist yet and components are all new. It is the guard that later tasks must keep green.

Run: `pnpm --filter @oh/admin test`

- [ ] **Step 3: Implement the kit.** Representative code follows; the other components follow the same conventions.

```tsx
// apps/admin/components/ui/icons.tsx
/** In-house icon set: 24px grid, 1.5px stroke, round caps. No icon libraries. */
const PATHS = {
  today: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  bowl: "M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
  close: "M6 6l12 12M18 6L6 18",
  "chevron-right": "M9 5l7 7-7 7",
  "chevron-left": "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  alert: "M12 8v5M12 16.5h.01M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  // ...remaining names from the IconName list, drawn in the same 24px/1.5px style
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
```

Every name in the Interfaces list must exist, because `nav.ts` references them and TypeScript enforces it. Draw each as one or more `M…` subpaths in the single `d` string.

```tsx
// apps/admin/components/ui/Button.tsx
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-oh-ember-deep text-oh-cream hover:bg-oh-ember active:bg-oh-ember-deep",
  secondary: "bg-oh-cream text-oh-charcoal border border-oh-stone/20 hover:bg-oh-linen",
  ghost: "bg-transparent text-oh-charcoal hover:bg-oh-linen",
  danger: "bg-transparent text-oh-ember border border-oh-ember/40 hover:bg-oh-ember/10",
};
const SIZE = { md: "min-h-11 px-4 text-[15px]", sm: "min-h-11 px-3 text-sm" };
const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none";

type Common = { variant?: Variant; size?: keyof typeof SIZE; icon?: IconName; children?: ReactNode; className?: string };

export function Button({ variant = "secondary", size = "md", icon, loading, children, className = "", ...rest }: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} aria-busy={loading || undefined}
      className={`${base} ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {loading ? <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" /> : icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", icon, children, className = "", ...rest }: Common & { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} {...rest} className={`${base} ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {icon && <Icon name={icon} size={18} />}{children}
    </Link>
  );
}

export function IconButton({ icon, label, className = "", ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-oh-stone/10 disabled:opacity-50 ${className}`}>
      <Icon name={icon} />
    </button>
  );
}
```

```tsx
// apps/admin/components/ui/Badge.tsx
const TONE = {
  neutral: "bg-oh-stone/10 text-oh-stone [--dot:theme(colors.oh-ash)]",
  good: "bg-oh-olive/15 text-oh-olive [--dot:var(--color-oh-olive)]",
  pending: "bg-oh-gold/20 text-oh-clay [--dot:var(--color-oh-gold)]",
  alert: "bg-oh-ember/12 text-oh-ember-deep [--dot:var(--color-oh-ember)]",
  info: "bg-oh-ink/10 text-oh-ink [--dot:var(--color-oh-ink)]",
} as const;
export type BadgeTone = keyof typeof TONE;

/** Status is always a word plus a dot, never colour alone. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot)]" aria-hidden="true" />{children}
    </span>
  );
}
```

If `theme(colors.oh-ash)` doesn't resolve in Tailwind v4, use `var(--color-oh-ash)`, as the other tones do.

```tsx
// apps/admin/components/ui/ListRow.tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

type Props = { href?: string; onClick?: () => void; leading?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; chevron?: boolean };

export function ListRow({ href, onClick, leading, title, meta, trailing, chevron = Boolean(href) }: Props) {
  const inner = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-oh-charcoal">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-sm text-oh-stone/75">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      {chevron && <Icon name="chevron-right" size={18} className="shrink-0 text-oh-ash" />}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-oh-linen/60 active:bg-oh-linen";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
```

```tsx
// apps/admin/components/ui/StatTile.tsx
import Link from "next/link";
const TONE = { neutral: "text-oh-charcoal", good: "text-oh-olive", pending: "text-oh-clay", alert: "text-oh-ember-deep" } as const;

export function StatTile({ label, value, hint, tone = "neutral", href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: keyof typeof TONE; href?: string }) {
  const body = (
    <div className="h-full rounded-card border border-oh-stone/15 bg-oh-cream p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">{label}</div>
      <div className={`mt-1 font-display text-[2rem] leading-none tabular-nums ${TONE[tone]}`}>{value}</div>
      {hint && <div className="mt-2 text-sm text-oh-stone/75">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
```

```tsx
// apps/admin/components/ui/PageHeader.tsx
import Link from "next/link";
import { Icon } from "./icons";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        {back && <Link href={back.href} className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-oh-stone/80"><Icon name="chevron-left" size={18} />{back.label}</Link>}
        <h1 className="font-display text-[2rem] leading-tight text-oh-charcoal lg:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-oh-stone/75">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
```

`Card` is a cream `rounded-card` surface with a border and `shadow-card`, plus an optional title row. `EmptyState` is a centred serif title, a muted body and an optional action. `Skeleton` is a `bg-oh-stone/10 rounded-lg motion-safe:animate-[oh-pulse_1.4s_ease-in-out_infinite]` block. `ErrorCard` is a Card with the alert icon, the message, and a "Try again" Button when `onRetry` is set. Export all of them from `index.ts`.

The `ui-kit` page renders every component in every variant, so screenshots can review it. Start it with `if (process.env.NODE_ENV === "production") notFound();`.

- [ ] **Step 4: Run the tests and a build, then check the kit visually**

Run: `pnpm --filter @oh/admin test && pnpm --filter @oh/admin build`. Open `http://localhost:3011/ui-kit` at 390px and at 1280px.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/ui apps/admin/components/__tests__/source-guards.test.ts "apps/admin/app/(console)/ui-kit/page.tsx"
git commit -m "feat(admin): UI kit part 1 with icons, buttons, rows, badges and tiles"
```

### Task 10: UI kit, part 2 (form fields, SegmentedControl, SearchField, Sheet, ConfirmSheet, Toast, DataList)

**Files:**
- Create: `apps/admin/components/ui/{Field,SegmentedControl,SearchField,Sheet,Confirm,Toast,DataList,FilterChips}.tsx`
- Modify: `apps/admin/components/ui/index.ts`, `app/(console)/ui-kit/page.tsx`
- Test: `apps/admin/components/__tests__/toast-queue.test.ts`

**Interfaces:**
- Produces:
  - **Form fields:** `Field({ label, hint?, error?, children })`, `TextInput`, `NumberInput` (with `inputMode`), `MoneyInput` (dollars in, `onCents(cents | null)` out), `Select`, `TextArea`, and `Toggle({ checked, onChange, label, disabled? })` (a 44px hit area).
  - `SegmentedControl({ options: { value; label; href? }[]; value; onChange?; scroll? })`
  - `SearchField({ value, onChange, onSubmit?, placeholder, autoFocus? })`
  - `FilterChips({ options, value, onChange })`
  - `Sheet({ open, onClose, title, children, footer?, size?: "full"|"auto" })`
  - `ConfirmProvider` plus `useConfirm(): (opts: { title; body?; confirmLabel; tone?: "danger"|"primary" }) => Promise<boolean>`
  - `ToastProvider` plus `useToast(): { show(t: { message; tone?: "good"|"alert"|"info"; action?: { label; onClick }; durationMs? }): void }`
  - `DataList<T>({ rows, rowKey, columns: Column<T>[], renderCard(row), empty })`, where `Column<T> = { key; label; align?; render(row) }`. It renders cards below `lg` and a table at `lg` and up.
  - Pure helper `toastQueue` (`push` and `expire`) in `Toast.tsx`, for testing.

- [ ] **Step 1: Write the failing queue test**

```ts
// apps/admin/components/__tests__/toast-queue.test.ts
import { expect, test } from "vitest";
import { toastQueue } from "../ui/Toast";

test("keeps at most 3 toasts, newest last, and expires by id", () => {
  let q = toastQueue.push([], { id: 1, message: "a" });
  q = toastQueue.push(q, { id: 2, message: "b" });
  q = toastQueue.push(q, { id: 3, message: "c" });
  q = toastQueue.push(q, { id: 4, message: "d" });
  expect(q.map((t) => t.id)).toEqual([2, 3, 4]);
  expect(toastQueue.expire(q, 3).map((t) => t.id)).toEqual([2, 4]);
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm --filter @oh/admin test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement.** The key pieces:

```tsx
// apps/admin/components/ui/Sheet.tsx
"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./Button";

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "full" | "auto" };

/** Bottom sheet on phones (drag the handle down to close), 480px right panel from lg. */
export function Sheet({ open, onClose, title, children, footer, size = "full" }: Props) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="oh-console fixed inset-0 z-50 flex items-end bg-transparent lg:items-stretch lg:justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-oh-charcoal/55 motion-safe:animate-[oh-fade_150ms_ease-out]" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined} // style-ok: live drag offset
        className={`relative flex w-full flex-col overflow-hidden rounded-t-[20px] bg-oh-paper shadow-card outline-none lg:h-full lg:w-[480px] lg:rounded-none ${size === "full" ? "h-[92svh]" : "max-h-[92svh]"} motion-safe:animate-[oh-sheet-up_220ms_ease-out] lg:motion-safe:animate-[oh-sheet-left_220ms_ease-out]`}>
        <div className="bg-oh-charcoal text-oh-cream">
          <div className="flex h-5 touch-none items-center justify-center lg:hidden"
            onPointerDown={(e) => { startY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current)); }}
            onPointerUp={() => { if (drag > 120) onClose(); setDrag(0); startY.current = null; }}
            onPointerCancel={() => { setDrag(0); startY.current = null; }}>
            <span className="h-1 w-10 rounded-full bg-oh-cream/40" />
          </div>
          <div className="flex items-center gap-2 px-4 pb-3 lg:pt-3">
            <h2 className="flex-1 truncate font-display text-2xl">{title}</h2>
            <IconButton icon="close" label="Close" onClick={onClose} className="text-oh-cream hover:bg-oh-cream/10" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <div className="border-t border-oh-stone/15 bg-oh-paper px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
```

```tsx
// apps/admin/components/ui/Toast.tsx
"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastInput = { message: string; tone?: "good" | "alert" | "info"; action?: { label: string; onClick: () => void }; durationMs?: number };
type Item = ToastInput & { id: number };

export const toastQueue = {
  push: (q: Item[], t: Item) => [...q, t].slice(-3),
  expire: (q: Item[], id: number) => q.filter((t) => t.id !== id),
};

const Ctx = createContext<{ show: (t: ToastInput) => void }>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  const show = useCallback((t: ToastInput) => {
    const id = next.current++;
    setItems((q) => toastQueue.push(q, { ...t, id }));
    setTimeout(() => setItems((q) => toastQueue.expire(q, id)), t.durationMs ?? (t.action ? 5000 : 3000));
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-oh-charcoal px-4 py-3 text-[15px] text-oh-cream shadow-card motion-safe:animate-[oh-toast-in_180ms_ease-out]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${t.tone === "alert" ? "bg-oh-ember-light" : t.tone === "good" ? "bg-oh-olive-light" : "bg-oh-gold"}`} aria-hidden="true" />
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button type="button" className="min-h-11 px-2 font-semibold text-oh-gold"
                onClick={() => { t.action!.onClick(); setItems((q) => toastQueue.expire(q, t.id)); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
```

```tsx
// apps/admin/components/ui/Confirm.tsx
"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";

type Opts = { title: string; body?: React.ReactNode; confirmLabel: string; tone?: "danger" | "primary" };
const Ctx = createContext<(o: Opts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(Ctx);

/** Replaces window.confirm for destructive and money actions. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const ask = useCallback((o: Opts) => new Promise<boolean>((resolve) => { resolver.current = resolve; setOpts(o); }), []);
  const done = (v: boolean) => { resolver.current(v); setOpts(null); };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Sheet open={opts !== null} onClose={() => done(false)} title={opts?.title ?? ""} size="auto"
        footer={<div className="flex gap-2"><Button className="flex-1" onClick={() => done(false)}>Cancel</Button>
          <Button className="flex-1" variant={opts?.tone === "danger" ? "danger" : "primary"} onClick={() => done(true)}>{opts?.confirmLabel}</Button></div>}>
        {opts?.body && <div className="text-[15px] text-oh-stone">{opts.body}</div>}
      </Sheet>
    </Ctx.Provider>
  );
}
```

```tsx
// apps/admin/components/ui/DataList.tsx
import type { ReactNode } from "react";

export type Column<T> = { key: string; label: string; align?: "left" | "right"; render: (row: T) => ReactNode };

/** Cards on phones, a table from lg. Same rows, one component. */
export function DataList<T>({ rows, rowKey, columns, renderCard, empty }: {
  rows: T[]; rowKey: (row: T) => string; columns: Column<T>[]; renderCard: (row: T) => ReactNode; empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <ul className="divide-y divide-oh-stone/10 overflow-hidden rounded-card border border-oh-stone/15 bg-oh-cream lg:hidden">
        {rows.map((r) => <li key={rowKey(r)}>{renderCard(r)}</li>)}
      </ul>
      <div className="hidden overflow-x-auto rounded-card border border-oh-stone/15 bg-oh-cream lg:block">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-oh-stone/15 text-left text-xs uppercase tracking-[0.08em] text-oh-stone/70">
            {columns.map((c) => <th key={c.key} className={`px-4 py-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-oh-stone/10 last:border-0 hover:bg-oh-linen/50">
                {columns.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

**The other components:**
- `Field` is a label (`text-sm font-semibold`), the control, then a hint or an error (`text-oh-ember-deep`, with `role="alert"`).
- Inputs are `min-h-11 w-full rounded-xl border border-oh-stone/25 bg-white/70 px-3 text-[16px]`, with a focus ring in gold.
- `MoneyInput` shows `$` and parses with `Math.round(parseFloat(v) * 100)`. It returns `null` for an empty field or NaN.
- `Toggle` is a `button role="switch" aria-checked`: a 52x32 track (olive when on, stone/30 when off) inside a 44px-tall hit box.
- `SegmentedControl` renders `Link`s when `href` is set, otherwise buttons. It is sticky-capable, uses `overflow-x-auto` when `scroll`, and marks the active option with `aria-current`.
- `SearchField` is `type="search"` with `enterKeyHint="search"`, the search icon and a clear button.
- `FilterChips` is a horizontally scrollable row of pill toggles, each 44px tall.

Add every component to the ui-kit page.

- [ ] **Step 4: Run the tests and a build, then check the kit on a phone viewport**

Run: `pnpm --filter @oh/admin test && pnpm --filter @oh/admin build`. Open `/ui-kit` at 390px and check:
- the sheet opens and closes by drag
- the confirm dialog resolves
- the undo toast fires its action

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/ui "apps/admin/app/(console)/ui-kit/page.tsx" apps/admin/components/__tests__/toast-queue.test.ts
git commit -m "feat(admin): UI kit part 2 with fields, sheet, confirm, toast and responsive list"
```

### Task 11: Route groups and the console shell

**Files:**
- **Move with `git mv`:**
  - `app/{page.tsx,_components,analytics,catering,gift-cards,kiosks,locations,menu,plan-access,products,promos,shop-orders,tenants}` go to `app/(console)/…`.
  - `app/cleaning/config` goes to `app/(console)/cleaning/config`.
  - `app/kitchen` goes to `app/(display)/kitchen`.
  - `app/cleaning/{page.tsx,pods-manager.tsx}` go to `app/(display)/cleaning/`.
  - `app/unauthorized` stays where it is.
- **Create:**
  - `app/(console)/layout.tsx` and `app/(display)/layout.tsx`
  - `components/shell/{ConsoleShell,TopBar,Dock,Sidebar,MoreSheet,LocationSwitcher,OrderNowSwitch,AccountButton,DisplaySwitcher}.tsx`
- **Delete:** `components/AdminNav.tsx`.
- **Modify:** `components/__tests__/source-guards.test.ts` (fill in `LEGACY`).

**Interfaces:**
- Consumes: `navFor`, `activeHref`, `HAS_SUPPORT` (Task 6); `ROLE_HEADER`, `parseRole` (Tasks 6 and 7); `RoleProvider`, `LocationProvider` (Task 8); the UI kit (Tasks 9 and 10).
- Produces:
  - `<OrderNowSwitch variant="row"|"card" />`, reused by Today.
  - `useLocationFilter()`, available on every console page.
  - Every console page renders inside `<main>`, with the gutters and dock clearance handled for it.

- [ ] **Step 1: Move the routes and check URLs are unchanged**

Run the `git mv` commands above. Relative imports inside the moved trees keep working because they all move together. Then:
- `grep -rn "from \"\.\./\.\./components\|from '\.\./\.\./components" apps/admin/app` finds imports of `components/` whose depth changed; fix them to the `@/components/...` alias.
- `grep -rn "_components" "apps/admin/app/(display)"` must be empty.

If Next rejects `/cleaning` living in two groups, fall back: move Seats to `app/(console)/seats`, and add a `redirects()` entry in `next.config.mjs` from `/cleaning/config` to `/seats`. Then update the `ACCESS_RULES` and nav hrefs to match.

- [ ] **Step 2: Mark the legacy files**

Set `LEGACY` in `source-guards.test.ts` to every moved console path, one entry per route directory: `"app/(console)/analytics"`, `"app/(console)/catering"`, `"app/(console)/_components"` and so on. Include the old home at `"app/(console)/page.tsx"`.

Run: `pnpm --filter @oh/admin test`
Expected: PASS.

- [ ] **Step 3: Write the console layout and shell**

```tsx
// apps/admin/app/(console)/layout.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseRole } from "@/lib/access";
import { ROLE_HEADER } from "@/lib/roles";
import { RoleProvider } from "@/components/providers/RoleProvider";
import { LocationProvider } from "@/components/providers/LocationProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { ConsoleShell } from "@/components/shell/ConsoleShell";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const role = parseRole((await headers()).get(ROLE_HEADER));
  if (!role) redirect("/unauthorized");
  return (
    <RoleProvider role={role}>
      <LocationProvider>
        <ToastProvider>
          <ConfirmProvider>
            <ConsoleShell>{children}</ConsoleShell>
          </ConfirmProvider>
        </ToastProvider>
      </LocationProvider>
    </RoleProvider>
  );
}
```

```tsx
// apps/admin/components/shell/ConsoleShell.tsx
"use client";
import { useState } from "react";
import { TopBar } from "./TopBar";
import { Dock } from "./Dock";
import { Sidebar } from "./Sidebar";
import { MoreSheet } from "./MoreSheet";

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="oh-console min-h-svh bg-oh-paper lg:pl-[248px]">
      <Sidebar />
      <TopBar />
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      <Dock onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
```

```tsx
// apps/admin/components/shell/Dock.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, navFor, NAV_GROUPS } from "@/lib/nav";
import { useRole } from "@/components/providers/RoleProvider";
import { Icon } from "@/components/ui/icons";

/** Phone navigation: Today, Orders, Menu, More. Hidden from lg, where the sidebar takes over. */
export function Dock({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname() || "/";
  const { dock } = navFor(useRole());
  const moreHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  const active = activeHref(pathname, [...dock.map((d) => d.href), ...moreHrefs]);
  const moreActive = moreOpen || (active !== null && moreHrefs.includes(active));
  const cell = "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide";
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-oh-cream/10 bg-oh-charcoal pb-[env(safe-area-inset-bottom)] text-oh-cream/70 lg:hidden">
      <div className="mx-auto flex max-w-md">
        {dock.map((item) => {
          const on = active === item.href && !moreOpen;
          return (
            <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className={`${cell} ${on ? "text-oh-gold" : ""}`}>
              <Icon name={item.icon} />{item.label}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} aria-expanded={moreOpen} className={`${cell} ${moreActive ? "text-oh-gold" : ""}`}>
          <Icon name="more" />More
        </button>
      </div>
    </nav>
  );
}
```

**The rest of the shell:**
- **`TopBar`:**
  - `sticky top-0 z-30 bg-oh-charcoal text-oh-cream`, with `pt-[env(safe-area-inset-top)]` and a 56px row.
  - On phone, the left side has `<img src="/Oh_Logo_Mark_Light.png" alt="Oh!" className="h-7 w-7">` and the current section label (found with `activeHref` over all nav items, falling back to "Admin"). Hide these at `lg`.
  - On the right: `LocationSwitcher` and `AccountButton`.
- **`LocationSwitcher`:** a pill button showing the chosen location name (or "All locations") that opens a `Sheet size="auto"` listing All plus each location as `ListRow`s with a check on the selected one. Use `useLocationFilter()`.
- **`AccountButton`:**
  - In production, the Clerk `<UserButton />`.
  - In development, a small `Dev · {role}` chip. Read `process.env.NODE_ENV`, which Next inlines.
- **`Sidebar`:**
  - `hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col bg-oh-charcoal text-oh-cream`.
  - Top: the logo and "Admin" in `font-display`.
  - Then the `dock` items, then each group's title (`text-[11px] uppercase tracking-[0.12em] text-oh-cream/50`) and items. Items are 44px rows, and the active one is `bg-oh-cream/10 text-oh-gold`.
  - In the Stores group, after its items: `<OrderNowSwitch variant="row" />`, only for owner and manager.
  - Bottom: `AccountButton`.
- **`MoreSheet`:**
  - A `Sheet size="auto" title="More"` with the same groups as `ListRow`s (leading icon, chevron), closing on navigation.
  - The Stores group includes `<OrderNowSwitch variant="row" />`.
- **`OrderNowSwitch`:**
  - Loads `GET /admin/site-config/order-now` into `{enabled}`, and shows the label "Dine-in ordering" with the meta "Live" or "Off".
  - Turning it OFF asks `useConfirm()` with the title "Turn off dine-in ordering?", the body "Guests won't be able to place dine-in orders until you turn it back on." and the label "Turn off" (tone danger).
  - Turning it ON happens straight away.
  - Either way it sends `PATCH {enabled}`, then shows a toast ("Dine-in ordering is live" or "Dine-in ordering is off"). On error, it reverts and shows an alert toast.
  - The `card` variant (for Today) is a Card with the same switch and a sentence of context.

```tsx
// apps/admin/app/(display)/layout.tsx
import { headers } from "next/headers";
import { parseRole } from "@/lib/access";
import { ROLE_HEADER } from "@/lib/roles";
import { DisplaySwitcher } from "@/components/shell/DisplaySwitcher";

/** Kitchen and Cleaning run full-screen on mounted tablets: no console chrome. */
export default async function DisplayLayout({ children }: { children: React.ReactNode }) {
  const role = parseRole((await headers()).get(ROLE_HEADER));
  return (
    <>
      {children}
      <DisplaySwitcher canOpenConsole={role === "owner" || role === "manager"} />
    </>
  );
}
```

**`DisplaySwitcher`** is a client component. It is a small fixed pill: `fixed bottom-3 right-3 z-[900] rounded-full bg-black/60 text-white/80 backdrop-blur text-sm`, placed below Kitchen's fullscreen overlay (z 1000). It holds three links:
- "Kitchen" and "Cleaning", with the current one hidden.
- "Console" (to `/`), when `canOpenConsole`. Otherwise a Clerk `<SignOutButton>` labeled "Sign out".

Use `usePathname`. Tailwind classes work here because the utilities are global. Don't add `.oh-console` in this layout.

- [ ] **Step 4: Run the tests, the build and a visual check**

Run: `pnpm --filter @oh/admin test && pnpm --filter @oh/admin build`. Then:
- At 390px, open `/menu` (still legacy inside the shell): the dock shows, More opens the grouped sheet, and the location switcher saves across reloads.
- At 1280px the sidebar shows and the dock doesn't.
- Run `node apps/admin/scripts/baseline-displays.mjs after`. Compare `/tmp/admin-after-*` with `/tmp/admin-baseline-*` by eye using the Read tool. Kitchen and Cleaning must match apart from the removed nav bar, the removed 24px page padding and the new switcher pill.
- With `ADMIN_DEV_ROLE=manager`, the More sheet has no Owner group.

- [ ] **Step 5: Commit**

```bash
git add -- apps/admin/app apps/admin/components/shell apps/admin/components/__tests__/source-guards.test.ts
git rm apps/admin/components/AdminNav.tsx
git commit -m "feat(admin): console shell with dock, More sheet, sidebar and full-screen displays"
```

Staging `apps/admin/app` is needed here to capture the moves. Check `git status` first to confirm that only this task's moves and new files are included.

---

**The page tasks (12 to 28) all follow the same shape:**
1. Delete the page's entries from `LEGACY`, and run the guard test to see it fail on the old inline styles.
2. Write any pure helper with its test first (TDD).
3. Rebuild the page on the kit, following the **Keep checklist**. Every item is a behavior of today's page that must survive, from the inventory of 2026-09-27. Replace `alert` with `useToast`, and `confirm` with `useConfirm` for destructive or money actions.
4. Run `pnpm --filter @oh/admin test && pnpm --filter @oh/admin build`. Check the page at 390px and 1280px, using `scripts/ui-audit.mjs <route>` once Task 29 creates it and by eye before then.
5. Commit only this page's paths.

**Page conventions:**
- **Frame:** `PageHeader` first; the primary action is `variant="primary"`, one per screen.
- **Data:** `api()` from client components. Load with `useEffect` plus an `AbortController`. Show `SkeletonList` while loading, `ErrorCard` with Retry on failure, and `EmptyState` when there's nothing.
- **Lists:** use `DataList` (cards on phone, a table from lg). Filters are `FilterChips` or `Select` in a "Filters" `Sheet` on phone and inline from lg. Search is a sticky `SearchField`.
- **Location filter:** pages that filter by location read `useLocationFilter().locationId` instead of their own selects.
- **Forms:** forms live in a `Sheet`, with Save in the footer. Validation errors show inline through `Field error`, never as toasts. Server errors show as an alert toast, and the sheet stays open.
- **Copy:** no em dashes and no emoji. Replace emoji in existing copy (for example the 💡 on Funnel) with an `Icon` or plain text.

### Task 12: Today (home)

**Files:**
- Replace: `app/(console)/page.tsx`
- Create: `components/today/{PulseTiles,AttentionList,QuickActions}.tsx` and `lib/today.ts`
- Test: `lib/__tests__/today.test.ts`

**Interfaces:**
- Consumes: `GET /admin/today` (Task 3), `OrderNowSwitch` (Task 11), `useLocationFilter`, `useRole`.
- Produces: `attentionRows(today: TodayPayload, role: AdminRole): { key; label; count; href; tone }[]`, which drops rows with a count of 0.

- [ ] **Step 1: Write the failing test**

```ts
// apps/admin/lib/__tests__/today.test.ts
import { expect, test } from "vitest";
import { attentionRows, type TodayPayload } from "../today";

const base: TodayPayload = { date: "2026-09-27T06:00:00.000Z", ordersToday: 12, activeDiners: 4, openPodCalls: 2, shopToShip: 3, cateringNext7: 1 };

test("manager sees operational rows only, zero counts dropped", () => {
  const rows = attentionRows({ ...base, shopToShip: 0 }, "manager");
  expect(rows.map((r) => r.key)).toEqual(["podCalls", "catering"]);
  expect(rows[0]).toMatchObject({ label: "Open pod calls", count: 2, href: "/kitchen", tone: "alert" });
});

test("owner also sees plan rows; missing countersigner is a single alert", () => {
  const rows = attentionRows({ ...base, unansweredQuestions: 2, countersignerMissing: true, salesCents: 1 }, "owner");
  expect(rows.map((r) => r.key)).toEqual(["podCalls", "shop", "catering", "planQuestions", "countersigner"]);
  expect(rows.find((r) => r.key === "countersigner")).toMatchObject({ label: "Adopt your NDA countersignature", count: 1, href: "/plan-access" });
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm --filter @oh/admin test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/today.ts`**

```ts
import type { AdminRole } from "./access";

export type TodayPayload = {
  date: string; ordersToday: number; activeDiners: number; openPodCalls: number; shopToShip: number; cateringNext7: number;
  salesCents?: number; unansweredQuestions?: number; countersignerMissing?: boolean;
};
export type AttentionRow = { key: string; label: string; count: number; href: string; tone: "alert" | "pending" | "info" };

export function attentionRows(t: TodayPayload, role: AdminRole): AttentionRow[] {
  const rows: AttentionRow[] = [
    { key: "podCalls", label: "Open pod calls", count: t.openPodCalls, href: "/kitchen", tone: "alert" },
    { key: "shop", label: "Shop orders to ship", count: t.shopToShip, href: "/shop-orders?fulfillmentStatus=PENDING", tone: "pending" },
    { key: "catering", label: "Catering in the next 7 days", count: t.cateringNext7, href: "/catering", tone: "info" },
  ];
  if (role === "owner") {
    rows.push({ key: "planQuestions", label: "Plan questions to answer", count: t.unansweredQuestions ?? 0, href: "/plan-access", tone: "pending" });
    rows.push({ key: "countersigner", label: "Adopt your NDA countersignature", count: t.countersignerMissing ? 1 : 0, href: "/plan-access", tone: "alert" });
  }
  return rows.filter((r) => r.count > 0);
}
```

- [ ] **Step 4: Build the page**
- **Header:** `PageHeader` title "Today", subtitle the Denver date (for example "Saturday, Sep 27").
- **Pulse tiles:** `PulseTiles` in a 2-column grid on phone and 4 across at lg.
  - "Orders today" (`ordersToday`).
  - "In the dining room" (`activeDiners`).
  - "Pod calls" (`openPodCalls`, alert tone if above 0, links to `/kitchen`).
  - "Sales today" (`money(salesCents)`), owner only, rendered only when the field is present.
- **Order Now:** `<OrderNowSwitch variant="card" />`.
- **Needs attention:** a Card titled "Needs attention" with `ListRow`s from `attentionRows()`, each showing a `Badge` with the count. With no rows, show an `EmptyState` with the title "All clear" and the body "Nothing needs you right now."
- **Quick actions:** `QuickActions`, a 3-up grid of `LinkButton`s: "Mark item sold out" (`/menu?focus=search`), "New promo" (`/promos?new=1`) and "Find gift card" (`/gift-cards?focus=search`).
- **Data:** fetch `GET /admin/today?locationId=` using `useLocationFilter().locationId`, and poll every 60s while the tab is visible (`document.visibilityState`).

- [ ] **Step 5: Run the tests, the build and a phone check, then commit**

```bash
git add "apps/admin/app/(console)/page.tsx" apps/admin/components/today apps/admin/lib/today.ts apps/admin/lib/__tests__/today.test.ts apps/admin/components/__tests__/source-guards.test.ts
git commit -m "feat(admin): Today home with pulse, Order Now and needs-attention"
```

### Task 13: Menu (sold-out switches plus edit sheet)

**Files:**
- Replace: `app/(console)/menu/page.tsx`
- Create: `components/menu/{MenuList,MenuItemSheet}.tsx`, `lib/optimistic.ts`, `lib/menu.ts`
- Delete: `app/(console)/_components/create-menu.tsx` and `MenuRowActions` in `row-actions.tsx` (the tenant and location actions stay until Task 21)
- Test: `lib/__tests__/optimistic.test.ts`, `lib/__tests__/menu.test.ts`

**Interfaces:**
- Consumes: `GET /menu` (public), and `POST /menu`, `PATCH /menu/:id` and `DELETE /menu/:id` (STAFF after Phase 0).
- Produces:
  - `runOptimistic({ apply, revert, commit }) → Promise<boolean>`, which resolves false after reverting on error.
  - `groupMenu(items) → { category: string; label: string; items: MenuItem[] }[]`, ordered by `displayOrder` then name, with a "No category" group last.
  - `parseCents(input: string) → number | null`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/admin/lib/__tests__/optimistic.test.ts
import { expect, test, vi } from "vitest";
import { runOptimistic } from "../optimistic";

test("applies, commits, and keeps the change on success", async () => {
  const apply = vi.fn(), revert = vi.fn();
  expect(await runOptimistic({ apply, revert, commit: async () => {} })).toBe(true);
  expect(apply).toHaveBeenCalledOnce();
  expect(revert).not.toHaveBeenCalled();
});

test("reverts when the commit fails and reports false", async () => {
  const apply = vi.fn(), revert = vi.fn();
  expect(await runOptimistic({ apply, revert, commit: async () => { throw new Error("offline"); } })).toBe(false);
  expect(revert).toHaveBeenCalledOnce();
});
```

```ts
// apps/admin/lib/__tests__/menu.test.ts
import { expect, test } from "vitest";
import { groupMenu, parseCents } from "../menu";

test("groups by category, sorts by displayOrder then name, uncategorised last", () => {
  const g = groupMenu([
    { id: "1", name: "B", category: "main01", displayOrder: 2 },
    { id: "2", name: "A", category: "main01", displayOrder: 2 },
    { id: "3", name: "Z", category: null, displayOrder: 0 },
    { id: "4", name: "C", category: "addon01", displayOrder: 1 },
  ] as never);
  expect(g.map((x) => x.category)).toEqual(["addon01", "main01", ""]);
  expect(g[1].items.map((i) => i.id)).toEqual(["2", "1"]);
  expect(g[2].label).toBe("No category");
});

test("parseCents accepts dollars", () => {
  expect(parseCents("18.99")).toBe(1899);
  expect(parseCents("0")).toBe(0);
  expect(parseCents("")).toBeNull();
  expect(parseCents("abc")).toBeNull();
  expect(parseCents("-1")).toBeNull();
});
```

- [ ] **Step 2: Run them and check they fail.** Then implement:

```ts
// apps/admin/lib/optimistic.ts
/** Apply a UI change now, commit it to the server, and roll back if that fails. */
export async function runOptimistic({ apply, revert, commit }: { apply: () => void; revert: () => void; commit: () => Promise<unknown> }): Promise<boolean> {
  apply();
  try { await commit(); return true; } catch { revert(); return false; }
}
```

```ts
// apps/admin/lib/menu.ts
export type MenuItem = {
  id: string; name: string; category: string | null; categoryType: string | null; selectionMode: "SINGLE" | "MULTIPLE" | "SLIDER";
  displayOrder: number; description: string | null; basePriceCents: number; additionalPriceCents: number; includedQuantity: number;
  isAvailable: boolean; tenantId: string;
};

export function groupMenu(items: MenuItem[]) {
  const by = new Map<string, MenuItem[]>();
  for (const i of items) { const k = i.category || ""; by.set(k, [...(by.get(k) || []), i]); }
  return [...by.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([category, list]) => ({
      category, label: category || "No category",
      items: list.sort((x, y) => x.displayOrder - y.displayOrder || x.name.localeCompare(y.name)),
    }));
}

export function parseCents(input: string): number | null {
  if (!input.trim()) return null;
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
```

- [ ] **Step 3: Build the page**
- **Header:** `PageHeader` "Menu" with the primary button "New item".
- **Search:** a sticky `SearchField`. It autofocuses when `?focus=search` is set, and filters by name and category on the client.
- **Filters:** `FilterChips` for All / Sold out.
- **List:** each category is a Card titled with the group label. Rows are `ListRow`s:
  - title: the name
  - meta: price, plus "+$x extra" and "N incl." when set, plus type and mode badges
  - trailing: a `Toggle` labeled "Available"
  - tapping the row opens `MenuItemSheet`
- **Sold-out toggle:**
  - It calls `runOptimistic` with a flip in local state and `commit: PATCH /menu/:id {isAvailable}`.
  - **On success:** a toast, "{name} is sold out" or "{name} is back on", with an **Undo** action. Undo runs `runOptimistic` again with the reverse value, and is offered only after a successful commit.
  - **On failure:** the switch has already reverted; show an alert toast, "Couldn't update {name}. Try again."
- **`MenuItemSheet`** (create and edit) contains:
  - name (required)
  - category (free text, hint "main01, slider01")
  - categoryType select (none / MAIN / SLIDER / ADDON / SIDE / DRINK / DESSERT)
  - selectionMode (SINGLE / MULTIPLE (default) / SLIDER)
  - displayOrder (number, default 0)
  - description
  - base price, extra price and included quantity, all `MoneyInput`s in dollars except the included quantity, which is a count. The hint reads "Example: Baby Bok Choy, base $0, extra $1.00, 1 included."
  - available (Toggle)
  - tenantId (a Select from `GET /tenants`, defaulting to slug `oh`, with the hint "Brand")
- **Saving:** create sends `POST /menu` with the old body shape; edit sends `PATCH /menu/:id` with every field.
  - This is a fix: the old code ignored `res.ok`. Now check it, keep the sheet open on error, and show the error message.
- **Delete:** a danger button in the sheet footer, confirmed with "Delete {name}?" and "Orders that used it keep their history.", then `DELETE /menu/:id`. Show the server's error as a toast, for example when the item is referenced.
- **Keep checklist:**
  - List columns: name, category, type badge, mode badge (SLIDER, SINGLE, other), order, base, extra (when above 0), included (when above 0), tenant brand
  - Create: all 10 fields with the defaults above
  - Row edit: name, category, base, extra, included
  - Delete with confirmation
  - The "Missing NEXT_PUBLIC_API_URL" message becomes an `ErrorCard` when `API_BASE` is empty

- [ ] **Step 4: Run the tests, the build and a phone check.** Verify that marking an item sold out takes at most 3 taps from Today: Quick action, then search, then the toggle.

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/app/(console)/menu" apps/admin/components/menu apps/admin/lib/optimistic.ts apps/admin/lib/menu.ts apps/admin/lib/__tests__/optimistic.test.ts apps/admin/lib/__tests__/menu.test.ts "apps/admin/app/(console)/_components" apps/admin/components/__tests__/source-guards.test.ts
git commit -m "feat(admin): mobile menu with sold-out switches, undo and edit sheet"
```

### Task 14: Orders (dine-in lookup and detail)

**Files:**
- Create:
  - `app/(console)/orders/page.tsx` and `app/(console)/orders/[id]/page.tsx`
  - `components/orders/{OrdersTabs,OrderStatusBadge,OrderTimeline}.tsx`
  - `lib/orders.ts`
- Test: `lib/__tests__/orders.test.ts`

**Interfaces:**
- Consumes: `GET /admin/orders` and `GET /admin/orders/:id` (Task 3), `HAS_SUPPORT` (Task 6).
- Produces:
  - `<OrdersTabs current="dine-in"|"shop"|"support" />`, reused by Shop orders (Task 15) and Support (Task 28).
  - `statusTone(status) → BadgeTone` and `statusLabel(status) → string`
  - `STEP_LABELS: Record<string, string>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/admin/lib/__tests__/orders.test.ts
import { expect, test } from "vitest";
import { statusLabel, statusTone, STEP_LABELS } from "../orders";

test("status labels and tones cover every OrderStatus", () => {
  const all = ["PENDING_PAYMENT", "PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED", "CANCELLED"];
  for (const s of all) { expect(statusLabel(s)).not.toBe(s); expect(statusTone(s)).toBeTruthy(); }
  expect(statusTone("READY")).toBe("good");
  expect(statusTone("CANCELLED")).toBe("alert");
  expect(statusLabel("PENDING_PAYMENT")).toBe("Awaiting payment");
});
test("timeline steps have labels", () => {
  for (const k of ["createdAt", "paidAt", "arrivedAt", "queuedAt", "prepStartTime", "readyTime", "deliveredAt", "completedTime"]) expect(STEP_LABELS[k]).toBeTruthy();
});
```

- [ ] **Step 2: Run it and check it fails.** Then implement:

```ts
// apps/admin/lib/orders.ts
import type { BadgeTone } from "../components/ui/Badge";

const LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment", PAID: "Paid", QUEUED: "In queue", PREPPING: "Prepping",
  READY: "Ready", SERVING: "Dining", COMPLETED: "Done", CANCELLED: "Cancelled",
};
const TONE: Record<string, BadgeTone> = {
  PENDING_PAYMENT: "pending", PAID: "info", QUEUED: "info", PREPPING: "pending",
  READY: "good", SERVING: "good", COMPLETED: "neutral", CANCELLED: "alert",
};
export const statusLabel = (s: string) => LABEL[s] ?? s.toLowerCase();
export const statusTone = (s: string): BadgeTone => TONE[s] ?? "neutral";
export const STEP_LABELS: Record<string, string> = {
  createdAt: "Ordered", paidAt: "Paid", arrivedAt: "Arrived", queuedAt: "Queued",
  prepStartTime: "Prep started", readyTime: "Ready", deliveredAt: "Delivered to pod", completedTime: "Finished",
};
```

- [ ] **Step 3: Build the pages**
- **`OrdersTabs`:** a sticky `SegmentedControl` of links: "Dine-in" (`/orders`), "Shop" (`/shop-orders`), and "Support" (`/support`, only when `HAS_SUPPORT`).
- **`/orders`:**
  - `PageHeader` "Orders", then `OrdersTabs current="dine-in"`.
  - A `SearchField` with the placeholder "Name, phone or order number". It is debounced by 300ms, and searching sends `q`. An empty search shows "Today" with a count.
  - `DataList` rows:
    - title: `#{orderNumber}`, plus `· K{kitchenOrderNumber}` when set
    - meta: `customerName · {locationName} · Pod {seatNumber} · {relativeTime}`
    - trailing: a status `Badge` and `money(totalCents)`
    - At lg, the table columns are Order, Customer, Location, Pod, Status, Payment, Total and Time.
  - Refresh every 30s when there's no search text.
  - The `useLocationFilter` location is passed through.
  - When nothing matches a search: `EmptyState` "No orders match" with "Try the last 4 digits of their phone."
- **`/orders/[id]`:**
  - `PageHeader` with back "Orders", the title `Order #{orderNumber}`, and the status badge plus source as the subtitle.
  - Cards:
    - **Guest:** name; phone as a `tel:` link with the phone icon; email as a `mailto:` link.
    - **Items:** the quantity × name (with the selected value), then line prices, subtotal, promo discount, tax and total.
    - **Payment:** status, brand and last 4.
    - **Timeline:** `OrderTimeline`, a vertical list of the `STEP_LABELS` with `denverDateTime`.
    - **Pod calls:** reason, status and time.
  - It is read-only. There are no refund controls here; refunds live in Support, owner only (Task 28).

- [ ] **Step 4: Run the tests, the build and a phone check.** Verify that finding an order takes at most 2 taps plus typing: dock Orders, then type.

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/app/(console)/orders" apps/admin/components/orders apps/admin/lib/orders.ts apps/admin/lib/__tests__/orders.test.ts
git commit -m "feat(admin): dine-in order lookup and order detail"
```

### Task 15: Shop orders (list and detail)

**Files:** replace `app/(console)/shop-orders/page.tsx` and `[id]/page.tsx`.

- **Frame:** `OrdersTabs current="shop"`. Initial filters come from the URL (`?fulfillmentStatus=PENDING` from Today).
- **Stats:** StatTiles for Total, Pending fulfillment, Today and Revenue. The Revenue tile is owner only; the API already returns it, so hide it when `useRole() !== "owner"`.
- **Filters:** payment status, fulfillment status, type (Shipping or In-store pickup), and start and end dates, in a Filters Sheet on phone.
  - Search is submit-only ("Order #, email, name").
  - "Clear" resets everything. Clearing the search text now refetches too, which fixes an old bug.
- **List (`DataList`):** Order # (link) with date, customer ("Guest" when missing) with email, item count with a summary, total, payment badge, fulfillment badge with tracking number, and type.
  - Pagination is Previous / "Page X of Y" / Next, 20 per page, shown only when there's more than one page.
- **Detail:**
  - Back link, items with totals (discount, shipping, tax), customer, shipping address or "In-store pickup", payment (Stripe PI, gift card), and tracking with an external link.
  - A fulfillment Sheet with status, carrier (USPS, UPS, FedEx, DHL, Other), tracking number, tracking URL and admin notes. Saving shows a toast.
  - **"Mark as shipped"** is a primary action, hidden when SHIPPED or DELIVERED. It requires a tracking number, shown as an inline field error, and shows a success toast.
- **Commit:** `feat(admin): mobile shop orders`

### Task 16: Promos

**Files:**
- Replace: `app/(console)/promos/page.tsx`
- Create: `components/promos/{PromoSheet,PromoAnalytics}.tsx` and `lib/promo.ts`
- Test: `lib/__tests__/promo.test.ts`

- [ ] **Test first:**

```ts
import { expect, test } from "vitest";
import { promoBody, validatePromo, formatDiscount } from "../promo";
const f = { code: "fall", discountType: "PERCENTAGE", discountValue: "15", scope: "ALL", perUserLimit: "1", targetCategories: [], targetProductIds: [], excludedProductIds: [], locationIds: [] } as never;
test("free shipping needs no value (old bug)", () => expect(validatePromo({ ...f, discountType: "FREE_SHIPPING", discountValue: "" })).toEqual({}));
test("value required and positive otherwise", () => expect(validatePromo({ ...f, discountValue: "0" }).discountValue).toBeTruthy());
test("per-bowl only with catering scope", () => expect(validatePromo({ ...f, discountType: "FIXED_PER_BOWL" }).discountType).toBeTruthy());
test("body uppercases code and sends empty arrays as null", () => {
  const b = promoBody(f);
  expect(b.code).toBe("FALL"); expect(b.targetCategories).toBeNull(); expect(b.perUserLimit).toBe(1);
});
test("formatDiscount", () => {
  expect(formatDiscount({ discountType: "PERCENTAGE", discountValue: 15, maxDiscountCents: 500 })).toBe("15% (max $5.00)");
  expect(formatDiscount({ discountType: "FIXED_PER_BOWL", discountValue: 200 })).toBe("$2.00 per bowl");
  expect(formatDiscount({ discountType: "FREE_SHIPPING", discountValue: 0 })).toBe("Free shipping");
});
```

- **Implementation:** `validatePromo(form) → Record<field, message>`; `promoBody(form)` in the old body shape (listed below); `formatDiscount(promo)`. `FREE_SHIPPING` sends `discountValue: 0`.
- **Keep checklist:**
  - **List:** "Show inactive" chip, "Show analytics" chip, and a count. Rows show the code (mono) with a Copy button (toast "Copied FALL"), a "Targeted" badge when targeting is set, description, type, formatted discount, scope, usage `current/limit|∞`, status (Expired, Active or Inactive), and expiry ("Never").
  - **Status toggle:** `PATCH /admin/promo-codes/:id {isActive}`, applied optimistically with undo.
  - **Edit and delete:** Edit opens `PromoSheet`. Delete is confirmed with `useConfirm`, then `DELETE /promo-codes/:id`.
  - **Empty state:** "No promo codes yet. Create your first one."
  - **`PromoSheet`:** sections in one scrolling sheet, with sticky section jump chips for Basics, Limits and Targeting.
    - Basics: code (uppercase, locked on edit), scope (ALL, MENU, SHOP, GIFT_CARD, CATERING; leaving CATERING while the type is per-bowl resets the type to PERCENTAGE), type (per-bowl only for CATERING), value (label changes with the type), description.
    - Limits: total, per user (default 1), minimum order, max discount, expiry (datetime-local).
    - Targeting: category chips; include-products and exclude-products checklists (from `GET /admin/shop/products`); location chips (from `useLocationFilter().locations`).
  - **Saving:** create sends `POST /promo-codes`; edit sends `PATCH /admin/promo-codes/:id`.
  - **`?new=1`:** opens the sheet on load.
  - **Analytics:** total usages, total discount, usage by scope, and a top codes list.
- **Commit:** `feat(admin): mobile promos with sheet form; free-shipping codes can be saved`

### Task 17: Gift cards (list, detail, setup)

**Files:** replace `app/(console)/gift-cards/page.tsx`, `[id]/page.tsx` and `config/page.tsx`.

- **List:**
  - A "Gift card setup" link, shown to the owner only.
  - Stats: Sold, Active, Value sold, Outstanding.
  - Filters: status (ACTIVE, REDEEMED, EXHAUSTED, EXPIRED, CANCELLED), balance (Has balance or Exhausted), and dates.
  - Search is submit-only ("Code or email"). `?focus=search` autofocuses it.
  - Rows: code with purchase date; remaining / original with a progress bar (`style-ok` width); status; purchaser ("Guest"); recipient ("Self"); expiry.
  - Pagination as in shop orders.
- **Detail:**
  - Balance card: original, used, remaining, a progress bar and % used.
  - **"Adjust balance":** a Sheet with a signed amount in dollars (converted to cents) and a required reason, then `PATCH {balanceAdjustment, adjustmentReason}`. This is money, so confirm with `useConfirm` ("Add $5.00 to OHGC-…?" or "Remove…").
  - Usage history, with links to shop orders.
  - Admin controls: status, notes, Save.
  - **Deactivate** (danger, confirmed) sends `{status:"CANCELLED"}`. **Reactivate** is now confirmed too.
  - Purchaser, recipient with message, payment, and details (design, dates).
- **Setup** (owner only; the page is gated by `ACCESS_RULES`):
  - Denomination chips, with removal now confirmed.
  - Add a denomination in dollars (converted to cents, must be above 0).
  - Custom range min and max in dollars (min at least 0, max above min).
  - Designs: gradient preview (`style-ok`), name, id, an active Toggle, and Delete (confirmed).
  - "Add design" Sheet: id (lowercased, spaces become `-`), name, CSS gradient with live preview, all required.
  - Uses the same `/admin/gift-card-config/*` endpoints.
  - A back link to Gift cards is added.
- **Commit:** `feat(admin): mobile gift cards, detail and setup`

### Task 18: Shop products

**Files:** replace `app/(console)/products/page.tsx`.

- "New product" (primary), category chips (All, FOOD, CONDIMENTS, MERCHANDISE, APPAREL, LIMITED_EDITION) and a count.
- **Rows:**
  - 40px image, name with slug, SKU, category badge, price, stock ("Unlimited" when null) and status.
  - An "Available" Toggle sends `PATCH /admin/shop/products/:id {isAvailable}`, optimistically with undo.
  - Tapping a row opens a `ProductSheet`.
- **`ProductSheet`** (create and edit, all fields):
  - slug (required, locked on edit), sku, name (required), nameZhTW, nameZhCN, nameEs, price in dollars (required, at least 0)
  - category (default MERCHANDISE), imageUrl with preview, stock (empty means unlimited), low-stock threshold, description
  - Create sends `POST /admin/shop/products`; edit sends `PATCH` with all fields (the old inline edit had only name, price and stock).
  - Delete is a confirmed danger button, and shows the server's message as a toast.
- **Commit:** `feat(admin): mobile shop products`

### Task 19: Catering overview

**Files:**
- Replace: `app/(console)/catering/page.tsx`
- Rewrite into kit components: `_components/{EventSheet (was EventFormModal),BookingCalendar,BlackoutManager,StatusBadge}.tsx`
- Delete: `_components/OrderNowToggle.tsx` (use `OrderNowSwitch`)
- Create: `lib/catering.ts`
- Test: `lib/__tests__/catering.test.ts`

- [ ] **Test first:** `validateEvent(form)`:
  - requires company and date
  - price must be an integer cents value above 0 (entered in dollars)
  - minimum bowls must be an integer above 0
  - lat and lng must be floats if present
  - `SLOT_PRICE = { LUNCH: 2499, DINNER: 2999 }`, applied when the slot changes
  - `eventBody(form, editing)` sends empty optional strings as `undefined`, filters brand colours, sends expectedGuests as an int above 0 or null, and adds status and bookedBowls only when editing

  Write 5 assertions mirroring these rules.
- **Keep checklist:**
  - `OrderNowSwitch variant="card"`.
  - Five StatTiles: Events, Bookings (with conversion %, "N started"), RSVPs ("x per event"), Order conversion ("N orders").
  - "New event" (primary). "Calendar" and "Blocked dates" as `SegmentedControl` views: List, Calendar, Blocked.
  - **List rows:** company with contact, event name, Denver date, slot badge (Lunch or Dinner), StatusBadge (PLANNING, ENRICHING, NEEDS_REVIEW, LIVE, COMPLETED, using Badge tones), bowls `booked / min`, a link to the detail page, and Delete.
    - Delete is confirmed with the permanent-delete copy, then `DELETE /admin/catering/events/:id`, with a per-row "Deleting" state and a refetch of events and analytics.
  - **Calendar:** the month grid with previous and next.
    - Each day has L and D chips at least 44px. On phone, use a 7-column grid with the chips stacked, or a week list.
    - Blocked chips can't be tapped, booked chips open the event, and an empty chip opens `EventSheet` prefilled with that date and slot.
    - A legend.
  - **Blackouts:**
    - "Block all Sundays" (disabled once a rule exists: "Sundays blocked").
    - The add form: type (date or weekday), from (required) and to, weekday, slot (whole day, Lunch or Dinner), reason, and inline errors.
    - Unblock now asks for confirmation.
  - **`EventSheet`:** the six tabs become sections with jump chips: Details, Address, Logistics, Pricing, Branding, Notes. Every field from the old modal stays, including:
    - the slot toggle price rule
    - status and booked-bowls override when editing
    - the brand colour list with picker, hex and remove
    - the Google Maps preview link
    - the minimum-commitment calculation
    - after create, a non-fatal `POST …/enrich` when a website is set
- **Commit:** `feat(admin): mobile catering overview, calendar, blackouts and event sheet`

### Task 20: Catering event detail

**Files:** replace `app/(console)/catering/[id]/page.tsx`, `tabs/*.tsx`, `_components/{EnrichmentReview,LogoUpload}.tsx`.

- **Header:** back link, logo (hidden on error), title, StatusBadge, and the subline (company, name, long Denver date, slot).
- **Header actions** go in an overflow row on phone:
  - "Run AI enrichment" (only PLANNING with a website).
  - "Edit event" (opens `EventSheet`).
  - "Send invites": confirm "Text all RSVPs the order link and arrival invite now?", then the result toast "Invites sent to {sent} of {total}. {failed} failed." (no em dash).
- **Tabs:** a sticky scrollable `SegmentedControl` for Overview, Orders, Shopping, Overage, Survey.
  - **Overview:**
    - The details list with website, Maps and tel/mailto links.
    - LogoUpload, keeping the downscale to 400px PNG with the JPEG fallback over 400KB. Keep SVG as-is. Remove is now confirmed.
    - Booking StatTiles, or the "No booking confirmed yet" line.
    - EnrichmentReview, shown when NEEDS_REVIEW or ENRICHING: polls every 3s while enriching; editable logo, colours, name and description; "Save and publish".
    - Two QR codes (qrcode.react, 160), using `webUrl()`, with "Open link".
  - **Orders:** polls every 10s ("Updates every 10 seconds"). Tiles: RSVP'd, Ordered, Not ordered (pending tone if above 0), Total bowls vs minimum. Lists of RSVPs and orders with the special-diet badge rule (regex unchanged). Each list shows 10 with "Show all".
  - **Shopping:** "Generate shopping list" (primary), a count, and ingredient rows.
  - **Overage:** tiles; the charged state with the Stripe invoice link; "Charge client for N extra bowls ($X)" as a money confirm ("This creates a Stripe invoice"), then a success card with the link; the "No overage" note.
  - **Survey:** overall and area tiles with the tone rules (≥4 good, ≥3 pending, else alert; the lowest area is alert if below 4), the area bars (reuse the analytics bar chart from Task 26, or a simple inline bar list), the AI summary, and comments.
- **Commit:** `feat(admin): mobile catering event detail`

### Task 21: Locations (with tenants)

**Files:**
- Replace: `app/(console)/locations/page.tsx`
- Replace `app/(console)/tenants/page.tsx` with `redirect("/locations#brands")`
- Delete: `_components/{create-location,create-tenant,row-actions}.tsx`
- Create: `components/locations/{LocationSheet,TenantSheet}.tsx`

- **Locations list:**
  - Name, address with city and state, phone, and an Active/Inactive badge (read-only).
  - "New location" (primary). A tap opens `LocationSheet`.
- **`LocationSheet`:**
  - Fields: name, address, city (all required), state, zip, phone, tenant.
  - Debounced (800ms) `POST /locations/validate-address`, showing a "Checking address" state, a check or warning, and up to 3 "Did you mean" suggestions that fill address, city, state, zip, lat and lng.
  - "Find coordinates" (was Geocode), then an inline "Coordinates found" line showing lat and lng. No alert.
  - Create sends `POST /locations` with `lat||0` and `lng||0`; edit sends `PATCH` with empty values as null. Check `res.ok`.
  - Delete is confirmed and shows the server error as a toast.
- **Brands section** (id `brands`): tenants with brand name and slug, "New brand", and a `TenantSheet` (slug and brandName required; `POST`, `PATCH` and confirmed `DELETE` on `/tenants`). The API error text shows in an `ErrorCard`.
- **Data:** use `serverApi` or client `api()`; client is simpler and consistent.
- **Commit:** `feat(admin): mobile locations and brands`

### Task 22: Kiosks

**Files:**
- Replace: `app/(console)/kiosks/page.tsx`
- Create: `lib/kiosk.ts`
- Test: `lib/__tests__/kiosk.test.ts`

- [ ] **Test first:**

```ts
import { expect, test } from "vitest";
import { deviceStatus } from "../kiosk";
const now = new Date("2026-09-27T12:00:00Z");
test("status from heartbeat", () => {
  expect(deviceStatus({ isActive: false, lastSeenAt: now.toISOString() }, now).label).toBe("Disabled");
  expect(deviceStatus({ isActive: true, lastSeenAt: null }, now).label).toBe("Never connected");
  expect(deviceStatus({ isActive: true, lastSeenAt: "2026-09-27T11:59:00Z" }, now)).toMatchObject({ label: "Online", tone: "good" });
  expect(deviceStatus({ isActive: true, lastSeenAt: "2026-09-27T11:55:00Z" }, now)).toMatchObject({ label: "Stale", tone: "pending" });
  expect(deviceStatus({ isActive: true, lastSeenAt: "2026-09-27T11:00:00Z" }, now)).toMatchObject({ label: "Offline", tone: "alert" });
});
```

Match the field name for last seen to the `/kiosk-devices` response.

- **Keep checklist:**
  - Drop the page's own `getApiUrl` and `getWebUrl`, and use `API_BASE` and `webUrl()`.
  - **"Register device" Sheet:** deviceId (required, placeholder "elo-location-01"), name (required), location (required). On success the sheet shows the setup URL `{web}/en/kiosk/setup?key={apiKey}` with Copy (toast) and Done.
  - **Rows:** status badge, name with deviceId, location, last seen (relative), version.
  - **Actions** in a row menu Sheet:
    - "Set up this device": confirm the key rotation, then rotate, then navigate.
    - "Copy setup URL": confirm that the old URL stops working, then rotate, then copy, then toast.
    - Disable or Enable, now confirmed when disabling.
    - Delete, confirmed.
  - The empty state and the legend.
  - Delete the dead `copySetupUrl` and `copiedId`.
- **Commit:** `feat(admin): mobile kiosk devices`

### Task 23: Seats (pod configurator)

**Files:** replace `app/(console)/cleaning/config/page.tsx` and `pod-configurator.tsx`.

- `PageHeader` "Seats", with a back link to "Cleaning display" at **`/cleaning`**. This fixes the broken `/pods` link.
- The location comes from `useLocationFilter()`. When it is "All", ask for a location with an inline Select.
- Fetch `GET /locations/:id/seats`.
- Counters for dual pods (count / 2) and single pods.
- **Grid:** 4 columns on phone and 8 at lg, with pods sorted by number. Each tile is at least 44px and shows the number, plus a "Dual with N" label and a 2 badge on dual pods.
  - Tapping a non-dual pod selects it. At most 2 can be selected, and a third replaces the oldest.
- **Sticky action bar:** "Selected: Pods X and Y", "Link as dual pod" (enabled at exactly 2; an error if either is already linked) and Clear.
  - Linking sends `POST /seats/link-dual {seatId1, seatId2}`.
  - Unlink on dual pods is now confirmed, then `POST /seats/unlink-dual {seatId}`.
  - Results show as toasts, replacing the old dismissable banner.
- The legend.
- If the site overhaul has landed, the seat labels follow its `B-07` format.
- **Commit:** `feat(admin): mobile seat configuration; fix back link`

### Task 24: Plan access

**Files:** replace `app/(console)/plan-access/page.tsx`, `[codeId]/page.tsx`, and `_components/{IssueCodeSheet (was IssueCodeModal),NdaPanel,CountersignatureCard}.tsx`. `SignatureCapture.tsx` keeps its canvas logic but gets restyled; its Allura font import stays.

- **List:**
  - "Issue code" (primary), then the just-issued banner Card: label, code, NDA note, invite link and Copy.
  - `CountersignatureCard`.
  - Rows: label (link) with code, audience, scenario, created, last viewed, sessions `n / max`, time, questions, an NDA badge (Signed date, Awaiting or Not required) and a status badge (ACTIVE, REVOKED, EXPIRED).
  - **Copy link:** only when ACTIVE. It shows "Copied" for 1.5s. If the clipboard fails, it falls back to selecting the text in a read-only input instead of `window.prompt`.
  - **Revoke:** confirmed.
- **`IssueCodeSheet`:**
  - label (required, autofocus)
  - audience (six options; LENDER sets scenario CONSERVATIVE), scenario
  - "All sections" toggle, or the 14 section checkboxes
  - expiry, max sessions (at least 1)
  - "Require NDA" (default on), with a warning when no countersigner exists
  - Submit is disabled while saving or when the label is empty; errors show inline.
- **Detail:**
  - Back link, the meta line and the invite link.
  - **NdaPanel:** status pill; Download PDF (blob download); Resend; Void (confirmed); "Require NDA" toggle; notes and delivery error; details and audit lists; history.
  - Time per section as bars (`style-ok` widths).
  - Sessions as expandable cards (date, duration, country, user agent, section views, visit summaries excluding `skipped_short`, and the chat transcript in `<details>` with "Escalated" flags).
  - Questions: the answer, or a TextArea with Save (ignored when blank).
- **`CountersignatureCard`:** the adopted signature with name, title and Change, or "Adopt signature". Edit mode has name (at least 3 characters), title (default "Founder and CEO"), the "Signing as Oh! Beef Noodle Soup, LLC." line, SignatureCapture, and Cancel or Adopt, which sends `PUT /admin/plan/nda/countersigner`.
- **Commit:** `feat(admin): mobile plan access`

### Task 25: Team page, sign-in and sign-up, unauthorized

**Files:**
- Create: `app/(console)/team/page.tsx`, `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`
- Replace: `app/unauthorized/page.tsx`

- **Team (owner):** `GET /admin/team`.
  - **Members:** name, email and a role badge. Locked owners show "Owner (allowlist)" with no actions. Others get a role Select (Manager, Station) and "Remove access" (confirmed, sends `PATCH {role:null}`).
  - **Pending invites:** email, role, sent date, and Revoke (confirmed).
  - **"Invite" Sheet:** email plus a role radio, with the explanations:
    - Manager: "Day-to-day tools. No plan access, money reports, setup or card refunds."
    - Station: "Kitchen and Cleaning displays only. For shared tablets."
    - The result toast reads "Invite sent" or "Role updated".
  - A note: "Role changes take effect within 5 minutes."
- **Sign-in and sign-up:** Clerk `<SignIn />` and `<SignUp />`, centred on charcoal with the logo mark. They sit outside `(console)`, so give them their own `.oh-console` wrapper.
- **Unauthorized:** charcoal page with the logo, "This account doesn't have admin access.", Sign out (Clerk), and a link to the main site. The 🔒 emoji is removed.
- **Commit:** `feat(admin): team management, sign-in pages and access denied screen`

### Task 26: Analytics kit and hub

**Files:**
- Rewrite: `app/(console)/analytics/components/{StatCard→(delete; use StatTile),DataTable,PeriodSelector,SimpleBarChart}.tsx`
- Replace: `app/(console)/analytics/page.tsx`
- Create: `lib/analytics.ts`
- Test: `lib/__tests__/analytics.test.ts`

- [ ] **Test first:**

```ts
import { expect, test } from "vitest";
import { REPORTS, reportsFor } from "../analytics";
import { canAccess } from "../access";
test("reports shown per role match access rules", () => {
  for (const role of ["owner", "manager"] as const) for (const r of reportsFor(role)) expect(canAccess(role, r.href)).toBe(true);
  expect(reportsFor("manager").map((r) => r.href)).not.toContain("/analytics/revenue");
  expect(REPORTS).toHaveLength(10);
});
```

- **Implementation:**
  - `REPORTS` lists the 10 subpages: traffic, funnel, revenue, operations, customers, menu, upselling, languages, challenges and badges. Each has `{ href, title, blurb, icon }`.
  - `reportsFor(role)` filters them with `canAccess`.
- **Kit:**
  - `PeriodSelector` becomes a `SegmentedControl` (Today, Yesterday, 7 days, 30 days, 90 days, Year) with `scroll`.
  - `DataTable` becomes the kit look: title, "Show all (n)" / "Show top N", cells, "—" for null (a hyphen-minus is fine), and "No data yet". It uses `DataList`, with a card mode that shows the first two columns plus the last.
  - `SimpleBarChart` becomes horizontal bars in a Card, with values as `tabular-nums` and bar widths as `style-ok`.
- **Hub:**
  - **Owner:** the LIVE strip (today's revenue, orders, active, queue), polling realtime every 30s; the 4 KPI tiles with change %; "Revenue over time"; and order sources (WEB, KIOSK, MOBILE with "Coming soon" at 0, STAFF).
  - **Manager:** instead of the owner-only calls, a pulse from `GET /admin/today` (orders, active diners, pod calls).
  - Both: report cards from `reportsFor(role)`.
  - The error screen becomes an `ErrorCard`, which still shows the API URL in dev.
- **Commit:** `feat(admin): mobile analytics hub and chart kit`

### Task 27: Analytics reports (10 subpages)

**Files:** replace each `app/(console)/analytics/*/page.tsx`. Each gets a `PageHeader` with a back link to Analytics, and the period `SegmentedControl` with the page's current default. Content is unchanged, rebuilt with StatTile, DataTable and SimpleBarChart:
- **Revenue** (week): groupBy hour/day/week/month; 4 tiles; "Revenue by {groupBy}"; by location; orders over time.
- **Operations** (week): 4 tiles with sample sizes; peak hours; orders by hour; status breakdown.
- **Customers** (month): 5 tiles; tier distribution; new vs returning bar; top customers with mailto links.
- **Menu** (week): 4 tiles; revenue by category; top by quantity and by revenue.
- **Upselling** (week): 4 tiles; breakdown; two tables; the insight Card.
- **Funnel** (week): the "GA4 not configured" ErrorCard; a link to Traffic; 3 tiles; steps; insights (with the icon instead of the 💡).
- **Traffic** (week): 7 parallel GA4 calls; realtime polling every 30s; the GA4 error; a link to Funnel; the realtime card; 6 tiles; 2 charts; 3 tables; devices.
- **Languages:** keeps its 7/14/30/90-day selector as a `SegmentedControl`; error and no-data states; 4 tiles; locales; opportunities; all languages.
- **Challenges** (month) and **Badges** (month): tiles, tables, gallery and recent awards.

Revenue, Customers and Funnel are owner-only through `ACCESS_RULES`; there's nothing to add in the page. Remove each page from `LEGACY` as it's done.

- **Commit:** `feat(admin): mobile analytics reports`

### Task 28: Support integration (only if `site-overhaul` has merged)

- [ ] Check with `git log main --oneline | grep -i support` and `ls "apps/admin/app/support" "apps/admin/app/(console)/support" 2>/dev/null`.
  - **If the Support page doesn't exist:** skip this task and leave `HAS_SUPPORT = false`. Note in the final report that the overhaul branch must set it when it lands, and must build Support on `components/ui` inside `app/(console)/support`.
  - **If it exists:**
    - Move it into `(console)` and set `HAS_SUPPORT = true`.
    - Add `OrdersTabs current="support"` and rebuild it on the kit.
    - **Card refunds become owner-only:**
      - In the UI, hide the refund action when `useRole() !== "owner"`.
      - In the API, add `requireRole("owner")` as a preHandler on the refund-approval route. Add a `node:test` case where a manager gets 403.
      - Store credit stays STAFF.
    - Add an open-support count to `/admin/today` and `attentionRows`, extending both tests.
- **Commit:** `feat(admin): support queue in the console; card refunds owner-only`

### Task 29: Cleanup, guards and the full UI audit

**Files:**
- Create: `apps/admin/scripts/ui-audit.mjs`
- Modify: `components/__tests__/source-guards.test.ts` (assert `LEGACY` is empty)
- Delete: any unused legacy components (`grep` for imports of each file under `app/(console)/_components` and the old analytics `StatCard`)

- [ ] **Step 1:** Add the test `test("LEGACY is empty", () => expect(LEGACY).toEqual([]))`. Delete dead files until `pnpm --filter @oh/admin test` passes.
- [ ] **Step 2: Write the audit script**

```js
// apps/admin/scripts/ui-audit.mjs
// Visits every console route at phone and desktop sizes; fails on horizontal page scroll
// or tap targets under 44px, and saves screenshots. Run with the admin dev server up.
// Usage: ADMIN_URL=http://localhost:3011 node apps/admin/scripts/ui-audit.mjs [route ...]
import { chromium } from "playwright";
const base = process.env.ADMIN_URL || "http://localhost:3011";
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  "/", "/orders", "/menu", "/shop-orders", "/promos", "/gift-cards", "/gift-cards/config", "/products", "/catering",
  "/cleaning/config", "/analytics", "/analytics/operations", "/analytics/revenue", "/analytics/traffic",
  "/plan-access", "/locations", "/kiosks", "/team", "/unauthorized",
];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;
for (const [label, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  for (const route of ROUTES) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      const small = [...document.querySelectorAll("a, button, [role=switch], input, select, textarea")]
        .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden" && (b.height < 43.5 || b.width < 43.5) && !el.closest("table, [data-audit-ignore]"); })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
      return { overflow, small };
    });
    const name = `${label}${route.replace(/\//g, "_") || "_home"}`;
    await page.screenshot({ path: `/tmp/admin-audit-${name}.png`, fullPage: true });
    if (r.overflow || (label === "phone" && r.small.length)) {
      failures++;
      console.log(`FAIL ${label} ${route}`, r.overflow ? "horizontal scroll" : "", r.small.slice(0, 8));
    } else console.log(`ok   ${label} ${route}`);
  }
  await page.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
```

Inline text links inside paragraphs can carry `data-audit-ignore` where a 44px target isn't meaningful. Use it sparingly and justify each one in the review.

- [ ] **Step 3: Run the audit per role**

Run it with each of `ADMIN_DEV_ROLE` owner and manager on :3011. Expected: exit 0, with every route "ok".
- As manager, owner routes redirect to `/`, and that must also report ok.
- With `ADMIN_DEV_ROLE=station`, check by hand that `/` goes to `/kitchen` and that the switcher shows "Sign out".

Review the screenshots with the Read tool. Look for broken layouts, text on the wrong surface colour, and missing empty or error states.

- [ ] **Step 4: Kitchen and Cleaning final comparison**

Run `node apps/admin/scripts/baseline-displays.mjs final` and compare against the baseline.

- [ ] **Step 5: Full check**

Run: `pnpm --filter @oh/admin test && pnpm --filter @oh/admin build && (cd packages/api && pnpm test)`
Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/scripts/ui-audit.mjs apps/admin/components/__tests__/source-guards.test.ts
git rm <each dead file found in Step 1>
git commit -m "chore(admin): remove legacy components; UI audit script; guards final"
```

### Task 30: Release (needs the owner's OK at each production step)

- [ ] **Step 1:** Run a whole-branch review with `superpowers:requesting-code-review`, then fix what it finds.
- [ ] **Step 2: Coordinate with `site-overhaul`.** If it merged first, rebase and run Task 28. If not, note the `HAS_SUPPORT` handoff.
- [ ] **Step 3: Environment**, listed for the owner and set only after their OK:
  - **Vercel `admin`:** `OWNER_EMAILS` (optional; the defaults match).
  - **Railway `@oh/api`:** `ADMIN_URL=https://admin-oh-beef-noodle-soup.vercel.app`.
  - **Clerk:** confirm the admin app and the API share the instance, and that invitations are allowed.
- [ ] **Step 4: Ask the owner.** "Admin overhaul ready. Merge and deploy API and admin?" Only after a yes: merge, push, and watch both deploys. The Railway and Vercel quirks are in memory `prod-deploy-gotchas`.
- [ ] **Step 5: Production smoke test**, as the owner, on a phone-size viewport:
  - Today loads.
  - Toggle a test menu item sold out and back.
  - Find a recent order.
  - Kitchen opens full-screen.
  - Then invite a test manager account and confirm that plan access, revenue and team are hidden, and that `curl` with that token on `/analytics/revenue` gets 403.
- [ ] **Step 6:** Update memory: a new `admin-console-overhaul` memory (roles, shell, access map, the `HAS_SUPPORT` handoff), and the `dev-env-topology` and `admin-api-auth` entries.

---

## Appendix A: Route inventory for classification (2026-09-27)

Use this when writing `public-routes.js` in Task P0.2. Line numbers refer to `packages/api/src/index.js` unless a file is named.

- **Customer (web, no auth):**
  - `/locations/:id/availability`, `/menu/steps`, `/orders/check-in`, `/orders/link-to-account`, `/orders/confirm-pod`
  - `/pods/confirm-arrival`, `/pods/info`
  - `/orders/:id/{call-staff,available-addons,refill,extra-vegetables,dessert-ready,addons}`
  - `GET /orders/:id`, `POST /orders`, `/orders/event/check`, `POST /orders/event`, `/orders/{zodiac-insights,fortune,roast,commentary,mental-health-fact}`, `/orders/:id/backstory`, `/orders/status`
  - `POST /users`, `/users/by-email/:email`, `/users/by-email/:email/order-patterns`
  - `/create-payment-intent`, `/guests*`
  - `/users/:id/{credits,deduct-credits,profile,phone,challenges,badge-progress,pending-credits,wallet,wallet/apple,wallet/google,orders,stripe-customer,payment-methods}`, `DELETE /users/:id/payment-methods/:methodId`, `/users/:userId/challenges/:challengeId/{enroll,claim}`
  - `/orders/:id/apply-credits`, `/wallet/status`
  - `/badges`, `/challenges` (GET)
  - `/group-orders*`
  - `/meal-gifts` (POST), `/meal-gifts/next/:locationId`, `/meal-gifts/:id/{accept,pay-forward}`, `GET /meal-gifts/:id`, `/users/:userId/meal-gifts`
  - `POST /analytics/language`
  - `POST /gift-cards`, `/gift-cards/code/:code`, `/gift-cards/:id/apply`, `/gift-card-config`
  - `/shop/products` (GET), `/shop/products/qr/:qrCode`, `POST /shop/orders`
  - `/promo-codes/validate`
  - `/chappy/chat/stream`, `/chappy/history`, `/chappy/confirm-payment`, `/chappy/chat`, `/chappy/reset`
  - `/party-invitations/:code*`
  - `PATCH /orders/:id`, `PATCH /kitchen/orders/:id/status`
  - `GET /tenants`, `GET /locations`, `GET /locations/:id/seats`, `GET /menu`
- **Kiosk:** `/kiosk/auth`, `/kiosk/heartbeat` (Bearer kiosk key), `/orders/lookup`, `/orders/by-member`.
- **Webhook:**
  - `triggers/webhooks.js`: `/webhooks/{github,stripe,monitoring,trigger,status}`.
  - `/chappy/sms`.
  - `PATCH /shop/orders/:id` and `POST /gift-cards/:id/confirm-payment` (the Next.js Stripe webhook).
- **Cron:** `/cron/*` (index.js and `catering/routes.js`), `GET /cny/rsvps`.
- **Wallet:** `/wallet/v1/*`.
- **Public-read:** `GET /seats/:qrCode`, `GET /users/referral/:code`, `GET /shop/products/:slug`, `GET /challenges/:idOrSlug`.
- **Agents:** everything in `autonomous/routes.js`.
- **Catering-public:** public `/catering/*` in `catering/routes.js`, including `/catering/site-config/order-now` and `/catering/kitchen-locations`.

## Appendix B: Findings outside this plan (report to the owner)

1. **`POST /chappy/sms` has no Twilio signature validation.** Anyone can post fake inbound texts.
2. **`/agents/*` routes are open.** The web proxies them server-side, but nothing checks the caller. Review them separately.
3. **The customer site marks orders PAID itself** through `PATCH /orders/:id`. The site-overhaul spec already covers this under payment integrity; until it lands, that route stays open.




