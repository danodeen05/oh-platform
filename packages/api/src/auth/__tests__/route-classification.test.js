import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONSOLE_ROUTES, MUST_STAY_OPEN, routeKey } from "../console-guard.js";
import { PUBLIC_ROUTES } from "../public-routes.js";

const SOURCES = ["../../index.js", "../../chappy/routes.js", "../../catering/routes.js", "../../autonomous/routes.js", "../../triggers/webhooks.js", "../../membership/routes.js", "../../orders/routes.js", "../../orders/group-routes.js", "../../orders/gift-card-routes.js", "../../orders/purchase-intents.js", "../../orders/event-routes.js", "../../shop/routes.js", "../../support/routes.js"];
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
