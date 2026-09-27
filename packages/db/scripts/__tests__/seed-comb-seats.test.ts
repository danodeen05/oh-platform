/**
 * Task A8: seedCombSeats. Not part of the required `pnpm --filter @oh/api
 * test` / `@oh/web test` / `@oh/floor-plan test` verification set (the API
 * never imports `@oh/floor-plan` or this TypeScript script - see the script's
 * own header comment), but run directly with `tsx --test` for TDD evidence.
 * Run with: pnpm --filter @oh/db test
 *
 * Uses a tiny local fake Prisma (just the `seat` calls the script makes),
 * not the API's `prisma-memory` helper, which lives in another workspace
 * package and is scoped to the API's own tests. `create`/`update` enforce
 * the same unique indexes Postgres does (Task A8 fix round 1, Important):
 * `(locationId, number)`, `qrCode`, and `dualPartnerId` (nulls never clash,
 * matching Postgres), throwing a Prisma-shaped `P2002` on a clash - so a
 * repeat or partially-cleared seed run that accidentally violates one of
 * these is actually caught here, not just asserted by hand.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildLayout, LOCATION_LAYOUTS, podLabel, rankPodsByEntry } from "@oh/floor-plan";
import { seedCombSeats } from "../seed-comb-seats.ts";

const UNIQUE_INDEXES: readonly (readonly string[])[] = [["locationId", "number"], ["qrCode"], ["dualPartnerId"]];

/** Throws a Prisma-shaped P2002 if `candidate` (a full record, post-write) clashes with any OTHER seat on a unique index. `excludeId` is the record being written (self-clashes, e.g. re-writing the same value, are not a clash). */
function assertUnique(seats: Map<string, any>, excludeId: string | undefined, candidate: Record<string, unknown>) {
  for (const fields of UNIQUE_INDEXES) {
    if (fields.some((f) => candidate[f] === null || candidate[f] === undefined)) continue;
    for (const [otherId, other] of seats) {
      if (otherId === excludeId) continue;
      if (fields.every((f) => other[f] === candidate[f])) {
        const err = new Error(`fake prisma: unique constraint failed on Seat(${fields.join(", ")})`);
        (err as any).code = "P2002";
        (err as any).meta = { target: fields };
        throw err;
      }
    }
  }
}

function makeFakeSeatPrisma(initialSeats: any[] = []) {
  let seq = 0;
  const seats = new Map<string, any>(initialSeats.map((s) => [s.id, { retiredAt: null, dualPartnerId: null, ...s }]));
  // The constructor above bypasses assertUnique (it's fixture setup, not code under test).
  return {
    _seats: seats,
    seat: {
      async findFirst({ where }: any) {
        for (const s of seats.values()) {
          if (where.locationId !== undefined && s.locationId !== where.locationId) continue;
          if (where.number !== undefined && s.number !== where.number) continue;
          return { ...s };
        }
        return null;
      },
      async create({ data }: any) {
        const id = data.id ?? `seat_${++seq}`;
        const rec = { retiredAt: null, dualPartnerId: null, ...data, id };
        assertUnique(seats, undefined, rec);
        seats.set(id, rec);
        return { ...rec };
      },
      async update({ where, data }: any) {
        const rec = seats.get(where.id);
        if (!rec) throw new Error(`fake prisma: seat not found for update: ${where.id}`);
        const merged = { ...rec, ...data };
        assertUnique(seats, where.id, merged);
        Object.assign(rec, data);
        return { ...rec };
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const s of seats.values()) {
          if (where.locationId !== undefined && s.locationId !== where.locationId) continue;
          if ("retiredAt" in where && where.retiredAt === null && s.retiredAt != null) continue;
          if (where.number?.notIn && !where.number.notIn.includes(s.number)) {
            Object.assign(s, data);
            count += 1;
          }
        }
        return { count };
      },
      async findMany({ where }: any = {}) {
        return [...seats.values()].filter((s) => where?.locationId === undefined || s.locationId === where.locationId);
      },
    },
  };
}

