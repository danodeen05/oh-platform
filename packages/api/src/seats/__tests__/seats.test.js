/**
 * Task A8: comb seat endpoints, best-pod ranking, and location-write auth.
 *
 * The API never imports `@oh/floor-plan` (that's `packages/db/scripts/
 * seed-comb-seats.ts`'s job, run separately with `tsx`) - it only reads the
 * `Seat` fields (`label`, `finger`, `rowSide`, `position`, `bestRank`, ...)
 * that script writes. So these tests cover: the documented public shape of
 * `GET /locations/:id/seats` (and the same shape folded into `/availability`),
 * retired-seat exclusion, `pickBestPod`'s `bestRank` ordering (best pod =
 * lowest `bestRank`, legacy null-`bestRank` seats sort last), and that
 * `PATCH`/`DELETE /locations/:id` are already admin-gated (console-guard,
 * OWNER) - see A8 controller note 1: that guard is NOT re-added here, only
 * asserted.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { pickBestPod } from "../../orders/service.js";
import { listLocationSeats } from "../service.js";
import { CONSOLE_ROUTES, registerConsoleGuard } from "../../auth/console-guard.js";

function seed({ seats = [], locations = [] } = {}) {
  return makeMemoryPrisma({
    tenants: [{ id: "t1", slug: "oh" }],
    locations: locations.length ? locations : [{ id: "L1", tenantId: "t1", name: "City Creek Mall", layoutKey: "comb-75", layoutMirror: false, podCount: 75 }],
    seats,
  });
}

describe("listLocationSeats (GET /locations/:id/seats and /availability)", () => {
  test("returns {layoutKey, layoutMirror, seats} in the documented shape", async () => {
    const prisma = seed({
      seats: [
        { id: "s1", locationId: "L1", number: "A-01", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE", bestRank: 1 },
      ],
    });
    const result = await listLocationSeats(prisma, "L1");
    assert.equal(result.layoutKey, "comb-75");
    assert.equal(result.layoutMirror, false);
    assert.deepEqual(result.seats, [
      { id: "s1", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE", dualPartnerId: null },
    ]);
  });

  test("excludes retired seats", async () => {
    const prisma = seed({
      seats: [
        { id: "s1", locationId: "L1", number: "A-01", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE" },
        { id: "s-old", locationId: "L1", number: "01", label: "01", status: "AVAILABLE", podType: "SINGLE", retiredAt: new Date("2026-09-01") },
      ],
    });
    const result = await listLocationSeats(prisma, "L1");
    assert.equal(result.seats.length, 1);
    assert.equal(result.seats[0].id, "s1");
  });

  test("includes a duo seat's dualPartnerId", async () => {
    const prisma = seed({
      seats: [
        { id: "d1", locationId: "L1", number: "A-02", label: "A-02", status: "AVAILABLE", podType: "DUAL", dualPartnerId: "d2" },
        { id: "d2", locationId: "L1", number: "A-03", label: "A-03", status: "AVAILABLE", podType: "DUAL", dualPartnerId: "d1" },
      ],
    });
    const result = await listLocationSeats(prisma, "L1");
    const byId = Object.fromEntries(result.seats.map((s) => [s.id, s]));
    assert.equal(byId.d1.dualPartnerId, "d2");
    assert.equal(byId.d2.dualPartnerId, "d1");
  });

  test("unknown location: layoutKey null, layoutMirror false, no seats", async () => {
    const prisma = seed({ seats: [], locations: [] });
    const result = await listLocationSeats(prisma, "nope");
    assert.equal(result.layoutKey, null);
    assert.equal(result.layoutMirror, false);
    assert.deepEqual(result.seats, []);
  });

  test("accepts a preloaded location (used by /availability, which already fetched it)", async () => {
    const prisma = seed({ seats: [] });
    const result = await listLocationSeats(prisma, "L1", { layoutKey: "comb-70-mirrored", layoutMirror: true });
    assert.equal(result.layoutKey, "comb-70-mirrored");
    assert.equal(result.layoutMirror, true);
  });
});

describe("PATCH/DELETE /locations/:id location-write auth (already gated - A8 controller note 1)", () => {
  test("CONSOLE_ROUTES classifies PATCH and DELETE /locations/:id as OWNER", () => {
    const patch = CONSOLE_ROUTES.find((r) => r.method === "PATCH" && r.url === "/locations/:id");
    const del = CONSOLE_ROUTES.find((r) => r.method === "DELETE" && r.url === "/locations/:id");
    assert.ok(patch, "PATCH /locations/:id must be listed in CONSOLE_ROUTES");
    assert.ok(del, "DELETE /locations/:id must be listed in CONSOLE_ROUTES");
    assert.deepEqual(patch.roles, ["owner"]);
    assert.deepEqual(del.roles, ["owner"]);
  });

  test("an anonymous PATCH/DELETE through the console-guard hook is refused with 401", async () => {
    const app = Fastify({ logger: false });
    const requireAdminAuth = async (req, reply) => {
      if (req.headers.authorization !== "Bearer ok") {
        return reply.code(401).send({ error: "Unauthorized - Admin authentication required" });
      }
    };
    registerConsoleGuard(app, { requireAdminAuth });
    app.patch("/locations/:id", async () => ({ ok: true }));
    app.delete("/locations/:id", async () => ({ ok: true }));
    await app.ready();

    const patchRes = await app.inject({ method: "PATCH", url: "/locations/L1", payload: { name: "x" } });
    assert.equal(patchRes.statusCode, 401);
    const deleteRes = await app.inject({ method: "DELETE", url: "/locations/L1" });
    assert.equal(deleteRes.statusCode, 401);

    const ok = await app.inject({ method: "PATCH", url: "/locations/L1", headers: { authorization: "Bearer ok" }, payload: {} });
    assert.equal(ok.statusCode, 200);
  });
});

describe("pickBestPod: bestRank ordering (A8 controller note 2)", () => {
  test("with all seats free, returns the bestRank-1 seat regardless of finger/position", async () => {
    const prisma = seed({
      seats: [
        { id: "s-far", locationId: "L1", number: "A-01", label: "A-01", finger: 1, position: 1, status: "AVAILABLE", podType: "SINGLE", bestRank: 40 },
        { id: "s-near", locationId: "L1", number: "C-13", label: "C-13", finger: 3, position: 13, status: "AVAILABLE", podType: "SINGLE", bestRank: 1 },
      ],
    });
    const result = await pickBestPod(prisma, { locationId: "L1", partySize: 1 });
    assert.equal(result.seat.id, "s-near");
  });

  test("legacy seats with no bestRank sort after every ranked seat", async () => {
    const prisma = seed({
      seats: [
        { id: "s-legacy", locationId: "L1", number: "05", label: "05", finger: 0, position: 1, status: "AVAILABLE", podType: "SINGLE" },
        { id: "s-ranked", locationId: "L1", number: "C-13", label: "C-13", finger: 3, position: 13, status: "AVAILABLE", podType: "SINGLE", bestRank: 74 },
      ],
    });
    const result = await pickBestPod(prisma, { locationId: "L1", partySize: 1 });
    assert.equal(result.seat.id, "s-ranked");
  });

  test("two legacy seats with no bestRank still fall back to finger/position order", async () => {
    const prisma = seed({
      seats: [
        { id: "s-legacy-2", locationId: "L1", number: "02", label: "A-02", finger: 1, position: 2, status: "AVAILABLE", podType: "SINGLE" },
        { id: "s-legacy-1", locationId: "L1", number: "01", label: "A-01", finger: 1, position: 1, status: "AVAILABLE", podType: "SINGLE" },
      ],
    });
    const result = await pickBestPod(prisma, { locationId: "L1", partySize: 1 });
    assert.equal(result.seat.id, "s-legacy-1");
  });

  test("with partySize 2, returns the lowest-bestRank duo pair", async () => {
    const prisma = seed({
      seats: [
        { id: "d1a", locationId: "L1", number: "A-02", label: "A-02", status: "AVAILABLE", podType: "DUAL", dualPartnerId: "d1b", bestRank: 30 },
        { id: "d1b", locationId: "L1", number: "A-03", label: "A-03", status: "AVAILABLE", podType: "DUAL", dualPartnerId: "d1a", bestRank: 31 },
        { id: "d2a", locationId: "L1", number: "C-08", label: "C-08", status: "AVAILABLE", podType: "DUAL", dualPartnerId: "d2b", bestRank: 5 },
        { id: "d2b", locationId: "L1", number: "C-09", label: "C-09", status: "AVAILABLE", podType: "DUAL", dualPartnerId: "d2a", bestRank: 6 },
      ],
    });
    const result = await pickBestPod(prisma, { locationId: "L1", partySize: 2 });
    assert.equal(result.seat.id, "d2a");
    assert.equal(result.partner.id, "d2b");
  });
});
