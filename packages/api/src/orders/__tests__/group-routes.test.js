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
import { registerGroupOrderRoutes, publicGroup } from "../group-routes.js";
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

async function buildApp({ stripe = fakeStripe(), dineIn = true, orders = [], groups = [GROUP, GUEST_GROUP], users } = {}) {
  const prisma = seed({
    groupOrders: groups.map((g) => ({ ...g })),
    guests: [
      { id: "guest1", name: "Pat", sessionToken: "gs_pat", expiresAt: LATER },
      { id: "guest2", name: "Sam", sessionToken: "gs_sam", expiresAt: LATER },
      { id: "guest_old", name: "Old", sessionToken: "gs_old", expiresAt: new Date(NOW.getTime() - 1000) },
    ],
    orders,
    ...(users ? { users } : {}),
  });
  const { calls, effects } = fakeEffects();
  const app = Fastify({ logger: false });
  await registerGroupOrderRoutes(app, { prisma, stripe, customerAuth: fakeCustomerAuth, isDineInOrdersEnabled: () => dineIn, effects, now: () => NOW, isStaff: async (req) => req.headers["x-admin-api-key"] === "staff-key" });
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

  // prisma-memory ignores include/select, so `hostUser` is embedded directly
  // on the seeded group row - findUnique returns whatever was stored, same
  // as a real Prisma `include` would attach it (see the routes.test.js
  // ORDER_INCLUDE comment for the same limitation).
  test("A8b fix round 2: an anonymous caller sees the host's first name + last initial, not the full name", async () => {
    const namedGroup = { ...GROUP, hostUser: { id: "u1", name: "Dana Kim", email: "u1@x.com" } };
    const { app } = await buildApp({ groups: [namedGroup] });
    const res = await app.inject({ method: "GET", url: "/group-orders/ABC234" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().hostUser.name, "Dana K.");
    assert.equal(res.body.includes("u1@x.com"), false);
    assert.equal(res.body.includes("Dana Kim"), false);
  });

  test("A8b fix round 2: the host sees their own full name; a different signed-in caller does not", async () => {
    const namedGroup = { ...GROUP, hostUser: { id: "u1", name: "Dana Kim", email: "u1@x.com" } };
    const { app } = await buildApp({ groups: [namedGroup] });
    const asHost = await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: user("u1") });
    assert.equal(asHost.json().hostUser.name, "Dana Kim");
    const asOther = await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: user("u2") });
    assert.equal(asOther.json().hostUser.name, "Dana K.");
  });

  // Addendum: safeGuest gets the same rule - a matching guest session (not a
  // client-sent guestId) sees the guest's own full name.
  test("addendum: a guest host's own verified session sees their full name; everyone else sees First L.", async () => {
    const namedGuestGroup = { ...GUEST_GROUP, hostGuest: { id: "guest1", name: "Pat Lee", phone: "555-0100" } };
    const { app } = await buildApp({ groups: [namedGuestGroup] });
    const anon = await app.inject({ method: "GET", url: "/group-orders/GST234" });
    assert.equal(anon.json().hostGuest.name, "Pat L.");
    const asGuest = await app.inject({ method: "GET", url: "/group-orders/GST234", headers: guestSession("gs_pat") });
    assert.equal(asGuest.json().hostGuest.name, "Pat Lee");
    assert.equal(asGuest.body.includes("555-0100"), false);
  });
});