describe("seedCombSeats", () => {
  test("City Creek (comb-75, unmirrored): seeds 75 active pods, none retired on a clean location", async () => {
    const prisma = makeFakeSeatPrisma();
    const result = await seedCombSeats(prisma, { locationId: "city-creek-id", layoutKey: "comb-75" });
    assert.equal(result.created, 75);
    assert.equal(result.retired, 0);
    const active = (await prisma.seat.findMany({ where: { locationId: "city-creek-id" } })).filter((s: any) => !s.retiredAt);
    assert.equal(active.length, 75);
  });

  test("University Place (comb-70-mirrored): seeds 70 active pods and links 5 duo pairs bidirectionally", async () => {
    const prisma = makeFakeSeatPrisma();
    const result = await seedCombSeats(prisma, { locationId: "univ-id", layoutKey: "comb-70-mirrored" });
    assert.equal(result.created, 70);
    const seats = await prisma.seat.findMany({ where: { locationId: "univ-id" } });
    assert.equal(seats.length, 70);
    const duoSeats = seats.filter((s: any) => s.podType === "DUAL");
    assert.equal(duoSeats.length, 10); // 5 pairs
    for (const s of duoSeats) {
      assert.ok(s.dualPartnerId, `seat ${s.label} should have a dualPartnerId`);
      const partner = seats.find((p: any) => p.id === s.dualPartnerId);
      assert.ok(partner, `partner for ${s.label} should exist`);
      assert.equal(partner.dualPartnerId, s.id, "duo link must be bidirectional");
    }
  });

  test("retires legacy 01..12 seats and a second run is a no-op (idempotent)", async () => {
    const legacy = Array.from({ length: 12 }, (_, i) => ({
      id: `legacy-${i + 1}`,
      locationId: "city-creek-id",
      number: String(i + 1).padStart(2, "0"),
      qrCode: `POD-legacy-${i + 1}`,
      status: "AVAILABLE",
      podType: "SINGLE",
    }));
    const prisma = makeFakeSeatPrisma(legacy);

    const first = await seedCombSeats(prisma, { locationId: "city-creek-id", layoutKey: "comb-75" });
    assert.equal(first.created, 75);
    assert.equal(first.retired, 12);

    const allSeats = await prisma.seat.findMany({ where: { locationId: "city-creek-id" } });
    const legacyRows = allSeats.filter((s: any) => /^\d{2}$/.test(s.number));
    assert.equal(legacyRows.length, 12);
    for (const row of legacyRows) assert.ok(row.retiredAt, `legacy seat ${row.number} should be retired`);

    const second = await seedCombSeats(prisma, { locationId: "city-creek-id", layoutKey: "comb-75" });
    assert.equal(second.created, 0);
    assert.equal(second.retired, 0);

    const activeAfterSecond = allSeatsActive(await prisma.seat.findMany({ where: { locationId: "city-creek-id" } }));
    assert.equal(activeAfterSecond.length, 75);
  });

  test("qrCode is POD-<last 8 of locationId>-<label>", async () => {
    const prisma = makeFakeSeatPrisma();
    await seedCombSeats(prisma, { locationId: "cmip6jbz700022nnnxxpmm5hf", layoutKey: "comb-75" });
    const seats = await prisma.seat.findMany({ where: { locationId: "cmip6jbz700022nnnxxpmm5hf" } });
    const a01 = seats.find((s: any) => s.label === "A-01");
    assert.equal(a01.qrCode, "POD-xxpmm5hf-A-01");
  });

  test("two seeding runs in a row, plus a run after one partner link was manually cleared, give no unique violation and correct bidirectional links (Task A8 fix round 1)", async () => {
    const prisma = makeFakeSeatPrisma();

    await seedCombSeats(prisma, { locationId: "univ-id", layoutKey: "comb-70-mirrored" });
    // Second run: re-writing the same (locationId, number), qrCode, and
    // dualPartnerId values must not trip the unique-index check.
    await assert.doesNotReject(seedCombSeats(prisma, { locationId: "univ-id", layoutKey: "comb-70-mirrored" }));

    const beforeClear = await prisma.seat.findMany({ where: { locationId: "univ-id" } });
    const duoSeat = beforeClear.find((s: any) => s.podType === "DUAL" && s.dualPartnerId);
    assert.ok(duoSeat, "fixture should have at least one duo pod");
    const partnerId = duoSeat.dualPartnerId;

    // Simulate drift: one side of a duo pair lost its partner link (e.g. a
    // manual admin unlink that didn't clear the other side).
    await prisma.seat.update({ where: { id: duoSeat.id }, data: { dualPartnerId: null } });

    // Re-seeding must not throw a unique violation (the earlier bug this
    // guards against: re-`update`-ing both sides back to their expected
    // dualPartnerId, in sequence, must never look like a clash with a STALE
    // value elsewhere) and must restore the bidirectional link.
    await assert.doesNotReject(seedCombSeats(prisma, { locationId: "univ-id", layoutKey: "comb-70-mirrored" }));

    const afterReseed = await prisma.seat.findMany({ where: { locationId: "univ-id" } });
    const restored = afterReseed.find((s: any) => s.id === duoSeat.id);
    const partner = afterReseed.find((s: any) => s.id === partnerId);
    assert.equal(restored.dualPartnerId, partnerId, "the cleared side's link should be restored");
    assert.equal(partner.dualPartnerId, duoSeat.id, "the partner's back-link should still point home");

    // No duplicate/degenerate unique-index values snuck in anywhere.
    const qrCodes = afterReseed.map((s: any) => s.qrCode);
    assert.equal(new Set(qrCodes).size, qrCodes.length, "qrCode must stay unique per seat");
    const numbers = afterReseed.map((s: any) => s.number);
    assert.equal(new Set(numbers).size, numbers.length, "number must stay unique per location");
  });

  test("bestRank matches @oh/floor-plan's rankPodsByEntry for the same layout", async () => {
    const prisma = makeFakeSeatPrisma();
    await seedCombSeats(prisma, { locationId: "city-creek-id", layoutKey: "comb-75" });
    const seats = await prisma.seat.findMany({ where: { locationId: "city-creek-id" } });

    const layout = buildLayout(LOCATION_LAYOUTS["comb-75"]);
    const ranks = rankPodsByEntry(layout);
    const expectedByLabel = new Map(layout.pods.map((p) => [podLabel(p), ranks.get(p.number)]));

    for (const s of seats) assert.equal(s.bestRank, expectedByLabel.get(s.label), `bestRank mismatch for ${s.label}`);
    // Sanity: the computation isn't trivially constant.
    assert.ok(new Set(seats.map((s: any) => s.bestRank)).size > 1);
  });
});

function allSeatsActive(seats: any[]) {
  return seats.filter((s) => !s.retiredAt);
}
