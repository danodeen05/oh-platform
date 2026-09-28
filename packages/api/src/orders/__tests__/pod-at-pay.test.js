/**
 * Task D12 fix round 2: the pod at pay time. markPaid never reserves a pod
 * unconditionally: a pod still held for the order is kept, a freed one is
 * re-claimed with claimSeat, one another order took is replaced by the next
 * best pod, and with no pod free the order is still PAID, seatless, with a
 * POD_ISSUE support case for staff.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW } from "./fixtures.js";
import { markPaid, markPaidBatch } from "../service.js";

const MIN = 60 * 1000;
const LAPSED = new Date(NOW.getTime() - 5 * MIN);
const VALID = new Date(NOW.getTime() + 10 * MIN);

/** A zero-balance order (no PaymentIntent needed) holding pod `seatId` until `expiry`. */
const order = (id, extra = {}) => ({
  id, orderNumber: `N-${id}`, userId: null, locationId: "L1", tenantId: "t1", totalCents: 0, amountDueCents: 0, creditsAppliedCents: 0,
  paymentStatus: "PENDING", status: "PENDING_PAYMENT", orderSource: "KIOSK", createdAt: new Date(NOW.getTime() - 5 * MIN), ...extra,
});
const pay = (prisma, id) => markPaid(prisma, fakeStripe(), { orderId: id, now: NOW }, fakeEffects().effects);
const seat = (prisma, id) => prisma.seat.findUnique({ where: { id } });
const get = (prisma, id) => prisma.order.findUnique({ where: { id } });

function withSeats(orders, seatStatus = {}) {
  const prisma = seed({ orders });
  return (async () => {
    for (const [id, status] of Object.entries(seatStatus)) await prisma.seat.update({ where: { id }, data: { status } });
    return prisma;
  })();
}

