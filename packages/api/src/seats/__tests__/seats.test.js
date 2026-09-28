/**
 * Task A8: comb seat endpoints, best-pod ranking, and location-write auth.
 * Task A8b: the public shape carries no customer PII (no `orders`, no name,
 * no tier, no items) - only staff (admin, or a kiosk device key scoped to
 * the requested location) get `orders`; a signed-in customer who owns a
 * seat's active order sees `isMine: true` on it and nothing else.
 *
 * The API never imports `@oh/floor-plan` (that's `packages/db/scripts/
 * seed-comb-seats.ts`'s job, run separately with `tsx`) - it only reads the
 * `Seat` fields (`label`, `finger`, `rowSide`, `position`, `bestRank`, ...)
 * that script writes. So these tests cover: the documented public and staff
 * shapes of `GET /locations/:id/seats` (and the same shape folded into
 * `/availability`), retired-seat exclusion, the restored per-seat `orders`
 * for staff (fix round 2), `resolveSeatViewer`'s non-failing staff/isMine
 * resolution (A8b), `pickBestPod`'s `bestRank` ordering (best pod = lowest
 * `bestRank`, legacy null-`bestRank` seats sort last), and that `PATCH`/
 * `DELETE /locations/:id` are already admin-gated (console-guard, OWNER) -
 * see A8 controller note 1: that guard is NOT re-added here, only asserted.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { pickBestPod } from "../../orders/service.js";
import { listLocationSeats, resolveSeatViewer } from "../service.js";
import { CONSOLE_ROUTES, registerConsoleGuard } from "../../auth/console-guard.js";
import { createAdminAuth } from "../../auth/admin.js";
import { createKioskAuth } from "../../auth/kiosk.js";
import { createCustomerAuth } from "../../auth/customer.js";

function seed({ seats = [], locations = [], orders = [], orderItems = [], menuItems = [], users = [], guests = [] } = {}) {
  return makeMemoryPrisma({
    tenants: [{ id: "t1", slug: "oh" }],
    locations: locations.length ? locations : [{ id: "L1", tenantId: "t1", name: "City Creek Mall", layoutKey: "comb-75", layoutMirror: false, podCount: 75 }],
    seats,
    orders,
    orderItems,
    menuItems,
    users,
    guests,
  });
}

describe("listLocationSeats (GET /locations/:id/seats and /availability)", () => {
  test("default (public/customer) caller: {layoutKey, layoutMirror, seats} with NO orders key, bestRank included", async () => {
    const prisma = seed({
      seats: [
        { id: "s1", locationId: "L1", number: "A-01", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE", bestRank: 1 },
      ],
    });
    const result = await listLocationSeats(prisma, "L1");
    assert.equal(result.layoutKey, "comb-75");
    assert.equal(result.layoutMirror, false);
    assert.deepEqual(result.seats, [
      { id: "s1", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE", dualPartnerId: null, bestRank: 1 },
    ]);
  });

  test("A8b: a public caller gets no orders and no PII, even for an occupied seat with a named member's active order", async () => {
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      users: [{ id: "u1", name: "Dan", membershipTier: "NOODLE_MASTER", email: "dan@x.com" }],
      orders: [
        {
          id: "o1", orderNumber: "ORD-1", seatId: "s1", userId: "u1", status: "SERVING", podCleanedAt: null,
          totalCents: 1599, createdAt: new Date("2026-09-27T12:00:00Z"), tenantId: "t1",
        },
      ],
      menuItems: [{ id: "m1", tenantId: "t1", name: "Classic Beef Noodle Soup", basePriceCents: 1599, category: "main01", categoryType: "MAIN" }],
      orderItems: [{ id: "oi1", orderId: "o1", menuItemId: "m1", quantity: 1, priceCents: 1599 }],
    });
    const result = await listLocationSeats(prisma, "L1");
    assert.equal(result.seats.length, 1);
    assert.equal("orders" in result.seats[0], false, "public shape must not carry an orders key at all");
    const json = JSON.stringify(result);
    assert.equal(json.includes("Dan"), false, "no customer name anywhere in the response");
    assert.equal(json.includes("NOODLE_MASTER"), false, "no membership tier anywhere in the response");
    assert.equal(json.includes("Classic Beef Noodle Soup"), false, "no order items anywhere in the response");
    assert.equal(/"name"/i.test(json), false, 'no "name" key anywhere in the JSON');
  });

  test("A8b: viewer.isStaff true restores the per-seat orders in the documented staff shape", async () => {
    const prisma = seed({
      seats: [
        { id: "s1", locationId: "L1", number: "A-01", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE", bestRank: 1 },
      ],
    });
    const result = await listLocationSeats(prisma, "L1", undefined, { isStaff: true });
    assert.deepEqual(result.seats, [
      { id: "s1", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE", dualPartnerId: null, bestRank: 1, orders: [] },
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

  test("fix round 2 (Important, staff): a seat with an active order returns it under seat.orders, with items+menuItem and a user select", async () => {
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      users: [{ id: "u1", name: "Dan", membershipTier: "NOODLE_MASTER", email: "dan@x.com" }],
      orders: [
        {
          id: "o1", orderNumber: "ORD-1", seatId: "s1", userId: "u1", status: "SERVING", podCleanedAt: null,
          totalCents: 1599, createdAt: new Date("2026-09-27T12:00:00Z"), tenantId: "t1",
        },
      ],
      menuItems: [{ id: "m1", tenantId: "t1", name: "Classic Beef Noodle Soup", basePriceCents: 1599, category: "main01", categoryType: "MAIN" }],
      orderItems: [{ id: "oi1", orderId: "o1", menuItemId: "m1", quantity: 1, priceCents: 1599 }],
    });
    const result = await listLocationSeats(prisma, "L1", undefined, { isStaff: true });
    assert.equal(result.seats.length, 1);
    const [seat] = result.seats;
    assert.equal(seat.orders.length, 1);
    const [order] = seat.orders;
    assert.equal(order.id, "o1");
    assert.equal(order.orderNumber, "ORD-1");
    assert.deepEqual(order.user, { id: "u1", name: "Dan", membershipTier: "NOODLE_MASTER" });
    assert.equal(order.guest, null);
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].menuItem.name, "Classic Beef Noodle Soup");
    assert.equal(order.items[0].quantity, 1);
  });

  test("fix round 2 (staff): a guest order returns seat.orders[0].guest (select), not user", async () => {
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      guests: [{ id: "g1", name: "Walk-in Guest", phone: "555-0100" }],
      orders: [{ id: "o1", orderNumber: "ORD-2", seatId: "s1", guestId: "g1", status: "QUEUED", podCleanedAt: null, totalCents: 1599, createdAt: new Date(), tenantId: "t1" }],
    });
    const result = await listLocationSeats(prisma, "L1", undefined, { isStaff: true });
    assert.deepEqual(result.seats[0].orders[0].guest, { id: "g1", name: "Walk-in Guest" });
    assert.equal(result.seats[0].orders[0].user, null);
  });

  test("fix round 2 (staff): a cleaned pod's order (podCleanedAt set) doesn't count as active", async () => {
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "AVAILABLE", podType: "SINGLE" }],
      orders: [{ id: "o1", orderNumber: "ORD-3", seatId: "s1", status: "COMPLETED", podCleanedAt: new Date(), totalCents: 1599, createdAt: new Date(), tenantId: "t1" }],
    });
    const result = await listLocationSeats(prisma, "L1", undefined, { isStaff: true });
    assert.deepEqual(result.seats[0].orders, []);
  });

  test("fix round 2 (staff): a PENDING_PAYMENT order (not in the active-status list) doesn't count as active", async () => {
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "AVAILABLE", podType: "SINGLE" }],
      orders: [{ id: "o1", orderNumber: "ORD-4", seatId: "s1", status: "PENDING_PAYMENT", podCleanedAt: null, totalCents: 1599, createdAt: new Date(), tenantId: "t1" }],
    });
    const result = await listLocationSeats(prisma, "L1", undefined, { isStaff: true });
    assert.deepEqual(result.seats[0].orders, []);
  });

  test("fix round 2 (staff): only the most recent active order per seat comes back (take 1, most recent first)", async () => {
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      orders: [
        { id: "o-old", orderNumber: "ORD-OLD", seatId: "s1", status: "SERVING", podCleanedAt: null, totalCents: 1599, createdAt: new Date("2026-09-27T10:00:00Z"), tenantId: "t1" },
        { id: "o-new", orderNumber: "ORD-NEW", seatId: "s1", status: "SERVING", podCleanedAt: null, totalCents: 1599, createdAt: new Date("2026-09-27T11:00:00Z"), tenantId: "t1" },
      ],
    });
    const result = await listLocationSeats(prisma, "L1", undefined, { isStaff: true });
    assert.equal(result.seats[0].orders.length, 1);
    assert.equal(result.seats[0].orders[0].id, "o-new");
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

describe("listLocationSeats: A8b isMine (a signed-in customer's own seat)", () => {
  function seedWithOwnedSeat() {
    return seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      users: [{ id: "u1", name: "Dan", membershipTier: "NOODLE_MASTER" }],
      orders: [{ id: "o1", orderNumber: "ORD-1", seatId: "s1", userId: "u1", status: "SERVING", podCleanedAt: null, totalCents: 1599, createdAt: new Date(), tenantId: "t1" }],
    });
  }

  test("the order's owner sees isMine:true on that seat, and nothing else added", async () => {
    const prisma = seedWithOwnedSeat();
    const result = await listLocationSeats(prisma, "L1", undefined, { userId: "u1" });
    assert.equal(result.seats[0].isMine, true);
    assert.equal("orders" in result.seats[0], false);
    const json = JSON.stringify(result);
    assert.equal(json.includes("Dan"), false);
  });

  test("a different signed-in customer does not see isMine on someone else's seat", async () => {
    const prisma = seedWithOwnedSeat();
    const result = await listLocationSeats(prisma, "L1", undefined, { userId: "u2" });
    assert.equal(result.seats[0].isMine, undefined);
  });

  test("an anonymous caller (no userId) never sees isMine", async () => {
    const prisma = seedWithOwnedSeat();
    const result = await listLocationSeats(prisma, "L1");
    assert.equal(result.seats[0].isMine, undefined);
  });

  test("isMine is never set for a staff viewer's own order (staff shape carries orders instead)", async () => {
    const prisma = seedWithOwnedSeat();
    const result = await listLocationSeats(prisma, "L1", undefined, { isStaff: true, userId: "u1" });
    assert.equal(result.seats[0].isMine, undefined);
    assert.equal(result.seats[0].orders.length, 1);
  });
});

describe("resolveSeatViewer (A8b): optional, non-failing staff/isMine resolution for the public seat routes", () => {
  const adminEnv = { NODE_ENV: "production", CLERK_SECRET_KEY: "sk_test_x", ADMIN_API_KEY: "admin-key-123" };

  function buildDeps({ devices = {}, clerkUsers = {}, dbUsers = {} } = {}) {
    const admin = createAdminAuth({
      env: adminEnv,
      verifyToken: async () => { throw new Error("bad signature"); },
      getUser: async () => { throw new Error("unused"); },
    });
    const kiosk = createKioskAuth({
      findDeviceByKey: async (key) => devices[key] ?? null,
      requireAdminAuth: admin.requireAdminAuth,
    });
    const customer = createCustomerAuth({
      env: { CLERK_SECRET_KEY: "sk_test_x" },
      verifyToken: async (token, secretKey) => {
        if (secretKey === "sk_test_x" && token.startsWith("clerk:")) return { sub: token.slice(6) };
        throw new Error("bad signature");
      },
      getUser: async (id) => {
        if (!clerkUsers[id]) throw new Error("no such user");
        return clerkUsers[id];
      },
      prisma: {
        user: {
          findFirst: async ({ where }) => {
            const email = (where.email?.equals ?? "").toLowerCase();
            return dbUsers[email] ? { id: dbUsers[email] } : null;
          },
        },
      },
    });
    const deps = { checkAdminAuth: admin.checkAdminAuth, kioskDeviceFor: kiosk.deviceFor, resolveCustomer: customer.resolve };
    return { admin, kiosk, customer, deps };
  }

  test("anonymous caller: not staff, no userId - and never a 401 (these routes stay public)", async () => {
    const { deps } = buildDeps();
    const viewer = await resolveSeatViewer({ headers: {} }, "L1", deps);
    assert.deepEqual(viewer, { isStaff: false, userId: null });
  });

  test("an invalid bearer resolves to isStaff:false rather than rejecting", async () => {
    const { deps } = buildDeps();
    const viewer = await resolveSeatViewer({ headers: { authorization: "Bearer garbage" } }, "L1", deps);
    assert.equal(viewer.isStaff, false);
  });

  test("x-admin-api-key: admin is staff", async () => {
    const { deps } = buildDeps();
    const viewer = await resolveSeatViewer({ headers: { "x-admin-api-key": "admin-key-123" } }, "L1", deps);
    assert.equal(viewer.isStaff, true);
  });

  test("a kiosk key for a DIFFERENT location gets the public shape (not staff)", async () => {
    const { deps } = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } });
    const viewer = await resolveSeatViewer({ headers: { authorization: "Bearer kiosk_abc123" } }, "L1", deps);
    assert.equal(viewer.isStaff, false);
  });

  test("a kiosk key for THIS location is staff", async () => {
    const { deps } = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L1", isActive: true } } });
    const viewer = await resolveSeatViewer({ headers: { authorization: "Bearer kiosk_abc123" } }, "L1", deps);
    assert.equal(viewer.isStaff, true);
  });

  test("an inactive kiosk device key is not staff", async () => {
    const { deps } = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L1", isActive: false } } });
    const viewer = await resolveSeatViewer({ headers: { authorization: "Bearer kiosk_abc123" } }, "L1", deps);
    assert.equal(viewer.isStaff, false);
  });

  test("a signed-in customer's verified Clerk session resolves to their database userId", async () => {
    const { deps } = buildDeps({
      clerkUsers: { user_dan: { primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "dan@x.com", verification: { status: "verified" } }] } },
      dbUsers: { "dan@x.com": "u1" },
    });
    const viewer = await resolveSeatViewer({ headers: { authorization: "Bearer clerk:user_dan" } }, "L1", deps);
    assert.deepEqual(viewer, { isStaff: false, userId: "u1" });
  });

  test("end-to-end: admin caller receives orders through listLocationSeats", async () => {
    const { deps } = buildDeps();
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      users: [{ id: "u1", name: "Dan", membershipTier: "NOODLE_MASTER" }],
      orders: [{ id: "o1", orderNumber: "ORD-1", seatId: "s1", userId: "u1", status: "SERVING", podCleanedAt: null, totalCents: 1599, createdAt: new Date(), tenantId: "t1" }],
    });
    const viewer = await resolveSeatViewer({ headers: { "x-admin-api-key": "admin-key-123" } }, "L1", deps);
    const result = await listLocationSeats(prisma, "L1", undefined, viewer);
    assert.equal(result.seats[0].orders.length, 1);
    assert.equal(result.seats[0].orders[0].user.name, "Dan");
  });

  test("end-to-end: a kiosk key for this location receives orders through listLocationSeats", async () => {
    const { deps } = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L1", isActive: true } } });
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      users: [{ id: "u1", name: "Dan", membershipTier: "NOODLE_MASTER" }],
      orders: [{ id: "o1", orderNumber: "ORD-1", seatId: "s1", userId: "u1", status: "SERVING", podCleanedAt: null, totalCents: 1599, createdAt: new Date(), tenantId: "t1" }],
    });
    const viewer = await resolveSeatViewer({ headers: { authorization: "Bearer kiosk_abc123" } }, "L1", deps);
    const result = await listLocationSeats(prisma, "L1", undefined, viewer);
    assert.equal(result.seats[0].orders.length, 1);
  });

  test("end-to-end: a kiosk key for another location, and an anonymous caller, both get the public shape (no orders, no name)", async () => {
    const { deps: deps1 } = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } });
    const { deps: deps2 } = buildDeps();
    const prisma = seed({
      seats: [{ id: "s1", locationId: "L1", number: "A-01", label: "A-01", status: "OCCUPIED", podType: "SINGLE" }],
      users: [{ id: "u1", name: "Dan", membershipTier: "NOODLE_MASTER" }],
      orders: [{ id: "o1", orderNumber: "ORD-1", seatId: "s1", userId: "u1", status: "SERVING", podCleanedAt: null, totalCents: 1599, createdAt: new Date(), tenantId: "t1" }],
    });
    for (const { deps, headers } of [
      { deps: deps1, headers: { authorization: "Bearer kiosk_abc123" } },
      { deps: deps2, headers: {} },
    ]) {
      const viewer = await resolveSeatViewer({ headers }, "L1", deps);
      const result = await listLocationSeats(prisma, "L1", undefined, viewer);
      assert.equal("orders" in result.seats[0], false);
      assert.equal(JSON.stringify(result).includes("Dan"), false);
    }
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
