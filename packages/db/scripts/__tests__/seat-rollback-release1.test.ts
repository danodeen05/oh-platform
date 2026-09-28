/**
 * Task G3 fix round 1: the seat rollback restores release 1's view in one
 * transaction (legacy seats back, comb pods gone or retired CLEANING), writes
 * nothing in a dry run, refuses while an order sits on a comb pod, and
 * seed-comb-seats afterwards brings the comb pods back as AVAILABLE.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../../api/src/__tests__/helpers/prisma-memory.js";
import { planAndRollbackSeats } from "../seat-rollback-release1.ts";
import { seedCombSeats } from "../seed-comb-seats.ts";
import { noWrites } from "./helpers/no-writes.ts";

const RETIRED = new Date("2026-10-01T04:00:00Z");
const NOW = new Date("2026-10-01T05:00:00Z");
const quiet = () => {};

async function world({ orderOnComb = null as null | string } = {}) {
  const locations = [
    { id: "cc", slug: "city-creek", isClosed: false },
    { id: "up", slug: "university-place", isClosed: false },
    { id: "cc_old", slug: null, isClosed: true },
  ];
  const legacy = (loc: string) =>
    Array.from({ length: 12 }, (_, i) => ({ id: `${loc}_l${i + 1}`, locationId: loc, number: String(i + 1).padStart(2, "0"), qrCode: `L-${loc}-${i}`, status: "AVAILABLE", podType: "SINGLE", retiredAt: null }));
  const prisma = makeMemoryPrisma({ locations, seats: [...legacy("cc"), ...legacy("up"), ...legacy("cc_old")] });
  // Seed like the cutover does: comb pods created, legacy retired at RETIRED.
  await seedCombSeats(prisma as any, { locationId: "cc", layoutKey: "comb-75", now: RETIRED });
  await seedCombSeats(prisma as any, { locationId: "up", layoutKey: "comb-70-mirrored", now: RETIRED });
  if (orderOnComb) {
    const seat = (await prisma.seat.findMany({ where: { locationId: "cc", retiredAt: null } }))[0];
    await prisma.order.create({ data: { id: "o1", seatId: seat.id, status: orderOnComb } });
  }
  return prisma;
}

async function active(prisma: any, loc: string) {
  const seats = await prisma.seat.findMany({ where: { locationId: loc, retiredAt: null } });
  return { comb: seats.filter((s: any) => /^[A-Z]-\d{2}$/.test(s.number)).length, legacy: seats.filter((s: any) => /^\d{2}$/.test(s.number)).length, total: (await prisma.seat.findMany({ where: { locationId: loc } })).length };
}

test("dry run prints the plan and writes nothing", async () => {
  const prisma = await world();
  const log: string[] = [];
  const counts = await planAndRollbackSeats(noWrites(prisma, log), { dryRun: true, now: NOW, retiredAt: RETIRED, log: quiet });
  assert.deepEqual(log, []);
  assert.deepEqual(counts["city-creek"], { legacyRevived: 12, combDeleted: 75, combRetired: 0, legacyActiveAfter: 12, combActiveAfter: 0 });
  assert.deepEqual(counts["university-place"], { legacyRevived: 12, combDeleted: 70, combRetired: 0, legacyActiveAfter: 12, combActiveAfter: 0 });
  assert.deepEqual(await active(prisma, "cc"), { comb: 75, legacy: 0, total: 87 });
});

test("real run restores release 1's pod list exactly; the closed duplicate is untouched", async () => {
  const prisma = await world();
  await prisma.order.create({ data: { id: "done", seatId: (await prisma.seat.findMany({ where: { locationId: "up", retiredAt: null } }))[3].id, status: "COMPLETED" } });
  const counts = await planAndRollbackSeats(prisma, { dryRun: false, now: NOW, retiredAt: RETIRED, log: quiet });
  assert.deepEqual(await active(prisma, "cc"), { comb: 0, legacy: 12, total: 12 });
  assert.equal(counts["university-place"].combDeleted, 69);
  assert.equal(counts["university-place"].combRetired, 1, "a pod with order history is kept, retired");
  const kept = (await prisma.seat.findMany({ where: { locationId: "up" } })).filter((s: any) => /^[A-Z]-/.test(s.number));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].status, "CLEANING");
  assert.equal((await prisma.seat.findMany({ where: { locationId: "cc_old", retiredAt: null } })).length, 12);
  // No duo link points at a deleted pod.
  const ids = new Set((await prisma.seat.findMany({})).map((s: any) => s.id));
  assert.ok((await prisma.seat.findMany({})).every((s: any) => !s.dualPartnerId || ids.has(s.dualPartnerId)));
});

test("a second run is a no-op, and seed-comb-seats goes forward again with AVAILABLE comb pods", async () => {
  const prisma = await world();
  await prisma.order.create({ data: { id: "done", seatId: (await prisma.seat.findMany({ where: { locationId: "cc", retiredAt: null } }))[0].id, status: "COMPLETED" } });
  await planAndRollbackSeats(prisma, { dryRun: false, now: NOW, retiredAt: RETIRED, log: quiet });
  const again = await planAndRollbackSeats(noWrites(prisma), { dryRun: true, now: NOW, retiredAt: RETIRED, log: quiet });
  assert.equal(again["city-creek"].legacyRevived + again["city-creek"].combDeleted + again["city-creek"].combRetired, 0);

  const forward = await seedCombSeats(prisma as any, { locationId: "cc", layoutKey: "comb-75", now: new Date("2026-10-01T06:00:00Z") });
  assert.equal(forward.created, 74);
  assert.equal(forward.updated, 1, "the retired CLEANING pod is revived");
  assert.equal(forward.retired, 12);
  const combs = await prisma.seat.findMany({ where: { locationId: "cc", retiredAt: null } });
  assert.equal(combs.length, 75);
  assert.ok(combs.every((s: any) => s.status === "AVAILABLE"));
});

test("refuses (and writes nothing) while an unfinished order sits on a comb pod", async () => {
  const prisma = await world({ orderOnComb: "QUEUED" });
  await assert.rejects(planAndRollbackSeats(prisma, { dryRun: false, now: NOW, log: quiet }), /unfinished order/);
  assert.deepEqual(await active(prisma, "cc"), { comb: 75, legacy: 0, total: 87 });
});

test("--keep-unused retires every comb pod as CLEANING instead of deleting", async () => {
  const prisma = await world();
  const counts = await planAndRollbackSeats(prisma, { dryRun: false, now: NOW, keepUnused: true, log: quiet });
  assert.equal(counts["city-creek"].combRetired, 75);
  assert.deepEqual(await active(prisma, "cc"), { comb: 0, legacy: 12, total: 87 });
});
