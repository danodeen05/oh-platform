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