describe("publicGroup / safeUser / safeGuest (A8b fix round 2 + addendum): first name + last initial is the shared ceiling; the record's own owner sees their full name", () => {
  const NAMED_GROUP = {
    id: "g1",
    hostUser: { id: "u1", name: "Dana Kim", email: "u1@x.com" },
    hostGuest: null,
    memberUsers: [
      { id: "u1", name: "Dana Kim", email: "u1@x.com" },
      { id: "u2", name: "Jordan Smith Rivera", email: "u2@x.com" },
      { id: "u3", name: null, email: "casey.jones@x.com" },
      { id: "u4", name: "Madonna", email: "m@x.com" },
    ],
    memberGuests: [
      { id: "g10", name: "Pat Lee", phone: "555-0100" },
      { id: "g11", name: "", phone: "555-0101" },
    ],
    orders: [
      { id: "o1", user: { id: "u2", name: "Jordan Smith Rivera", email: "u2@x.com" }, guest: null },
      { id: "o2", user: null, guest: { id: "g10", name: "Pat Lee", phone: "555-0100" } },
    ],
  };

  test("no viewer: first name + last initial for a multi-word name; the email-derived first name (no domain) when there's no name; a single-word name is left as-is", () => {
    const out = publicGroup(NAMED_GROUP);
    assert.equal(out.hostUser.name, "Dana K.");
    assert.equal(out.memberUsers[0].name, "Dana K.");
    // Uses the FIRST and LAST tokens only, not a middle name.
    assert.equal(out.memberUsers[1].name, "Jordan R.");
    // No name at all: the email local part's first token, capitalized, no domain.
    assert.equal(out.memberUsers[2].name, "Casey");
    // A single-word name has no last initial to add.
    assert.equal(out.memberUsers[3].name, "Madonna");
    assert.equal(out.orders[0].user.name, "Jordan R.");
  });

  test("no viewer: a guest gets the same first name + last initial rule, and \"Guest\" when the name is empty", () => {
    const out = publicGroup(NAMED_GROUP);
    assert.equal(out.memberGuests[0].name, "Pat L.");
    assert.equal(out.memberGuests[1].name, "Guest");
    assert.equal(out.orders[1].guest.name, "Pat L.");
  });

  test("the viewer (by userId) sees their own full name; everyone else's is still truncated", () => {
    const out = publicGroup(NAMED_GROUP, { userId: "u2", guestId: null });
    assert.equal(out.hostUser.name, "Dana K.");
    assert.equal(out.memberUsers[0].name, "Dana K.");
    assert.equal(out.memberUsers[1].name, "Jordan Smith Rivera");
    assert.equal(out.orders[0].user.name, "Jordan Smith Rivera");
    // Not the guest viewer: guests are still truncated.
    assert.equal(out.memberGuests[0].name, "Pat L.");
  });

  test("the viewer (by a matching guest session, guestId) sees their own full name; a member's is unaffected", () => {
    const out = publicGroup(NAMED_GROUP, { userId: null, guestId: "g10" });
    assert.equal(out.memberGuests[0].name, "Pat Lee");
    assert.equal(out.orders[1].guest.name, "Pat Lee");
    // Not the user viewer: members are still truncated.
    assert.equal(out.hostUser.name, "Dana K.");
  });

  test("never leaks email or phone, even for the viewer's own record", () => {
    const out = publicGroup(NAMED_GROUP, { userId: "u1", guestId: "g10" });
    const json = JSON.stringify(out);
    assert.equal(json.includes("u1@x.com"), false);
    assert.equal(json.includes("u2@x.com"), false);
    assert.equal(json.includes("m@x.com"), false);
    assert.equal(json.includes("555-0100"), false);
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

  // Task D11: the lobby's CombMap pick, by order and pod label.
  const paidPair = () => [
    { id: "o-host", groupOrderId: "g1", userId: "u1", paymentStatus: "PAID", status: "QUEUED", amountDueCents: 100, createdAt: new Date(NOW.getTime() - 2000) },
    { id: "o-u2", groupOrderId: "g1", userId: "u2", paymentStatus: "PAID", status: "QUEUED", amountDueCents: 100, createdAt: new Date(NOW.getTime() - 1000) },
  ];

  test("D11: picked pods go to the order they were picked for, both halves of a duo included", async () => {
    const { app, prisma } = await buildApp({ orders: paidPair() });
    const res = await app.inject({
      method: "POST",
      url: "/group-orders/ABC234/complete",
      headers: user("u1"),
      payload: { pods: [{ orderId: "o-u2", label: "C-01" }, { orderId: "o-host", label: "C-02" }] },
    });
    assert.equal(res.statusCode, 200);
    const host = await prisma.order.findUnique({ where: { id: "o-host" } });
    const u2 = await prisma.order.findUnique({ where: { id: "o-u2" } });
    assert.equal(host.seatId, "s-c02");
    assert.equal(u2.seatId, "s-c01");
    assert.equal(host.podSelectionMethod, "GROUP_HOST_SELECTED");
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-c01" } })).status, "RESERVED");
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-c02" } })).status, "RESERVED");
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).status, "PAID");
  });

  test("D11: a picked pod taken meanwhile falls back to the next best free pod, never a double booking", async () => {
    const { app, prisma } = await buildApp({ orders: paidPair() });
    await prisma.seat.update({ where: { id: "s-b07" }, data: { status: "RESERVED" } }); // someone else's hold
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u1"), payload: { pods: [{ orderId: "o-u2", label: "B-07" }] } });
    assert.equal(res.statusCode, 200);
    const u2 = await prisma.order.findUnique({ where: { id: "o-u2" } });
    assert.ok(u2.seatId && u2.seatId !== "s-b07", `seated elsewhere, got ${u2.seatId}`);
    assert.notEqual(u2.seatId, "s-old", "never a retired pod");
    assert.equal(u2.podSelectionMethod, "AUTO");
    // Without fill, the unpicked host is seated on arrival.
    assert.equal((await prisma.order.findUnique({ where: { id: "o-host" } })).seatId ?? null, null);
  });

  test("D11: fill seats the unpicked members at distinct free pods; a bad label is ignored", async () => {
    const { app, prisma } = await buildApp({ orders: paidPair() });
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u1"), payload: { pods: [{ orderId: "o-u2", label: "not a pod" }], fill: true } });
    assert.equal(res.statusCode, 200);
    const a = (await prisma.order.findUnique({ where: { id: "o-host" } })).seatId;
    const b = (await prisma.order.findUnique({ where: { id: "o-u2" } })).seatId;
    assert.ok(a && b && a !== b, `two distinct pods, got ${a} and ${b}`);
  });

  test("D11 fix round 1: two /complete calls at once (two tabs) never strand a claimed pod", async () => {
    const { app, prisma } = await buildApp({ orders: paidPair() });
    const call = () => app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u1"), payload: { fill: true } });
    const [a, b] = await Promise.all([call(), call()]);
    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
    const seated = [(await prisma.order.findUnique({ where: { id: "o-host" } })).seatId, (await prisma.order.findUnique({ where: { id: "o-u2" } })).seatId];
    assert.ok(seated[0] && seated[1] && seated[0] !== seated[1], `distinct pods, got ${seated}`);
    const reserved = (await prisma.seat.findMany({ where: { status: "RESERVED" } })).map((x) => x.id).sort();
    assert.deepEqual(reserved, [...seated].sort(), "only the seated pods stay reserved");
  });

  test("D11: only the host may complete, even with a pick", async () => {
    const { app, prisma } = await buildApp({ orders: paidPair() });
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/complete", headers: user("u2"), payload: { pods: [{ orderId: "o-u2", label: "B-07" }] } });
    assert.equal(res.statusCode, 403);
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-b07" } })).status, "AVAILABLE");
  });
});

