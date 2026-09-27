/**
 * Task A7: every /group-orders* route takes the acting member from the
 * verified identity (Clerk session, or a guest's server-issued session
 * token), never from client-sent ids; host-only actions need the verified
 * host; member orders price through quoteOrder/createOrder; the host pays
 * for the group through one verified PaymentIntent.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerGroupOrderRoutes } from "../group-routes.js";
import { seed, fakeStripe, fakeEffects, NOW, CLASSIC_BOWL } from "./fixtures.js";

const fakeCustomerAuth = {
  async resolve(req) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer test:")) return { kind: "user", userId: h.slice(12), email: "x@x.com" };
    if (h === "Bearer newuser") return { kind: "user", userId: null, email: "new@x.com" };
    return { kind: "anonymous" };
  },
  async requireUser(req, reply) {
    const who = await this.resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    if (!who.userId) {
      reply.code(403).send({ error: "No account for this sign-in yet" });
      return null;
    }
    return who;
  },
  isServiceCall(req) {
    return req.headers["x-admin-api-key"] === "svc";
  },
};

const user = (id) => ({ authorization: `Bearer test:${id}` });
const guestSession = (token) => ({ "x-guest-session": token });
const LATER = new Date(NOW.getTime() + 3600000);

const GROUP = { id: "g1", code: "ABC234", hostUserId: "u1", hostGuestId: null, locationId: "L1", tenantId: "t1", status: "GATHERING", expiresAt: LATER };
const GUEST_GROUP = { ...GROUP, id: "g2", code: "GST234", hostUserId: null, hostGuestId: "guest1" };

async function buildApp({ stripe = fakeStripe(), dineIn = true, orders = [], groups = [GROUP, GUEST_GROUP] } = {}) {
  const prisma = seed({
    groupOrders: groups.map((g) => ({ ...g })),
    guests: [
      { id: "guest1", name: "Pat", sessionToken: "gs_pat", expiresAt: LATER },
      { id: "guest2", name: "Sam", sessionToken: "gs_sam", expiresAt: LATER },
      { id: "guest_old", name: "Old", sessionToken: "gs_old", expiresAt: new Date(NOW.getTime() - 1000) },
    ],
    orders,
  });
  const { calls, effects } = fakeEffects();
  const app = Fastify({ logger: false });
  await registerGroupOrderRoutes(app, { prisma, stripe, customerAuth: fakeCustomerAuth, isDineInOrdersEnabled: () => dineIn, effects, now: () => NOW });
  await app.ready();
  return { app, prisma, stripe, calls };
}

async function addOrder(app, code, headers, items = CLASSIC_BOWL, extra = {}) {
  return app.inject({ method: "POST", url: `/group-orders/${code}/orders`, headers, payload: { items, ...extra } });
}

describe("POST /group-orders (create)", () => {
  test("the host is the verified member; body host ids are ignored; tenant comes from the location", async () => {
    const { app, prisma } = await buildApp({ groups: [] });
    const res = await app.inject({ method: "POST", url: "/group-orders", headers: user("u1"), payload: { locationId: "L1", tenantId: "t-evil", hostUserId: "u2", hostGuestId: "guest2" } });
    assert.equal(res.statusCode, 200);
    const row = await prisma.groupOrder.findUnique({ where: { id: res.json().id } });
    assert.equal(row.hostUserId, "u1");
    assert.equal(row.hostGuestId, null);
    assert.equal(row.tenantId, "t1");
    assert.equal(row.status, "GATHERING");
  });

  test("a guest host is the guest behind a valid guest session token", async () => {
    const { app, prisma } = await buildApp({ groups: [] });
    const res = await app.inject({ method: "POST", url: "/group-orders", headers: guestSession("gs_pat"), payload: { locationId: "L1", hostGuestId: "guest2" } });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: res.json().id } })).hostGuestId, "guest1");
  });

  test("no verified identity is 401 (a body hostUserId/hostGuestId is not identity); an expired guest session is 401", async () => {
    const { app } = await buildApp({ groups: [] });
    assert.equal((await app.inject({ method: "POST", url: "/group-orders", payload: { locationId: "L1", hostUserId: "u1" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/group-orders", payload: { locationId: "L1", hostGuestId: "guest1" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/group-orders", headers: guestSession("gs_old"), payload: { locationId: "L1" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/group-orders", headers: user("u1"), payload: { locationId: "nope" } })).statusCode, 404);
  });
});

describe("GET /group-orders/:code", () => {
  test("never returns guest session tokens", async () => {
    const { app } = await buildApp();
    await app.inject({ method: "POST", url: "/group-orders/GST234/join", headers: guestSession("gs_sam") });
    const res = await app.inject({ method: "GET", url: "/group-orders/gst234" });
    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(res.body, /gs_pat|gs_sam|sessionToken/);
  });
});

describe("POST /group-orders/:code/join", () => {
  test("the member is the verified caller; a body userId alone is 401", async () => {
    const { app, prisma } = await buildApp();
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/join", payload: { userId: "u2" } })).statusCode, 401);
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/join", headers: user("u2"), payload: { userId: "u1" } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).memberUsers, ["u2"]);
  });
});

describe("PATCH /group-orders/:code (host controls)", () => {
  test("only the verified host; a member or a body guestId claiming to be the host is 403", async () => {
    const { app, prisma } = await buildApp();
    assert.equal((await app.inject({ method: "PATCH", url: "/group-orders/ABC234", headers: user("u2"), payload: { status: "CLOSED" } })).statusCode, 403);
    assert.equal((await app.inject({ method: "PATCH", url: "/group-orders/GST234", payload: { status: "CLOSED", guestId: "guest1" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "PATCH", url: "/group-orders/GST234", headers: guestSession("gs_sam"), payload: { status: "CLOSED" } })).statusCode, 403);
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).status, "GATHERING");

    const ok = await app.inject({ method: "PATCH", url: "/group-orders/ABC234", headers: user("u1"), payload: { status: "CLOSED", paymentMethod: "PAY_YOUR_OWN" } });
    assert.equal(ok.statusCode, 200);
    const row = await prisma.groupOrder.findUnique({ where: { id: "g1" } });
    assert.equal(row.status, "CLOSED");
    assert.equal(row.paymentMethod, "PAY_YOUR_OWN");
    const guestHost = await app.inject({ method: "PATCH", url: "/group-orders/GST234", headers: guestSession("gs_pat"), payload: { status: "CLOSED" } });
    assert.equal(guestHost.statusCode, 200);
  });

  test("payment states are the server's: PAID, PARTIALLY_PAID and PAYING from a client are 400", async () => {
    const { app, prisma } = await buildApp();
    for (const status of ["PAID", "PARTIALLY_PAID", "PAYING"]) {
      const res = await app.inject({ method: "PATCH", url: "/group-orders/ABC234", headers: user("u1"), payload: { status } });
      assert.equal(res.statusCode, 400, status);
    }
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).status, "GATHERING");
  });

  test("a group with a paid order can't be cancelled", async () => {
    const { app } = await buildApp({ orders: [{ id: "po", groupOrderId: "g1", userId: "u2", paymentStatus: "PAID", status: "QUEUED", amountDueCents: 0 }] });
    assert.equal((await app.inject({ method: "PATCH", url: "/group-orders/ABC234", headers: user("u1"), payload: { status: "CANCELLED" } })).statusCode, 409);
  });
});

describe("POST /group-orders/:code/orders", () => {
  test("prices through quoteOrder/createOrder: server totals with tax, unpaid, tied to the group; body ids ignored", async () => {
    const { app, prisma } = await buildApp();
    const res = await addOrder(app, "ABC234", user("u2"), CLASSIC_BOWL, { userId: "u1", totalCents: 1 });
    assert.equal(res.statusCode, 200);
    const row = await prisma.order.findUnique({ where: { id: res.json().id } });
    assert.equal(row.userId, "u2");
    assert.equal(row.groupOrderId, "g1");
    assert.equal(row.isGroupHost, false);
    assert.equal(row.subtotalCents, 1749);
    assert.equal(row.taxCents, 175);
    assert.equal(row.totalCents, 1924);
    assert.equal(row.amountDueCents, 1924);
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal(row.status, "PENDING_PAYMENT");
    assert.equal((await prisma.orderItem.findMany({ where: { orderId: row.id } })).length, 3);
  });

  test("isGroupHost only for the verified host; an unverified body guestId claiming the host gets no host flag", async () => {
    const { app, prisma } = await buildApp();
    const host = await addOrder(app, "ABC234", user("u1"));
    assert.equal((await prisma.order.findUnique({ where: { id: host.json().id } })).isGroupHost, true);
    const spoof = await addOrder(app, "GST234", {}, CLASSIC_BOWL, { guestId: "guest1" });
    assert.equal(spoof.statusCode, 200);
    assert.equal((await prisma.order.findUnique({ where: { id: spoof.json().id } })).isGroupHost, false);
    const real = await addOrder(app, "GST234", guestSession("gs_pat"));
    const realRow = await prisma.order.findUnique({ where: { id: real.json().id } });
    assert.equal(realRow.isGroupHost, true);
    assert.equal(realRow.guestId, "guest1");
  });

  test("dine-in off is 403; a paying group takes no orders; unknown items are refused", async () => {
    const off = await buildApp({ dineIn: false });
    assert.equal((await addOrder(off.app, "ABC234", user("u2"))).statusCode, 403);
    const paying = await buildApp({ groups: [{ ...GROUP, status: "PAYING" }] });
    assert.equal((await addOrder(paying.app, "ABC234", user("u2"))).statusCode, 409);
    const { app } = await buildApp();
    assert.equal((await addOrder(app, "ABC234", user("u2"), [{ menuItemId: "foreign", quantity: 1 }])).statusCode, 400);
    assert.equal((await addOrder(app, "ABC234", {}, CLASSIC_BOWL, { userId: "u2" })).statusCode, 401);
  });
});

describe("DELETE /group-orders/:code/orders/:orderId", () => {
  test("the order's own member or the host; anyone else is 403; not while the host is paying", async () => {
    const orders = [
      { id: "o-u2", groupOrderId: "g1", userId: "u2", paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: 100 },
      { id: "o-u3", groupOrderId: "g1", guestId: "guest2", paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: 100 },
    ];
    const { app, prisma } = await buildApp({ orders });
    assert.equal((await app.inject({ method: "DELETE", url: "/group-orders/ABC234/orders/o-u2" })).statusCode, 401);
    assert.equal((await app.inject({ method: "DELETE", url: "/group-orders/ABC234/orders/o-u2", headers: guestSession("gs_sam") })).statusCode, 403);
    assert.equal((await app.inject({ method: "DELETE", url: "/group-orders/ABC234/orders/o-u3", headers: guestSession("gs_sam") })).statusCode, 200);
    assert.equal((await app.inject({ method: "DELETE", url: "/group-orders/ABC234/orders/o-u2", headers: user("u1") })).statusCode, 200);
    assert.equal(await prisma.order.findUnique({ where: { id: "o-u2" } }), null);

    const paying = await buildApp({ orders, groups: [{ ...GROUP, status: "PAYING" }] });
    assert.equal((await paying.app.inject({ method: "DELETE", url: "/group-orders/ABC234/orders/o-u2", headers: user("u2") })).statusCode, 409);
  });
});

describe("POST /group-orders/:code/transfer-host", () => {
  test("only the verified host; the new host is the member behind a group order", async () => {
    const orders = [
      { id: "o-host", groupOrderId: "g1", userId: "u1", isGroupHost: true, paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: 100 },
      { id: "o-u2", groupOrderId: "g1", userId: "u2", isGroupHost: false, paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: 100 },
    ];
    const { app, prisma } = await buildApp({ orders });
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/transfer-host", headers: user("u2"), payload: { newHostUserId: "u2" } })).statusCode, 403);
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/transfer-host", headers: user("u1"), payload: { newHostUserId: "u2" } });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).hostUserId, "u2");
    assert.equal((await prisma.order.findUnique({ where: { id: "o-u2" } })).isGroupHost, true);
    assert.equal((await prisma.order.findUnique({ where: { id: "o-host" } })).isGroupHost, false);
  });
});

describe("POST /group-orders/:code/complete", () => {
  test("only the verified host, and only once every order is paid", async () => {
    const orders = [{ id: "o-u2", groupOrderId: "g1", userId: "u2", paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: 100 }];
    const { app, prisma } = await buildApp({ orders });
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u2"), payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u1"), payload: {} })).statusCode, 400);
    await prisma.order.update({ where: { id: "o-u2" }, data: { paymentStatus: "PAID", status: "QUEUED" } });
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u1"), payload: { seatIds: ["s-a01"] } });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-a01" } })).status, "RESERVED");
    assert.equal((await prisma.order.findUnique({ where: { id: "o-u2" } })).seatId, "s-a01");
  });

  test("a pod that is not free is not taken", async () => {
    const orders = [{ id: "o-u2", groupOrderId: "g1", userId: "u2", paymentStatus: "PAID", status: "QUEUED", amountDueCents: 100 }];
    const { app, prisma } = await buildApp({ orders });
    await prisma.seat.update({ where: { id: "s-a01" }, data: { status: "OCCUPIED" } });
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u1"), payload: { seatIds: ["s-a01"] } });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-a01" } })).status, "OCCUPIED");
    assert.equal((await prisma.order.findUnique({ where: { id: "o-u2" } })).seatId ?? null, null);
  });
});

describe("host pays for the group", () => {
  async function groupWithOrders(opts = {}) {
    const built = await buildApp(opts);
    const a = await addOrder(built.app, "ABC234", user("u1"));
    const b = await addOrder(built.app, "ABC234", guestSession("gs_sam"), [{ menuItemId: "wagyu", quantity: 1 }]);
    return { ...built, a: a.json(), b: b.json() };
  }

  test("payment-intent: the verified host only (anonymous 401, a member 403, a guest host must sign in)", async () => {
    const { app } = await groupWithOrders();
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u2") })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/GST234/payment-intent", headers: guestSession("gs_pat") })).statusCode, 401);
  });

  test("the host gets ONE PaymentIntent for the sum; confirm marks every order PAID; the group is PAID", async () => {
    const { app, prisma, stripe, a, b, calls } = await groupWithOrders();
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1"), payload: { amountCents: 1 } });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.amountCents, a.amountDueCents + b.amountDueCents);
    assert.equal(stripe.created.length, 1);
    assert.equal(stripe.created[0].amount, a.amountDueCents + b.amountDueCents);

    // Not yet charged: 402, nothing paid.
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: user("u1"), payload: { paymentIntentId: body.paymentIntentId } })).statusCode, 402);
    stripe.intents[body.paymentIntentId].status = "succeeded";
    // A member can't confirm the host's payment.
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: user("u2"), payload: { paymentIntentId: body.paymentIntentId } })).statusCode, 403);
    const ok = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: user("u1"), payload: { paymentIntentId: body.paymentIntentId } });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().alreadyPaid, false);
    for (const o of [a, b]) assert.equal((await prisma.order.findUnique({ where: { id: o.id } })).paymentStatus, "PAID");
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).status, "PAID");
    assert.equal(calls.sendOrderConfirmation, 2);

    // The Stripe webhook (trusted service call) confirming too is idempotent.
    const hook = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: { "x-admin-api-key": "svc" }, payload: { paymentIntentId: body.paymentIntentId } });
    assert.equal(hook.statusCode, 200);
    assert.equal(hook.json().alreadyPaid, true);
    assert.equal(calls.sendOrderConfirmation, 2);
  });

  test("a client can't mark the group paid: PATCH status PAID is 400 and a kiosk PaymentIntent is 402", async () => {
    const { app, prisma, stripe, a, b } = await groupWithOrders();
    stripe.intents.pi_kiosk = { status: "succeeded", amount: a.amountDueCents + b.amountDueCents, metadata: { source: "kiosk", orderIds: [a.id, b.id].join(",") } };
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: user("u1"), payload: { paymentIntentId: "pi_kiosk" } })).statusCode, 402);
    assert.equal((await app.inject({ method: "PATCH", url: "/group-orders/ABC234", headers: user("u1"), payload: { status: "PAID" } })).statusCode, 400);
    assert.equal((await prisma.order.findUnique({ where: { id: a.id } })).paymentStatus, "PENDING");
  });
});
