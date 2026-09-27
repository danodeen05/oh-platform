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
