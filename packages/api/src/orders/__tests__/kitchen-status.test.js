/**
 * Task D5 fix round 2: who may change an order's status through
 * PATCH /kitchen/orders/:id/status (staff or a same-location kiosk), and the
 * guest's own "I'm done eating", POST /orders/:id/done (the verified owner,
 * SERVING -> COMPLETED only).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerKitchenStatusRoutes } from "../kitchen-status.js";
import { registerStatusDemoGuard } from "../../demo/status-demo.js";
import { createAdminAuth } from "../../auth/admin.js";
import { seed, NOW } from "./fixtures.js";

const fakeCustomerAuth = {
  async resolve(req) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer test:")) return { kind: "user", userId: h.slice(12), email: "x@x.com" };
    return { kind: "anonymous" };
  },
};
const fakeKioskAuth = {
  async deviceFor(req) {
    return req.headers.authorization === "Bearer kiosk_L1" ? { id: "dev1", locationId: "L1", isActive: true } : null;
  },
};
const auth = (userId) => ({ authorization: `Bearer test:${userId}` });
const KIOSK = { authorization: "Bearer kiosk_L1" };
const ADMIN = { "x-admin-api-key": "admin-key-123" };
const prodCheckAdminAuth = createAdminAuth({ env: { NODE_ENV: "production", ADMIN_API_KEY: "admin-key-123" } }).checkAdminAuth;

function order(overrides = {}) {
  return { id: "o1", userId: "u1", guestId: null, locationId: "L1", tenantId: "t1", seatId: null, paymentStatus: "PAID", status: "SERVING", totalCents: 1999, ...overrides };
}

async function buildApp(orders = [order()], extra = {}) {
  const prisma = seed({ orders, guests: [{ id: "g1", sessionToken: "gs_ok", expiresAt: new Date(NOW.getTime() + 3600_000) }], ...extra });
  const completed = [];
  const app = Fastify({ logger: false });
  registerStatusDemoGuard(app, { source: { menuItems: async () => [] } });
  registerKitchenStatusRoutes(app, {
    prisma,
    checkAdminAuth: prodCheckAdminAuth,
    kioskAuth: fakeKioskAuth,
    customerAuth: fakeCustomerAuth,
    onOrderCompleted: async (_p, { orderId }) => {
      completed.push(orderId);
      return { cashbackCents: 0 };
    },
    now: () => NOW,
  });
  await app.ready();
  const statusOf = async () => (await prisma.order.findUnique({ where: { id: "o1" } })).status;
  return { app, prisma, completed, statusOf };
}

const kitchen = (app, status, headers = {}) => app.inject({ method: "PATCH", url: "/kitchen/orders/o1/status", headers, payload: { status } });
const done = (app, headers = {}) => app.inject({ method: "POST", url: "/orders/o1/done", headers });

describe("PATCH /kitchen/orders/:id/status", () => {
  test("anonymous callers are refused for every status, and nothing changes", async () => {
    for (const status of ["COMPLETED", "CANCELLED", "PREPPING", "QUEUED"]) {
      const { app, statusOf, completed } = await buildApp();
      const res = await kitchen(app, status);
      assert.ok([401, 403].includes(res.statusCode), `${status}: ${res.statusCode}`);
      assert.equal(await statusOf(), "SERVING");
      assert.equal(completed.length, 0, "no cashback run");
    }
  });

  test("the order's owner can't use the kitchen route", async () => {
    const { app, statusOf } = await buildApp();
    const res = await kitchen(app, "COMPLETED", auth("u1"));
    assert.equal(res.statusCode, 403);
    assert.equal(await statusOf(), "SERVING");
  });

  test("staff can set any status; COMPLETED runs the membership engine once", async () => {
    const { app, statusOf, completed } = await buildApp([order({ status: "QUEUED" })]);
    for (const status of ["PREPPING", "READY", "SERVING", "COMPLETED", "COMPLETED"]) {
      const res = await kitchen(app, status, ADMIN);
      assert.equal(res.statusCode, 200, status);
      assert.equal(await statusOf(), status);
    }
    assert.deepEqual(completed, ["o1"]);
  });

  test("a kiosk may change orders at its own location only", async () => {
    const own = await buildApp([order({ status: "READY" })]);
    assert.equal((await kitchen(own.app, "SERVING", KIOSK)).statusCode, 200);
    const other = await buildApp([order({ status: "READY", locationId: "L2" })]);
    assert.equal((await kitchen(other.app, "SERVING", KIOSK)).statusCode, 403);
    assert.equal(await other.statusOf(), "READY");
  });

  test("an unknown status is a 400", async () => {
    const { app } = await buildApp();
    assert.equal((await kitchen(app, "PAID", ADMIN)).statusCode, 400);
  });

  test("the plan's demo orders still get a simulated success", async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/kitchen/orders/demo-plan/status", payload: { status: "COMPLETED" } });
    assert.equal(res.json().demo, true);
  });
});

describe("POST /orders/:id/done (I'm done eating)", () => {
  test("the owner moves SERVING to COMPLETED; the engine runs once", async () => {
    const { app, statusOf, completed } = await buildApp();
    const res = await done(app, auth("u1"));
    assert.equal(res.statusCode, 200);
    assert.equal(await statusOf(), "COMPLETED");
    assert.deepEqual(completed, ["o1"]);
    // Again: already done, no second payout.
    assert.equal((await done(app, auth("u1"))).statusCode, 200);
    assert.deepEqual(completed, ["o1"]);
  });

  test("only from SERVING", async () => {
    for (const status of ["QUEUED", "PREPPING", "READY", "CANCELLED", "PENDING_PAYMENT"]) {
      const { app, statusOf, completed } = await buildApp([order({ status })]);
      const res = await done(app, auth("u1"));
      assert.equal(res.statusCode, 409, status);
      assert.equal(await statusOf(), status);
      assert.equal(completed.length, 0);
    }
  });

  test("anonymous and other members are refused", async () => {
    const { app, statusOf } = await buildApp();
    assert.ok([401, 403].includes((await done(app)).statusCode));
    assert.equal((await done(app, auth("u2"))).statusCode, 403);
    assert.equal(await statusOf(), "SERVING");
  });

  test("a guest order's own guest session may finish it; another session may not", async () => {
    const { app, statusOf } = await buildApp([order({ userId: null, guestId: "g1" })]);
    assert.equal((await done(app, { "x-guest-session": "gs_nope" })).statusCode, 403);
    assert.equal(await statusOf(), "SERVING");
    assert.equal((await done(app, { "x-guest-session": "gs_ok" })).statusCode, 200);
    assert.equal(await statusOf(), "COMPLETED");
  });

  test("the plan's demo orders get a simulated success", async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: "POST", url: "/orders/demo-plan/done" });
    assert.equal(res.json().demo, true);
  });
});