describe("GET /group-orders/:code?locale= (Task D11)", () => {
  test("the location and each line's menu item come back in the reader's locale; en and no locale are unchanged", async () => {
    const group = {
      ...GROUP,
      location: { id: "L1", name: "City Creek Mall", address: "50 S Main St", i18n: { "zh-TW": { name: "城市溪購物中心", address: "主街50號" } } },
      orders: [
        {
          id: "o1",
          items: [{ id: "i1", quantity: 1, selectedValue: "Medium", menuItem: { name: "Classic Beef Noodle Soup", nameZhTW: "經典牛肉麵", sliderConfig: { labels: ["Light", "Medium"], labelsI18n: { "zh-TW": ["淡", "中"] } } } }],
        },
      ],
    };
    const { app } = await buildApp({ groups: [group] });
    const zh = (await app.inject({ method: "GET", url: "/group-orders/ABC234?locale=zh-TW" })).json();
    assert.equal(zh.location.name, "城市溪購物中心");
    assert.equal(zh.location.address, "主街50號");
    assert.equal(zh.orders[0].items[0].menuItem.name, "經典牛肉麵");
    assert.deepEqual(zh.orders[0].items[0].menuItem.sliderConfig.displayLabels, ["淡", "中"]);
    assert.equal(zh.orders[0].items[0].selectedValue, "Medium", "the stored value stays the canonical English label");
    const en = (await app.inject({ method: "GET", url: "/group-orders/ABC234" })).json();
    assert.equal(en.location.name, "City Creek Mall");
    assert.equal(en.orders[0].items[0].menuItem.name, "Classic Beef Noodle Soup");
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
    // Without a PaymentIntent (zero-balance confirm) only the host may confirm.
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: user("u2"), payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", payload: {} })).statusCode, 401);
    const ok = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: user("u1"), payload: { paymentIntentId: body.paymentIntentId } });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().alreadyPaid, false);
    for (const o of [a, b]) assert.equal((await prisma.order.findUnique({ where: { id: o.id } })).paymentStatus, "PAID");
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).status, "PAID");
    assert.equal(calls.sendOrderConfirmation, 2);

    // The Stripe webhook (no session, no service key) confirming too is idempotent.
    const hook = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", payload: { paymentIntentId: body.paymentIntentId } });
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

  test("fix round 1: the webhook alone recovers a charge the page never confirmed (no service key)", async () => {
    const { app, prisma, stripe, a, b } = await groupWithOrders();
    const pi = (await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1") })).json();
    stripe.intents[pi.paymentIntentId].status = "succeeded";
    const hook = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", payload: { paymentIntentId: pi.paymentIntentId } });
    assert.equal(hook.statusCode, 200);
    for (const o of [a, b]) assert.equal((await prisma.order.findUnique({ where: { id: o.id } })).paymentStatus, "PAID");
  });

  test("fix round 1: the host's revisit after an unconfirmed charge settles it; no second PaymentIntent", async () => {
    const { app, prisma, stripe, a, b } = await groupWithOrders();
    const first = (await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1") })).json();
    stripe.intents[first.paymentIntentId].status = "succeeded";
    const again = await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1") });
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().alreadyPaid, true);
    assert.equal(stripe.created.length, 1);
    for (const o of [a, b]) assert.equal((await prisma.order.findUnique({ where: { id: o.id } })).paymentStatus, "PAID");
  });

  test("fix round 1: transfer-host while the host is paying is 409", async () => {
    const { app, prisma } = await groupWithOrders();
    await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1") });
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).status, "PAYING");
    const res = await app.inject({ method: "POST", url: "/group-orders/ABC234/transfer-host", headers: user("u1"), payload: { newHostGuestId: "guest2" } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, "GROUP_PAYING");
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).hostUserId, "u1");
  });

  test("fix round 2 (b): cancelling a PAYING group cancels its stored open PaymentIntent", async () => {
    const { app, prisma, stripe } = await groupWithOrders();
    const pi = (await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1") })).json();
    const res = await app.inject({ method: "PATCH", url: "/group-orders/ABC234", headers: user("u1"), payload: { status: "CANCELLED" } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(stripe.cancelled, [pi.paymentIntentId]);
    assert.equal(stripe.intents[pi.paymentIntentId].status, "canceled");
    assert.equal((await prisma.groupOrder.findUnique({ where: { id: "g1" } })).status, "CANCELLED");
  });

  test("fix round 2 (b): a cancel whose PaymentIntent already succeeded still cancels the group; a later confirm refunds in full", async () => {
    const { app, prisma, stripe, a } = await groupWithOrders();
    const pi = (await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1") })).json();
    stripe.intents[pi.paymentIntentId].status = "succeeded";
    const res = await app.inject({ method: "PATCH", url: "/group-orders/ABC234", headers: user("u1"), payload: { status: "CANCELLED" } });
    assert.equal(res.statusCode, 200, "the failed Stripe cancel doesn't fail the group cancel");
    const hook = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", payload: { paymentIntentId: pi.paymentIntentId } });
    assert.equal(hook.statusCode, 409);
    assert.equal(hook.json().refunded, true);
    assert.deepEqual(stripe.refundCalls.map((c) => c[0]), [{ payment_intent: pi.paymentIntentId }]);
    assert.equal((await prisma.order.findUnique({ where: { id: a.id } })).paymentStatus, "PENDING");
  });
});

describe("Task D11b: order credentials only on the viewer's own order", () => {
  const secretOrder = (id, extra) => ({
    id,
    groupOrderId: "g1",
    orderNumber: `ORD-${id.toUpperCase()}-NUM`,
    kitchenOrderNumber: "0042",
    orderQrCode: `qr-${id}-secret`,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    totalCents: 1599,
    amountDueCents: 1599,
    isGroupHost: false,
    stripePaymentIntentId: `pi_${id}_secret`,
    stripePaymentId: `ch_${id}_secret`,
    guestPhone: "555-0199",
    guestName: "Full Guest Name",
    giftCardId: `gc_${id}`,
    createdAt: NOW,
    seat: { id: "s1", number: "7", label: "B-07", status: "RESERVED", locationId: "L1" },
    items: [{ id: `i-${id}`, orderId: id, menuItemId: "classic", quantity: 1, priceCents: 1599, selectedValue: null, menuItem: { id: "classic", name: "Classic Beef Noodle Soup", category: "main01" } }],
    user: null,
    guest: null,
    ...extra,
  });
  const HOST_ORDER = secretOrder("oh", { userId: "u1", guestId: null, isGroupHost: true, user: { id: "u1", name: "Dana Kim", email: "u1@x.com" } });
  const MEMBER_ORDER = secretOrder("om", { userId: "u2", guestId: null, user: { id: "u2", name: "Jordan Rivera", email: "u2@x.com" } });
  const GUEST_ORDER = secretOrder("og", { userId: null, guestId: "guest2", guest: { id: "guest2", name: "Sam Lee", sessionToken: "gs_sam" } });
  const group = () => ({ ...GROUP, paymentIntentId: "pi_group_secret", paymentMethod: "HOST_PAYS_ALL", orders: [HOST_ORDER, MEMBER_ORDER, GUEST_ORDER].map((o) => ({ ...o })) });
  const CREDENTIALS = /ORD-O[HMG]-NUM|qr-o[hmg]-secret|0042/;
  const SECRETS = /pi_o[hmg]_secret|ch_o[hmg]_secret|pi_group_secret|555-0199|gs_sam|u1@x\.com|u2@x\.com/;

  test("a non-member code holder gets no order number or QR code for anyone, and no secret", async () => {
    const { app } = await buildApp({ groups: [group()] });
    const res = await app.inject({ method: "GET", url: "/group-orders/ABC234" });
    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(res.body, CREDENTIALS);
    assert.doesNotMatch(res.body, SECRETS);
    const body = res.json();
    for (const o of body.orders) {
      assert.equal("orderNumber" in o, false);
      assert.equal("orderQrCode" in o, false);
      assert.equal("giftCardId" in o, false);
      assert.equal("guestName" in o, false);
    }
    // Still enough for the lobby: status, money, items, pod, safe names, whose order is whose.
    const host = body.orders.find((o) => o.id === "oh");
    assert.equal(host.paymentStatus, "PENDING");
    assert.equal(host.totalCents, 1599);
    assert.equal(host.amountDueCents, 1599);
    assert.equal(host.isGroupHost, true);
    assert.equal(host.userId, "u1");
    assert.equal(host.user.name, "Dana K.");
    assert.deepEqual(host.seat, { id: "s1", number: "7", label: "B-07" });
    assert.equal(host.items[0].menuItem.name, "Classic Beef Noodle Soup");
    assert.equal(host.items[0].priceCents, 1599);
    assert.equal(body.orders.find((o) => o.id === "og").guest.name, "Sam L.");
  });

  test("a signed-in stranger (not in the group) sees no one's credentials", async () => {
    const { app } = await buildApp({ groups: [group()] });
    const res = await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: user("u9") });
    assert.doesNotMatch(res.body, CREDENTIALS);
    assert.doesNotMatch(res.body, SECRETS);
  });

  test("a member sees only their own order number and QR code; secrets stay stripped from their own order", async () => {
    const { app } = await buildApp({ groups: [group()] });
    const body = (await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: user("u2") })).json();
    const mine = body.orders.find((o) => o.id === "om");
    assert.equal(mine.orderNumber, "ORD-OM-NUM");
    assert.equal(mine.orderQrCode, "qr-om-secret");
    assert.equal(mine.user.name, "Jordan Rivera");
    for (const o of body.orders.filter((x) => x.id !== "om")) {
      assert.equal("orderNumber" in o, false);
      assert.equal("orderQrCode" in o, false);
    }
    assert.doesNotMatch(JSON.stringify(body), SECRETS);
  });

  test("a verified guest sees only their own; a bare guestId on /join unlocks nothing", async () => {
    const { app } = await buildApp({ groups: [group()] });
    const body = (await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: guestSession("gs_sam") })).json();
    assert.equal(body.orders.find((o) => o.id === "og").orderQrCode, "qr-og-secret");
    assert.equal("orderQrCode" in body.orders.find((o) => o.id === "oh"), false);

    const joined = await app.inject({ method: "POST", url: "/group-orders/ABC234/join", payload: { guestId: "guest2" } });
    assert.equal(joined.statusCode, 200);
    assert.doesNotMatch(joined.body, CREDENTIALS);
  });

  test("a guest session never unlocks a MEMBER's order that also carries that guest id", async () => {
    const linked = secretOrder("om", { userId: "u2", guestId: "guest2" });
    const { app } = await buildApp({ groups: [{ ...group(), orders: [linked] }] });
    const body = (await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: guestSession("gs_sam") })).json();
    assert.equal("orderQrCode" in body.orders[0], false);
  });

  test("the host (the payment page's server read forwards their session) gets their own order number", async () => {
    const { app } = await buildApp({ groups: [group()] });
    const body = (await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: user("u1") })).json();
    const hostOrder = body.orders.find((o) => o.isGroupHost);
    assert.equal(hostOrder.orderNumber, "ORD-OH-NUM");
    assert.equal("orderNumber" in body.orders.find((o) => o.id === "om"), false);
    assert.equal("paymentIntentId" in body, false);
  });

  test("staff see the full view", async () => {
    const { app } = await buildApp({ groups: [group()] });
    const body = (await app.inject({ method: "GET", url: "/group-orders/ABC234", headers: { "x-admin-api-key": "staff-key" } })).json();
    for (const id of ["oh", "om", "og"]) {
      const o = body.orders.find((x) => x.id === id);
      assert.equal(o.orderNumber, `ORD-${id.toUpperCase()}-NUM`);
      assert.equal(o.orderQrCode, `qr-${id}-secret`);
    }
    assert.equal(body.orders.find((x) => x.id === "oh").user.name, "Dana Kim");
    assert.equal(body.paymentIntentId, "pi_group_secret");
    assert.doesNotMatch(JSON.stringify(body), /gs_sam|u1@x\.com/);
  });

  test("host pays end to end: the host's confirm carries only the host's own credentials; the anonymous webhook confirm carries none", async () => {
    const { app, stripe } = await buildApp();
    const a = (await addOrder(app, "ABC234", user("u1"))).json();
    const b = (await addOrder(app, "ABC234", guestSession("gs_sam"), [{ menuItemId: "wagyu", quantity: 1 }])).json();
    assert.ok(a.orderNumber && a.orderQrCode, "the adder gets their own order's number and code back");
    assert.ok(b.orderNumber && b.orderQrCode);
    const pi = (await app.inject({ method: "POST", url: "/group-orders/ABC234/payment-intent", headers: user("u1") })).json();
    stripe.intents[pi.paymentIntentId].status = "succeeded";
    const ok = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", headers: user("u1"), payload: { paymentIntentId: pi.paymentIntentId } });
    assert.equal(ok.statusCode, 200);
    const orders = ok.json().orders;
    const hostOrder = orders.find((o) => o.id === a.id);
    const guestOrder = orders.find((o) => o.id === b.id);
    assert.equal(hostOrder.orderNumber, a.orderNumber);
    assert.equal(guestOrder.paymentStatus, "PAID");
    assert.equal("orderNumber" in guestOrder, false);
    assert.equal("orderQrCode" in guestOrder, false);
    assert.equal(ok.body.includes(b.orderQrCode), false);
    assert.equal(ok.body.includes(pi.paymentIntentId), false, "no Stripe reference comes back");

    const hook = await app.inject({ method: "POST", url: "/group-orders/ABC234/confirm-payment", payload: { paymentIntentId: pi.paymentIntentId } });
    assert.equal(hook.statusCode, 200);
    assert.equal(hook.body.includes(a.orderQrCode), false);
    assert.equal(hook.body.includes(b.orderQrCode), false);
    assert.equal(hook.body.includes(a.orderNumber), false);
  });
});
