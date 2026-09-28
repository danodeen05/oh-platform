/**
 * Task D12 fix round 1: kiosk pod claims go through the conditional claim
 * (pickBestPod / claimSeat), before payment, and PATCH /orders/:id no longer
 * writes seats.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerOrderRoutes } from "../../orders/routes.js";
import { registerStatusDemoGuard } from "../../demo/status-demo.js";
import { seed, fakeStripe, fakeEffects, NOW } from "../../orders/__tests__/fixtures.js";
import { assignKioskSeat, claimCheckInSeat, parseSeatRequest } from "../kiosk-seat.js";

const unpaid = (id, extra = {}) => ({ id, locationId: "L1", tenantId: "t1", totalCents: 1999, amountDueCents: 1999, paymentStatus: "PENDING", status: "PENDING_PAYMENT", orderSource: "KIOSK", createdAt: new Date(NOW.getTime() - 5 * 60 * 1000), ...extra });
const KIOSK = { authorization: "Bearer kiosk_L1" };
const fakeKioskAuth = { async deviceFor(req) { return req.headers.authorization === "Bearer kiosk_L1" ? { id: "dev1", locationId: "L1", isActive: true } : null; } };
const fakeCustomerAuth = { async resolve() { return { kind: "anonymous" }; }, async requireUser(req, reply) { reply.code(401).send({}); return null; } };

async function buildApp(prisma) {
  const app = Fastify({ logger: false });
  registerStatusDemoGuard(app, { source: { menuItems: async () => [] } });
  await registerOrderRoutes(app, { prisma, stripe: fakeStripe(), customerAuth: fakeCustomerAuth, kioskAuth: fakeKioskAuth, effects: fakeEffects().effects, now: () => NOW });
  await app.ready();
  return app;
}

const seatOf = async (prisma, id) => prisma.seat.findUnique({ where: { id } });
const orderOf = async (prisma, id) => prisma.order.findUnique({ where: { id } });

describe("assignKioskSeat", () => {
  test("two concurrent claims of the same label: exactly one wins; the other gets POD_TAKEN and a different pod", async () => {
    const prisma = seed({ orders: [unpaid("o1"), unpaid("o2")] });
    const [a, b] = await Promise.all([
      assignKioskSeat(prisma, { locationId: "L1", orderId: "o1", request: { label: "B-07" }, now: NOW }),
      assignKioskSeat(prisma, { locationId: "L1", orderId: "o2", request: { label: "B-07" }, now: NOW }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const winners = [a, b].filter((r) => r.body.label === "B-07");
    const loser = [a, b].find((r) => r.body.label !== "B-07");
    assert.equal(winners.length, 1);
    assert.equal(winners[0].body.fallback, false);
    assert.equal(loser.body.code, "POD_TAKEN");
    assert.equal(loser.body.requested, "B-07");
    assert.notEqual(loser.body.label, "B-07");
    const o1 = await orderOf(prisma, "o1");
    const o2 = await orderOf(prisma, "o2");
    assert.notEqual(o1.seatId, o2.seatId, "never two orders on one pod");
    assert.equal((await seatOf(prisma, o1.seatId)).status, "RESERVED");
    assert.equal((await seatOf(prisma, o2.seatId)).status, "RESERVED");
    assert.ok(o1.podReservationExpiry > NOW, "an unpaid hold that the release job can expire");
  });

  test("re-picking releases the order's previous pod; best:true takes the entry-nearest free pod", async () => {
    const prisma = seed({ orders: [unpaid("o1")] });
    await assignKioskSeat(prisma, { locationId: "L1", orderId: "o1", request: { label: "B-07" }, now: NOW });
    const r = await assignKioskSeat(prisma, { locationId: "L1", orderId: "o1", request: { best: true }, now: NOW });
    assert.equal(r.status, 200);
    assert.equal(r.body.label, "A-01");
    assert.equal((await seatOf(prisma, "s-b07")).status, "AVAILABLE");
    assert.equal((await orderOf(prisma, "o1")).podSelectionMethod, "AUTO");
  });

  test("a duo for a party: both halves claimed; the second guest shares the other half without a second claim", async () => {
    const prisma = seed({ orders: [unpaid("o1"), unpaid("o2")] });
    const host = await assignKioskSeat(prisma, { locationId: "L1", orderId: "o1", request: { label: "C-01", dual: true }, now: NOW });
    assert.equal(host.body.label, "C-01");
    assert.equal(host.body.partnerLabel, "C-02");
    const guest = await assignKioskSeat(prisma, { locationId: "L1", orderId: "o2", request: { shareWithOrderId: "o1" }, now: NOW });
    assert.equal(guest.status, 200);
    assert.equal(guest.body.label, "C-02");
    // Re-seating the guest must not free the host's half.
    await assignKioskSeat(prisma, { locationId: "L1", orderId: "o2", request: { shareWithOrderId: "o1" }, now: NOW });
    assert.equal((await seatOf(prisma, "s-c02")).status, "RESERVED");
    assert.equal((await seatOf(prisma, "s-c01")).status, "RESERVED");
  });

  test("refusals: other location 404, paid 409; a lost pick keeps the order's own pod; nothing free is 409", async () => {
    const prisma = seed({ orders: [unpaid("o1"), unpaid("o3"), unpaid("o9", { locationId: "L2" }), unpaid("op", { paymentStatus: "PAID", status: "QUEUED" })] });
    assert.equal((await assignKioskSeat(prisma, { locationId: "L1", orderId: "o9", request: { best: true }, now: NOW })).status, 404);
    assert.equal((await assignKioskSeat(prisma, { locationId: "L1", orderId: "op", request: { best: true }, now: NOW })).body.code, "ORDER_PAID");
    await assignKioskSeat(prisma, { locationId: "L1", orderId: "o1", request: { label: "A-01" }, now: NOW });
    await prisma.seat.updateMany({ where: { status: "AVAILABLE" }, data: { status: "OCCUPIED" } });
    // B-07 is gone; the only free pod is the one o1 already held, so it gets that back.
    const back = await assignKioskSeat(prisma, { locationId: "L1", orderId: "o1", request: { label: "B-07" }, now: NOW });
    assert.equal(back.status, 200);
    assert.equal(back.body.code, "POD_TAKEN");
    assert.equal(back.body.label, "A-01");
    assert.equal((await seatOf(prisma, "s-a01")).status, "RESERVED");
    const none = await assignKioskSeat(prisma, { locationId: "L1", orderId: "o3", request: { label: "B-07" }, now: NOW });
    assert.equal(none.status, 409);
    assert.equal(none.body.code, "NO_POD_AVAILABLE");
    assert.equal((await orderOf(prisma, "o3")).seatId ?? null, null);
  });

  describe("fix round 3: a duo share is bound to the same unpaid kiosk party", () => {
    const share = (prisma, orderId, hostId) => assignKioskSeat(prisma, { locationId: "L1", orderId, request: { shareWithOrderId: hostId }, now: NOW });

    test("sharing a paid stranger's duo is refused: POD_TAKEN with the next best pod", async () => {
      const prisma = seed({ orders: [
        unpaid("host", { paymentStatus: "PAID", status: "QUEUED", seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02" }),
        unpaid("me"),
      ] });
      await prisma.seat.updateMany({ where: { id: { in: ["s-c01", "s-c02"] } }, data: { status: "RESERVED" } });
      const r = await share(prisma, "me", "host");
      assert.equal(r.status, 200);
      assert.equal(r.body.code, "POD_TAKEN");
      assert.equal(r.body.requested, "C-02");
      assert.notEqual(r.body.label, "C-02");
      const me = await orderOf(prisma, "me");
      assert.notEqual(me.seatId, "s-c02");
      assert.notEqual(me.podSelectionMethod, "DUO_SHARED");
    });

    test("a third order onto an already-shared half is refused", async () => {
      const prisma = seed({ orders: [unpaid("host"), unpaid("g2"), unpaid("g3")] });
      await assignKioskSeat(prisma, { locationId: "L1", orderId: "host", request: { label: "C-01", dual: true }, now: NOW });
      assert.equal((await share(prisma, "g2", "host")).body.label, "C-02");
      const third = await share(prisma, "g3", "host");
      assert.equal(third.body.code, "POD_TAKEN");
      assert.notEqual((await orderOf(prisma, "g3")).seatId, "s-c02");
      assert.equal((await orderOf(prisma, "g2")).seatId, "s-c02");
    });

    test("a stale host (over 30 minutes), a web order or another location's order can't be shared", async () => {
      const old = new Date(NOW.getTime() - 45 * 60 * 1000);
      for (const hostExtra of [{ createdAt: old }, { orderSource: "WEB" }]) {
        const prisma = seed({ orders: [unpaid("host", { seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02", ...hostExtra }), unpaid("me")] });
        await prisma.seat.updateMany({ where: { id: { in: ["s-c01", "s-c02"] } }, data: { status: "RESERVED" } });
        assert.equal((await share(prisma, "me", "host")).body.code, "POD_TAKEN", JSON.stringify(hostExtra));
      }
    });

    test("a valid party share still works, and a cancelled order can't claim a pod", async () => {
      const prisma = seed({ orders: [unpaid("host"), unpaid("g2"), unpaid("gone", { status: "CANCELLED" })] });
      await assignKioskSeat(prisma, { locationId: "L1", orderId: "host", request: { label: "C-01", dual: true }, now: NOW });
      const r = await share(prisma, "g2", "host");
      assert.equal(r.body.code, undefined);
      assert.equal(r.body.label, "C-02");
      assert.equal((await orderOf(prisma, "g2")).podSelectionMethod, "DUO_SHARED");
      const cancelled = await assignKioskSeat(prisma, { locationId: "L1", orderId: "gone", request: { best: true }, now: NOW });
      assert.equal(cancelled.status, 409);
      assert.equal(cancelled.body.code, "ORDER_NOT_OPEN");
    });
  });

  test("parseSeatRequest accepts only label, best or shareWithOrderId", () => {
    assert.deepEqual(parseSeatRequest({ label: "B-07" }), { label: "B-07", dual: false });
    assert.deepEqual(parseSeatRequest({ best: true, dual: true }), { best: true, dual: true });
    assert.deepEqual(parseSeatRequest({ shareWithOrderId: "o1" }), { shareWithOrderId: "o1" });
    assert.equal(parseSeatRequest({ seatId: "s-b07" }), null);
    assert.equal(parseSeatRequest(null), null);
  });
});

describe("routes", () => {
  test("POST /kiosk/orders/:id/seat needs the kiosk device key", async () => {
    const prisma = seed({ orders: [unpaid("o1")] });
    const app = await buildApp(prisma);
    assert.equal((await app.inject({ method: "POST", url: "/kiosk/orders/o1/seat", payload: { label: "B-07" } })).statusCode, 401);
    const ok = await app.inject({ method: "POST", url: "/kiosk/orders/o1/seat", headers: KIOSK, payload: { label: "B-07" } });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(ok.json().label, "B-07");
    assert.equal((await app.inject({ method: "POST", url: "/kiosk/orders/o1/seat", headers: KIOSK, payload: {} })).statusCode, 400);
  });

  test("PATCH /orders/:id with seatId (or any seat field) is 400 and writes nothing", async () => {
    const prisma = seed({ orders: [unpaid("o1")] });
    const app = await buildApp(prisma);
    for (const payload of [{ seatId: "s-b07" }, { podSelectionMethod: "CUSTOMER_SELECTED" }, { podAssignedAt: NOW.toISOString() }, { podReservationExpiry: NOW.toISOString() }]) {
      const res = await app.inject({ method: "PATCH", url: "/orders/o1", payload });
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
    }
    assert.equal((await orderOf(prisma, "o1")).seatId ?? null, null);
    assert.equal((await seatOf(prisma, "s-b07")).status, "AVAILABLE");
  });
});

describe("claimCheckInSeat", () => {
  const paid = (id, extra = {}) => unpaid(id, { paymentStatus: "PAID", status: "PAID", ...extra });

  test("check-in can't take a pod another order holds; a free one is claimed", async () => {
    const prisma = seed({ orders: [unpaid("o1"), paid("o2")] });
    await assignKioskSeat(prisma, { locationId: "L1", orderId: "o1", request: { label: "B-07" }, now: NOW });
    const o2 = await orderOf(prisma, "o2");
    assert.equal(await claimCheckInSeat(prisma, { order: o2, seatId: "s-b07", data: { status: "QUEUED" } }), null);
    assert.equal((await orderOf(prisma, "o2")).seatId ?? null, null);
    assert.equal((await orderOf(prisma, "o1")).seatId, "s-b07");

    const got = await claimCheckInSeat(prisma, { order: o2, seatId: "s-a02", data: { status: "QUEUED" } });
    assert.equal(got.seat.label, "A-02");
    assert.equal((await orderOf(prisma, "o2")).seatId, "s-a02");
    assert.equal((await seatOf(prisma, "s-a02")).status, "RESERVED");
  });

  test("a retired seat or one at another location is refused", async () => {
    const prisma = seed({ orders: [paid("o2")] });
    const o2 = await orderOf(prisma, "o2");
    assert.equal(await claimCheckInSeat(prisma, { order: o2, seatId: "s-old", data: {} }), null);
    assert.equal(await claimCheckInSeat(prisma, { order: { ...o2, locationId: "L2" }, seatId: "s-a01", data: {} }), null);
  });
});
