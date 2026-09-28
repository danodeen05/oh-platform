/**
 * Task G3 fix round 1: retired pre-comb seats keep status AVAILABLE, so every
 * path that picks or counts pods must filter `retiredAt: null`. The legacy
 * "01".."12" numbers also sort before the comb labels, which is how the old
 * queue ended up trying only retired pods.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { assignQueue, listFreePods, pickAutoPod, retiredPodInfo, POD_RETIRED } from "../free-pods.js";

const RETIRED_AT = new Date("2026-10-01T04:00:00Z");
const LOC = "loc_cc";

function legacySeats() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `legacy_${i + 1}`,
    locationId: LOC,
    number: String(i + 1).padStart(2, "0"),
    label: null,
    status: "AVAILABLE",
    retiredAt: RETIRED_AT,
    bestRank: null,
  }));
}

function combSeats() {
  return [
    { id: "a01", locationId: LOC, number: "A-01", label: "A-01", finger: 0, position: 1, status: "AVAILABLE", retiredAt: null, bestRank: 3 },
    { id: "b07", locationId: LOC, number: "B-07", label: "B-07", finger: 1, position: 7, status: "AVAILABLE", retiredAt: null, bestRank: 1 },
    { id: "c02", locationId: LOC, number: "C-02", label: "C-02", finger: 2, position: 2, status: "OCCUPIED", retiredAt: null, bestRank: 2 },
    { id: "other", locationId: "loc_up", number: "A-01", label: "A-01", status: "AVAILABLE", retiredAt: null, bestRank: 1 },
  ];
}

function world({ waiting = 2 } = {}) {
  const orders = [];
  const waitQueues = [];
  for (let i = 0; i < waiting; i++) {
    orders.push({ id: `o${i}`, locationId: LOC, seatId: null, userId: null });
    waitQueues.push({ id: `w${i}`, locationId: LOC, orderId: `o${i}`, status: "WAITING", priority: 100 - i });
  }
  return makeMemoryPrisma({ seats: [...legacySeats(), ...combSeats()], orders, waitQueues });
}

const quiet = () => {};

test("listFreePods returns active AVAILABLE pods at the location only, best first", async () => {
  const prisma = world();
  const pods = await listFreePods(prisma, LOC);
  assert.deepEqual(pods.map((p) => p.id), ["b07", "a01"]);
});

test("the queue assigns comb pods while 12 legacy AVAILABLE seats exist (retired ones never tried)", async () => {
  const prisma = world({ waiting: 2 });
  const notified = [];
  const res = await assignQueue(prisma, LOC, { notify: async (o) => notified.push(o.id), log: quiet });
  assert.equal(res.assigned, 2);
  assert.deepEqual(res.assignments.map((a) => a.podNumber), ["B-07", "A-01"]);
  assert.equal((await prisma.order.findUnique({ where: { id: "o0" } })).seatId, "b07", "highest priority gets the best pod");
  assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).seatId, "a01");
  assert.deepEqual(notified, ["o0", "o1"]);
  for (const s of legacySeats()) assert.equal((await prisma.seat.findUnique({ where: { id: s.id } })).status, "AVAILABLE", "legacy seats untouched");
  assert.equal((await prisma.waitQueue.findUnique({ where: { id: "w0" } })).status, "ASSIGNED");
});

test("a pod taken meanwhile is skipped and the same guest gets the next pod", async () => {
  const prisma = world({ waiting: 1 });
  // The list is read, then a checkout takes B-07 before the queue's claim.
  const stale = await listFreePods(prisma, LOC);
  await prisma.seat.update({ where: { id: "b07" }, data: { status: "RESERVED" } });
  const realFindMany = prisma.seat.findMany;
  prisma.seat.findMany = async () => stale;
  const res = await assignQueue(prisma, LOC, { log: quiet });
  prisma.seat.findMany = realFindMany;
  assert.equal(res.assigned, 1);
  assert.equal((await prisma.order.findUnique({ where: { id: "o0" } })).seatId, "a01");
});

test("assign-pod auto picks the best active pod, and null when only retired seats are free", async () => {
  const prisma = world();
  assert.equal((await pickAutoPod(prisma, LOC)).id, "b07");
  const onlyLegacy = makeMemoryPrisma({ seats: legacySeats() });
  assert.equal(await pickAutoPod(onlyLegacy, LOC), null);
  const res = await assignQueue(makeMemoryPrisma({ seats: legacySeats(), waitQueues: [{ id: "w", locationId: LOC, orderId: "o", status: "WAITING", priority: 1 }] }), LOC, { log: quiet });
  assert.equal(res.assigned, 0);
});

test("an old sticker on a retired pod answers retired (not an error); a live pod or a legacy order on it does not", () => {
  const pod = { id: "legacy_1", number: "01", label: null, qrCode: "POD-x-01", retiredAt: RETIRED_AT, location: { id: LOC, name: "City Creek", city: "SLC" } };
  const info = retiredPodInfo(pod, null);
  assert.equal(info.retired, true);
  assert.equal(info.code, POD_RETIRED);
  assert.equal(info.hasActiveOrder, false);
  assert.deepEqual(info.location, { id: LOC, name: "City Creek", city: "SLC" });
  assert.equal(retiredPodInfo({ ...pod, retiredAt: null }, null), null);
  assert.equal(retiredPodInfo(pod, { id: "o1" }), null);
});
