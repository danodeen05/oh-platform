/**
 * Task A8: seedCombSeats. Not part of the required `pnpm --filter @oh/api
 * test` / `@oh/web test` / `@oh/floor-plan test` verification set (the API
 * never imports `@oh/floor-plan` or this TypeScript script - see the script's
 * own header comment), but run directly with `tsx --test` for TDD evidence.
 * Run with: pnpm --filter @oh/db test
 *
 * Uses a tiny local fake Prisma (just the `seat` calls the script makes),
 * not the API's `prisma-memory` helper, which lives in another workspace
 * package and is scoped to the API's own tests.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildLayout, LOCATION_LAYOUTS, podLabel, rankPodsByEntry } from "@oh/floor-plan";
import { seedCombSeats } from "../seed-comb-seats.ts";

function makeFakeSeatPrisma(initialSeats: any[] = []) {
  let seq = 0;
  const seats = new Map<string, any>(initialSeats.map((s) => [s.id, { retiredAt: null, dualPartnerId: null, ...s }]));
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
        seats.set(id, rec);
        return { ...rec };
      },
      async update({ where, data }: any) {
        const rec = seats.get(where.id);
        if (!rec) throw new Error(`fake prisma: seat not found for update: ${where.id}`);
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
