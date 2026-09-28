/**
 * Task D6 fix round 1: pod-service access. A pod's QR code is on its table,
 * so a pod scan must reveal no order, and every action on an order needs the
 * verified owner (member or guest session), staff or a same-location kiosk,
 * or the ORDER's own QR code (never obtainable from the pod).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerOrderServiceGuard, registerPodServiceRoutes, SERVICE_ROUTES } from "../pod-service.js";
import { registerStatusDemoGuard } from "../../demo/status-demo.js";
import { createAdminAuth } from "../../auth/admin.js";
import { POD_RETIRED } from "../../seats/free-pods.js";
import { seed, NOW } from "./fixtures.js";

const fakeCustomerAuth = {
  async resolve(req) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer test:")) return { kind: "user", userId: h.slice(12), email: "x@x.com" };
    return { kind: "anonymous" };
  },
  async requireUser(req, reply) {
    const who = await this.resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    return who;
  },
};
const auth = (userId) => ({ authorization: `Bearer test:${userId}` });
const KIOSK = { authorization: "Bearer kiosk_L1" };
const ADMIN = { "x-admin-api-key": "admin-key-123" };
const checkAdminAuth = createAdminAuth({ env: { NODE_ENV: "production", ADMIN_API_KEY: "admin-key-123" } }).checkAdminAuth;
const deps = {
  checkAdminAuth,
  kioskDeviceFor: async (req) => (req.headers.authorization === "Bearer kiosk_L1" ? { id: "dev1", locationId: "L1" } : null),
  resolveCustomer: (req) => fakeCustomerAuth.resolve(req),
};

const CODE = "ORDER-L1-1-SECRET";
function order(overrides = {}) {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    kitchenOrderNumber: "D01",
    orderQrCode: CODE,
    userId: "u1",
    guestId: null,
    locationId: "L1",
    tenantId: "t1",
    seatId: "s-b07",
    paymentStatus: "PAID",
    status: "PAID",
    podConfirmedAt: null,
    totalCents: 1999,
    ...overrides,
  };
}

async function buildApp(orders = [order()]) {
  const prisma = seed({
    orders,
    guests: [{ id: "g1", sessionToken: "gs_ok", expiresAt: new Date(NOW.getTime() + 3600_000) }],
  });
  // Pod B-07 has its table code; the order is held there.
  prisma.seat.update && (await prisma.seat.update({ where: { id: "s-b07" }, data: { qrCode: "POD-L1-B-07" } }));
  // A-00 (fixtures.js) is retired: the old sticker from before the release-2 cutover.
  prisma.seat.update && (await prisma.seat.update({ where: { id: "s-old" }, data: { qrCode: "POD-L1-A-00" } }));
  const withGuests = { ...deps, findGuestBySessionToken: (token) => prisma.guest.findUnique({ where: { sessionToken: token } }) };
  const app = Fastify({ logger: false });
  registerStatusDemoGuard(app, { source: { menuItems: async () => [] } });
  registerOrderServiceGuard(app, { prisma, deps: withGuests });
  registerPodServiceRoutes(app, { prisma, deps: withGuests, requireUser: (req, reply) => fakeCustomerAuth.requireUser(req, reply), now: () => NOW });
  // Stand-ins for the real service handlers in index.js: reaching one means the guard let the call through.
  for (const key of SERVICE_ROUTES) {
    const url = key.slice("POST ".length);
    app.post(url, async () => ({ success: true, reached: true }));
  }
  await app.ready();
  return { app, prisma };
}

const info = (app) => app.inject({ method: "GET", url: "/pods/info?qrCode=POD-L1-B-07" });
const retiredInfo = (app) => app.inject({ method: "GET", url: "/pods/info?qrCode=POD-L1-A-00" });
const arrive = (app, headers = {}, body = {}) => app.inject({ method: "POST", url: "/pods/confirm-arrival", headers, payload: { podQrCode: "POD-L1-B-07", ...body } });
const arriveRetired = (app, headers = {}, body = {}) => app.inject({ method: "POST", url: "/pods/confirm-arrival", headers, payload: { podQrCode: "POD-L1-A-00", ...body } });
const service = (app, path, headers = {}) => app.inject({ method: "POST", url: `/orders/o1/${path}`, headers, payload: {} });
const link = (app, headers = {}, body = {}) => app.inject({ method: "POST", url: "/orders/link-to-account", headers, payload: body });

describe("GET /pods/info (anonymous pod scan)", () => {
  test("says a pod is held and whether it's confirmed, and leaks no order code, id or user id", async () => {
    const { app } = await buildApp();
    const res = await info(app);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.deepEqual(body.pod, { label: "B-07", status: "AVAILABLE" });
    assert.equal(body.hasActiveOrder, true);
    assert.equal(body.alreadyConfirmed, false);
    assert.equal(body.location.id, "L1");
    const text = res.body;
    for (const secret of [CODE, "o1", "u1", "ORD-1", "activeOrder", "orderQrCode", "userId"]) {
      assert.ok(!text.includes(secret), `leaks ${secret}`);
    }
  });

  test("a free pod has no active order; an unknown code is a 404", async () => {
    const { app } = await buildApp([]);
    assert.equal((await info(app)).json().hasActiveOrder, false);
    assert.equal((await app.inject({ method: "GET", url: "/pods/info?qrCode=POD-nope" })).statusCode, 404);
  });

  test("an old sticker (retired pod, nothing live on it) is a 200 retired marker, no order data", async () => {
    const { app } = await buildApp([]);
    const res = await retiredInfo(app);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.retired, true);
    assert.equal(body.code, POD_RETIRED);
    assert.deepEqual(body.pod, { label: "A-00", status: "RETIRED" });
    assert.equal(body.location.id, "L1");
    assert.equal(body.hasActiveOrder, false);
    assert.equal(body.alreadyConfirmed, false);
    for (const secret of [CODE, "o1", "u1", "ORD-1", "activeOrder", "orderQrCode", "userId"]) {
      assert.ok(!res.body.includes(secret), `leaks ${secret}`);
    }
  });

  test("a retired pod with a live legacy order still on it is not treated as retired", async () => {
    const { app } = await buildApp([order({ seatId: "s-old" })]);
    const res = await retiredInfo(app);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().retired, undefined);
    assert.equal(res.json().hasActiveOrder, true);
  });
});

describe("POST /pods/confirm-arrival", () => {
  test("a stranger (anonymous, or another member) can't confirm someone else's order", async () => {
    for (const headers of [{}, auth("u2")]) {
      const { app, prisma } = await buildApp();
      const res = await arrive(app, headers);
      assert.equal(res.statusCode, 403, JSON.stringify(res.json()));
      assert.equal(res.json().code, "ORDER_CODE_REQUIRED");
      assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).podConfirmedAt ?? null, null);
    }
  });

  test("a wrong order code confirms nothing", async () => {
    const { app, prisma } = await buildApp();
    const res = await arrive(app, {}, { orderQrCode: "ORDER-guess" });
    assert.equal(res.statusCode, 404);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).podConfirmedAt ?? null, null);
  });

  test("the signed-in owner confirms their own order; it moves to QUEUED and the pod is occupied", async () => {
    const { app, prisma } = await buildApp();
    const res = await arrive(app, auth("u1"));
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().order.orderQrCode, CODE, "the owner gets their own code back");
    const o = await prisma.order.findUnique({ where: { id: "o1" } });
    assert.ok(o.podConfirmedAt);
    assert.equal(o.status, "QUEUED");
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-b07" } })).status, "OCCUPIED");
    assert.equal((await arrive(app, auth("u1"))).json().code, "ALREADY_CONFIRMED", "a second tap says so");
  });

  test("a guest who isn't signed in confirms a kiosk order with its order code", async () => {
    const { app, prisma } = await buildApp([order({ userId: null, guestId: null })]);
    const res = await arrive(app, {}, { orderQrCode: CODE });
    assert.equal(res.statusCode, 200);
    assert.ok((await prisma.order.findUnique({ where: { id: "o1" } })).podConfirmedAt);
    assert.equal((await arrive(app, {}, { orderQrCode: CODE })).json().code, "ALREADY_CONFIRMED");
  });

  test("a guest session confirms its own guest order", async () => {
    const { app } = await buildApp([order({ userId: null, guestId: "g1" })]);
    assert.equal((await arrive(app, { "x-guest-session": "gs_ok" })).statusCode, 200);
  });

  test("an order code for an order held at another pod is refused", async () => {
    const { app } = await buildApp([order({ seatId: "s-a01" })]);
    assert.equal((await arrive(app, {}, { orderQrCode: CODE })).json().code, "WRONG_POD");
  });

  test("an old sticker (retired pod, nothing live on it) is a 410, before any order lookup", async () => {
    const { app, prisma } = await buildApp([]);
    const res = await arriveRetired(app, auth("u1"));
    assert.equal(res.statusCode, 410);
    assert.equal(res.json().code, POD_RETIRED);
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-old" } })).status, "AVAILABLE");
  });

  test("a retired pod with a live legacy order still on it confirms normally", async () => {
    const { app, prisma } = await buildApp([order({ seatId: "s-old" })]);
    const res = await arriveRetired(app, auth("u1"));
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
    const o = await prisma.order.findUnique({ where: { id: "o1" } });
    assert.ok(o.podConfirmedAt);
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-old" } })).status, "OCCUPIED");
  });
});

describe("pod services (call staff, refill, extras, dessert, add-ons)", () => {
  const paths = ["call-staff", "refill", "extra-vegetables", "dessert-ready", "addons"];

  test("a stranger can't trigger any of them", async () => {
    const { app } = await buildApp();
    for (const p of paths) {
      for (const headers of [{}, auth("u2"), { "x-order-code": "ORDER-guess" }]) {
        const res = await service(app, p, headers);
        assert.equal(res.statusCode, 403, `${p} ${JSON.stringify(headers)}`);
        assert.equal(res.json().code, "ORDER_CODE_REQUIRED");
      }
    }
  });

  test("the owner, the order-code holder, staff and a same-location kiosk can", async () => {
    const { app } = await buildApp();
    for (const p of paths) {
      for (const headers of [auth("u1"), { "x-order-code": CODE }, ADMIN, KIOSK]) {
        const res = await service(app, p, headers);
        assert.equal(res.statusCode, 200, `${p} ${JSON.stringify(headers)}: ${res.body}`);
        assert.equal(res.json().reached, true);
      }
    }
  });

  test("an unknown order is a 404; the plan's demo order is still simulated", async () => {
    const { app } = await buildApp();
    assert.equal((await app.inject({ method: "POST", url: "/orders/nope/call-staff", payload: {} })).statusCode, 404);
    const demo = await app.inject({ method: "POST", url: "/orders/demo-plan/call-staff", payload: {} });
    assert.equal(demo.statusCode, 200);
    assert.equal(demo.json().demo, true);
  });
});

describe("POST /orders/link-to-account", () => {
  test("needs a signed-in member and the order code; never the order id alone", async () => {
    const { app, prisma } = await buildApp([order({ userId: null })]);
    assert.equal((await link(app, {}, { orderQrCode: CODE })).statusCode, 401, "signed out");
    assert.equal((await link(app, auth("u2"), { orderId: "o1" })).statusCode, 400, "an order id is not proof");
    assert.equal((await link(app, auth("u2"), { orderQrCode: "ORDER-guess" })).statusCode, 404);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).userId ?? null, null);
    const res = await link(app, auth("u2"), { orderQrCode: CODE });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).userId, "u2");
  });

  test("an order that already has an owner can't be taken", async () => {
    const { app, prisma } = await buildApp();
    const res = await link(app, auth("u2"), { orderQrCode: CODE });
    assert.equal(res.statusCode, 400);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).userId, "u1");
    assert.equal((await link(app, auth("u1"), { orderQrCode: CODE })).statusCode, 200, "its own owner: a no-op");
  });
});