describe("markPaid: the pod at pay time", () => {
  test("a hold that is still valid is unchanged", async () => {
    const prisma = await withSeats([order("o1", { seatId: "s-b07", podReservationExpiry: VALID })], { "s-b07": "RESERVED" });
    const r = await pay(prisma, "o1");
    assert.equal(r.podChange, undefined);
    const o = await get(prisma, "o1");
    assert.equal(o.paymentStatus, "PAID");
    assert.equal(o.seatId, "s-b07");
    assert.equal((await seat(prisma, "s-b07")).status, "RESERVED");
  });

  test("an expired hold on a pod that is still free re-claims the same pod", async () => {
    // The release job freed the seat but the order still names it.
    const prisma = await withSeats([order("o1", { seatId: "s-b07", podReservationExpiry: LAPSED })], { "s-b07": "AVAILABLE" });
    const r = await pay(prisma, "o1");
    assert.equal(r.podChange, undefined);
    assert.equal((await get(prisma, "o1")).seatId, "s-b07");
    assert.equal((await seat(prisma, "s-b07")).status, "RESERVED");
    assert.ok((await get(prisma, "o1")).podReservationExpiry > NOW, "a fresh 15 minute hold from payment");
  });

  test("an expired hold on a pod another order took: reassigned to the next best pod, never double-booked", async () => {
    const prisma = await withSeats([
      order("o1", { seatId: "s-b07", podReservationExpiry: LAPSED }),
      order("o2", { seatId: "s-b07", paymentStatus: "PAID", status: "QUEUED", podReservationExpiry: VALID }),
    ], { "s-b07": "RESERVED" });
    const r = await pay(prisma, "o1");
    const o1 = await get(prisma, "o1");
    assert.equal(o1.paymentStatus, "PAID");
    assert.notEqual(o1.seatId, "s-b07");
    assert.equal(o1.seatId, "s-a01", "the entry-nearest free pod");
    assert.equal((await seat(prisma, "s-a01")).status, "RESERVED");
    assert.equal((await get(prisma, "o2")).seatId, "s-b07", "the other order keeps its pod");
    assert.deepEqual(r.podChange, { changed: true, from: "B-07", to: "A-01" });
    assert.equal(o1.podReleasedNumber, "B-07");
    assert.equal(o1.podSelectionMethod, "AUTO");
  });

  test("a lapsed hold on a pod someone is sitting at (OCCUPIED) also moves", async () => {
    const prisma = await withSeats([order("o1", { seatId: "s-b07", podReservationExpiry: LAPSED })], { "s-b07": "OCCUPIED" });
    const r = await pay(prisma, "o1");
    assert.equal(r.podChange.to, "A-01");
    assert.equal((await seat(prisma, "s-b07")).status, "OCCUPIED");
  });

  test("no free pod at all: still PAID, no seat, and a POD_ISSUE case for staff", async () => {
    const prisma = await withSeats([
      order("o1", { seatId: "s-b07", podReservationExpiry: LAPSED }),
      order("o2", { seatId: "s-b07", paymentStatus: "PAID", status: "QUEUED" }),
    ], { "s-a01": "OCCUPIED", "s-a02": "OCCUPIED", "s-b07": "RESERVED", "s-c01": "OCCUPIED", "s-c02": "OCCUPIED" });
    const r = await pay(prisma, "o1");
    const o1 = await get(prisma, "o1");
    assert.equal(o1.paymentStatus, "PAID");
    assert.equal(o1.seatId ?? null, null);
    assert.deepEqual(r.podChange, { changed: true, noPod: true, from: "B-07", to: null });
    const cases = await prisma.supportCase.findMany({ where: { orderId: "o1" } });
    assert.equal(cases.length, 1);
    assert.equal(cases[0].type, "POD_ISSUE");
    assert.equal(cases[0].status, "OPEN");
    assert.match(cases[0].summary, /No pod available at pay time/);
  });

  test("a duo keeps both halves while held; a lost half moves the party to another duo", async () => {
    const held = await withSeats([order("o1", { seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02", podReservationExpiry: VALID })], { "s-c01": "RESERVED", "s-c02": "RESERVED" });
    assert.equal((await pay(held, "o1")).podChange, undefined);

    const lost = await withSeats([
      order("o1", { seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02", podReservationExpiry: LAPSED }),
      order("o2", { seatId: "s-c02", paymentStatus: "PAID", status: "QUEUED" }),
    ], { "s-c01": "RESERVED", "s-c02": "RESERVED" });
    const r = await pay(lost, "o1");
    const o1 = await get(lost, "o1");
    // No other duo is free in the fixture: the party of two gets the best single pod, and C-01 goes back.
    assert.equal(r.podChange.from, "C-01");
    assert.equal(o1.seatId, "s-a01");
    assert.equal((await seat(lost, "s-c01")).status, "AVAILABLE");
    assert.equal((await get(lost, "o2")).seatId, "s-c02");
  });

  test("a kiosk party sharing a duo pays together without either guest being moved", async () => {
    const prisma = await withSeats([
      order("o1", { seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02", podReservationExpiry: VALID }),
      order("o2", { seatId: "s-c02", podSelectionMethod: "DUO_SHARED", podReservationExpiry: VALID }),
    ], { "s-c01": "RESERVED", "s-c02": "RESERVED" });
    const r = await markPaidBatch(prisma, fakeStripe(), { orderIds: ["o1", "o2"], locationId: "L1", now: NOW }, fakeEffects().effects);
    assert.equal(r.podChanges, undefined);
    assert.equal((await get(prisma, "o1")).seatId, "s-c01");
    assert.equal((await get(prisma, "o2")).seatId, "s-c02");
  });

  test("fix round 3: a DUO_SHARED marker on a paid stranger's half is not trusted; the guest moves", async () => {
    const prisma = await withSeats([
      order("host", { seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02", paymentStatus: "PAID", status: "QUEUED", stripePaymentId: "pi_other", paidAt: new Date(NOW.getTime() - 10 * MIN) }),
      order("me", { seatId: "s-c02", podSelectionMethod: "DUO_SHARED", podReservationExpiry: VALID }),
    ], { "s-c01": "RESERVED", "s-c02": "RESERVED" });
    const r = await pay(prisma, "me");
    assert.equal(r.podChange.from, "C-02");
    assert.equal((await get(prisma, "me")).seatId, "s-a01");
    assert.equal((await get(prisma, "host")).seatId, "s-c01");
    assert.equal((await seat(prisma, "s-c02")).status, "RESERVED", "the host keeps its half");
  });

  test("fix round 3: a web order marked DUO_SHARED is not a party share either", async () => {
    const prisma = await withSeats([
      order("host", { seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02", podReservationExpiry: VALID }),
      order("me", { seatId: "s-c02", podSelectionMethod: "DUO_SHARED", orderSource: "WEB", podReservationExpiry: VALID }),
    ], { "s-c01": "RESERVED", "s-c02": "RESERVED" });
    assert.equal((await pay(prisma, "me")).podChange.to, "A-01");
  });

  test("fix round 3: losing the FIRST half of a duo releases the second half too", async () => {
    const prisma = await withSeats([
      order("o1", { seatId: "s-c01", isDualPod: true, dualPartnerSeatId: "s-c02", podReservationExpiry: LAPSED }),
      order("o2", { seatId: "s-c01", paymentStatus: "PAID", status: "QUEUED" }),
    ], { "s-c01": "RESERVED", "s-c02": "RESERVED" });
    await pay(prisma, "o1");
    assert.equal((await get(prisma, "o1")).seatId, "s-a01");
    assert.equal((await seat(prisma, "s-c02")).status, "AVAILABLE", "no orphaned RESERVED half");
    assert.equal((await seat(prisma, "s-c01")).status, "RESERVED", "o2 keeps its pod");
  });
});
