/**
 * Task A8b, fix round 1: GET /orders/:id was public with no ownership check
 * at all, returning `user: {id, name, email, phone, smsOptIn}` for any
 * order id. These tests cover `canSeeFullOrder` (who gets the full order)
 * and `safeOrderView` (the shape everyone else gets: status, number, items
 * with menuItem names, totals, location, pod label and timestamps - no
 * user/guest contact fields).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { canSeeFullOrder, safeOrderView, firstNameOnly, arrivedLookupSummary } from "../order-view.js";
import { GUEST_SESSION_HEADER } from "../group-routes.js";
import { createAdminAuth } from "../../auth/admin.js";
import { createKioskAuth } from "../../auth/kiosk.js";
import { isDemoOrderId, buildDemoOrder } from "../../demo/status-demo.js";

const NOW = new Date("2026-09-28T12:00:00Z");
const adminEnv = { NODE_ENV: "production", CLERK_SECRET_KEY: "sk_test_x", ADMIN_API_KEY: "admin-key-123" };

function buildDeps({ devices = {}, guests = {}, customer = { kind: "anonymous" } } = {}) {
  const admin = createAdminAuth({
    env: adminEnv,
    verifyToken: async () => { throw new Error("bad signature"); },
    getUser: async () => { throw new Error("unused"); },
  });
  const kiosk = createKioskAuth({
    findDeviceByKey: async (key) => devices[key] ?? null,
    requireAdminAuth: admin.requireAdminAuth,
  });
  return {
    checkAdminAuth: admin.checkAdminAuth,
    kioskDeviceFor: kiosk.deviceFor,
    resolveCustomer: async () => customer,
    findGuestBySessionToken: async (token) => guests[token] ?? null,
  };
}

const MEMBER_ORDER = { id: "o1", userId: "u1", guestId: null, locationId: "L1" };
const GUEST_ORDER = { id: "o2", userId: null, guestId: "g1", locationId: "L1" };

describe("canSeeFullOrder (A8b fix round 1)", () => {
  test("anonymous caller cannot see a member order's full view", async () => {
    const deps = buildDeps();
    assert.equal(await canSeeFullOrder({ headers: {} }, MEMBER_ORDER, deps, () => NOW), false);
  });

  test("the verified owner sees the full order", async () => {
    const deps = buildDeps({ customer: { kind: "user", userId: "u1" } });
    assert.equal(await canSeeFullOrder({ headers: {} }, MEMBER_ORDER, deps, () => NOW), true);
  });

  test("a different signed-in customer does not see someone else's full order", async () => {
    const deps = buildDeps({ customer: { kind: "user", userId: "u2" } });
    assert.equal(await canSeeFullOrder({ headers: {} }, MEMBER_ORDER, deps, () => NOW), false);
  });

  test("admin (x-admin-api-key) sees the full order", async () => {
    const deps = buildDeps();
    const req = { headers: { "x-admin-api-key": "admin-key-123" } };
    assert.equal(await canSeeFullOrder(req, MEMBER_ORDER, deps, () => NOW), true);
  });

  test("a kiosk device for the order's own location sees the full order", async () => {
    const deps = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L1", isActive: true } } });
    const req = { headers: { authorization: "Bearer kiosk_abc123" } };
    assert.equal(await canSeeFullOrder(req, MEMBER_ORDER, deps, () => NOW), true);
  });

  test("a kiosk device for a DIFFERENT location gets the safe view (not staff for this order)", async () => {
    const deps = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } });
    const req = { headers: { authorization: "Bearer kiosk_abc123" } };
    assert.equal(await canSeeFullOrder(req, MEMBER_ORDER, deps, () => NOW), false);
  });

  test("fix round 1: admin plus a kiosk key for a different location still sees the full order", async () => {
    const deps = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } });
    const req = { headers: { "x-admin-api-key": "admin-key-123", authorization: "Bearer kiosk_abc123" } };
    assert.equal(await canSeeFullOrder(req, MEMBER_ORDER, deps, () => NOW), true);
  });

  test("a verified guest session matching order.guestId sees the full order", async () => {
    const deps = buildDeps({ guests: { "sess-1": { id: "g1", expiresAt: new Date(NOW.getTime() + 60000) } } });
    const req = { headers: { [GUEST_SESSION_HEADER]: "sess-1" } };
    assert.equal(await canSeeFullOrder(req, GUEST_ORDER, deps, () => NOW), true);
  });

  test("a guest session for a DIFFERENT guest does not see this guest order", async () => {
    const deps = buildDeps({ guests: { "sess-2": { id: "g-other", expiresAt: new Date(NOW.getTime() + 60000) } } });
    const req = { headers: { [GUEST_SESSION_HEADER]: "sess-2" } };
    assert.equal(await canSeeFullOrder(req, GUEST_ORDER, deps, () => NOW), false);
  });

  test("an expired guest session does not see the guest order", async () => {
    const deps = buildDeps({ guests: { "sess-1": { id: "g1", expiresAt: new Date(NOW.getTime() - 1000) } } });
    const req = { headers: { [GUEST_SESSION_HEADER]: "sess-1" } };
    assert.equal(await canSeeFullOrder(req, GUEST_ORDER, deps, () => NOW), false);
  });

  test("a guest session is never consulted for a member order (has a userId)", async () => {
    const deps = buildDeps({ guests: { "sess-1": { id: "whatever", expiresAt: new Date(NOW.getTime() + 60000) } } });
    const req = { headers: { [GUEST_SESSION_HEADER]: "sess-1" } };
    assert.equal(await canSeeFullOrder(req, MEMBER_ORDER, deps, () => NOW), false);
  });
});

describe("safeOrderView (A8b fix round 1)", () => {
  const fullOrder = {
    id: "o1",
    orderNumber: "ORD-1",
    kitchenOrderNumber: "A01",
    status: "SERVING",
    paymentStatus: "PAID",
    totalCents: 1599,
    taxCents: 100,
    subtotalCents: 1499,
    groupOrderId: null,
    locationId: "L1",
    location: { id: "L1", name: "City Creek Mall", city: "Salt Lake City", timezone: "America/Denver", taxRate: 0.0725 },
    seatId: "s1",
    seat: { id: "s1", label: "B-07", number: "B-07" },
    userId: "u1",
    user: { id: "u1", name: "Dan", email: "dan@x.com", phone: "555-0100", smsOptIn: true },
    guestId: null,
    guest: null,
    guestName: null,
    guestPhone: null,
    items: [
      { id: "oi1", quantity: 1, priceCents: 1599, selectedValue: "Rich", menuItem: { id: "m1", name: "Classic Beef Noodle Soup" } },
    ],
    estimatedArrival: new Date("2026-09-28T12:15:00Z"),
    createdAt: new Date("2026-09-28T12:00:00Z"),
    paidAt: new Date("2026-09-28T12:00:05Z"),
    queuedAt: new Date("2026-09-28T12:00:10Z"),
    arrivedAt: null,
    prepStartTime: null,
    readyTime: null,
    deliveredAt: null,
    completedTime: null,
  };

  test("no user, guest or contact fields anywhere in the safe view", () => {
    const safe = safeOrderView(fullOrder);
    assert.equal("user" in safe, false);
    assert.equal("guest" in safe, false);
    assert.equal("guestName" in safe, false);
    assert.equal("guestPhone" in safe, false);
    const json = JSON.stringify(safe);
    assert.equal(json.includes("Dan"), false);
    assert.equal(json.includes("dan@x.com"), false);
    assert.equal(json.includes("555-0100"), false);
  });

  test("keeps status, number, items with menuItem names, totals, location, pod label and timestamps", () => {
    const safe = safeOrderView(fullOrder);
    assert.equal(safe.status, "SERVING");
    assert.equal(safe.paymentStatus, "PAID");
    assert.equal(safe.orderNumber, "ORD-1");
    assert.equal(safe.totalCents, 1599);
    assert.equal(safe.taxCents, 100);
    assert.equal(safe.subtotalCents, 1499);
    assert.deepEqual(safe.location, { id: "L1", name: "City Creek Mall", city: "Salt Lake City", timezone: "America/Denver", taxRate: 0.0725 });
    assert.deepEqual(safe.seat, { id: "s1", label: "B-07", number: "B-07" });
    assert.equal(safe.items.length, 1);
    assert.equal(safe.items[0].menuItem.name, "Classic Beef Noodle Soup");
    assert.equal(safe.items[0].quantity, 1);
    assert.deepEqual(safe.paidAt, fullOrder.paidAt);
    assert.deepEqual(safe.createdAt, fullOrder.createdAt);
    assert.deepEqual(safe.estimatedArrival, fullOrder.estimatedArrival);
  });
});

describe("end-to-end: GET /orders/:id composition (isDemoOrderId bypass, then canSeeFullOrder -> safeOrderView)", () => {
  // Mirrors the route in index.js: a DEMO order always keeps its full demo
  // shape; otherwise canSeeFullOrder decides between the full order and safeOrderView.
  async function respondAs(order, req, deps) {
    if (isDemoOrderId(order.id)) return order;
    return (await canSeeFullOrder(req, order, deps)) ? order : safeOrderView(order);
  }

  const MENU = [{ id: "m1", categoryType: "MAIN", name: "Classic Beef Noodle Soup", basePriceCents: 1599, tenantId: "t-oh" }];
  const LOCATION = { id: "L1", name: "City Creek Mall", city: "Salt Lake City", tenantId: "t-oh" };

  test("a DEMO order keeps its full demo shape (guestName, items) for an anonymous caller", async () => {
    const demoOrder = buildDemoOrder({ code: "DEMO-PLAN", stage: "SERVING", menu: MENU, location: LOCATION, now: NOW });
    const deps = buildDeps();
    const result = await respondAs(demoOrder, { headers: {} }, deps);
    assert.equal(result.guestName, "Alex");
    assert.equal(result.user, null);
    assert.ok(result.items.length > 0);
  });

  test("an anonymous caller gets the safe view of a real member order", async () => {
    const deps = buildDeps();
    const result = await respondAs({ ...MEMBER_ORDER, user: { id: "u1", name: "Dan", email: "dan@x.com" } }, { headers: {} }, deps);
    assert.equal("user" in result, false);
  });

  test("the owner gets the full order", async () => {
    const deps = buildDeps({ customer: { kind: "user", userId: "u1" } });
    const order = { ...MEMBER_ORDER, user: { id: "u1", name: "Dan", email: "dan@x.com" } };
    const result = await respondAs(order, { headers: {} }, deps);
    assert.equal(result.user.name, "Dan");
  });

  test("staff (admin) gets the full order", async () => {
    const deps = buildDeps();
    const order = { ...MEMBER_ORDER, user: { id: "u1", name: "Dan", email: "dan@x.com" } };
    const req = { headers: { "x-admin-api-key": "admin-key-123" } };
    const result = await respondAs(order, req, deps);
    assert.equal(result.user.name, "Dan");
  });

  test("a kiosk device at another location gets the safe view", async () => {
    const deps = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } });
    const order = { ...MEMBER_ORDER, user: { id: "u1", name: "Dan", email: "dan@x.com" } };
    const req = { headers: { authorization: "Bearer kiosk_abc123" } };
    const result = await respondAs(order, req, deps);
    assert.equal("user" in result, false);
  });
});

describe("firstNameOnly (A8b fix round 1 addendum)", () => {
  test("splits on whitespace and takes the first word", () => {
    assert.equal(firstNameOnly("Dan Odeen"), "Dan");
    assert.equal(firstNameOnly("  Dan   Odeen "), "Dan");
    assert.equal(firstNameOnly("Alex"), "Alex");
  });

  test("null/empty/non-string input gives null", () => {
    assert.equal(firstNameOnly(null), null);
    assert.equal(firstNameOnly(undefined), null);
    assert.equal(firstNameOnly(""), null);
    assert.equal(firstNameOnly("   "), null);
    assert.equal(firstNameOnly(42), null);
  });
});

describe("end-to-end: GET /orders/lookup composition (fix round 1 addendum)", () => {
  // Mirrors the route in index.js.
  async function respondAsLookup(order, req, deps) {
    const canSeeFull = isDemoOrderId(order.id) || (await canSeeFullOrder(req, order, deps, () => NOW));
    if (order.arrivedAt) return arrivedLookupSummary(order, canSeeFull);
    return canSeeFull ? order : safeOrderView(order);
  }

  test("D11b: an arrived order's QR code goes only to the owner, staff or a same-location kiosk", async () => {
    const arrived = { ...baseOrder, arrivedAt: new Date(), orderQrCode: "qr-secret-1" };
    const anon = await respondAsLookup(arrived, { headers: {} }, buildDeps());
    assert.equal("orderQrCode" in anon.order, false);
    assert.equal(JSON.stringify(anon).includes("qr-secret-1"), false);
    assert.equal(anon.order.orderNumber, "ORD-1");
    assert.equal(anon.error, "Order already checked in");

    const other = await respondAsLookup(arrived, { headers: {} }, buildDeps({ customer: { kind: "user", userId: "u-other" } }));
    assert.equal("orderQrCode" in other.order, false);
    const farKiosk = await respondAsLookup(arrived, { headers: { authorization: "Bearer kiosk_abc123" } }, buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } }));
    assert.equal("orderQrCode" in farKiosk.order, false);

    const owner = await respondAsLookup(arrived, { headers: {} }, buildDeps({ customer: { kind: "user", userId: "u1" } }));
    assert.equal(owner.order.orderQrCode, "qr-secret-1");
    const staff = await respondAsLookup(arrived, { headers: { "x-admin-api-key": "admin-key-123" } }, buildDeps());
    assert.equal(staff.order.orderQrCode, "qr-secret-1");
    const kiosk = await respondAsLookup(arrived, { headers: { authorization: "Bearer kiosk_abc123" } }, buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L1", isActive: true } } }));
    assert.equal(kiosk.order.orderQrCode, "qr-secret-1");
  });

  const baseOrder = { ...MEMBER_ORDER, orderNumber: "ORD-1", guestName: null, user: { id: "u1", name: "Dan Odeen", email: "dan@x.com", membershipTier: "NOODLE_MASTER" } };

  test("anonymous gets no contact fields (not-yet-arrived order)", async () => {
    const deps = buildDeps();
    const result = await respondAsLookup(baseOrder, { headers: {} }, deps);
    assert.equal("user" in result, false);
    assert.equal(JSON.stringify(result).includes("dan@x.com"), false);
  });

  test("the owner gets the full record", async () => {
    const deps = buildDeps({ customer: { kind: "user", userId: "u1" } });
    const result = await respondAsLookup(baseOrder, { headers: {} }, deps);
    assert.equal(result.user.name, "Dan Odeen");
  });

  test("staff (admin) gets the full record", async () => {
    const deps = buildDeps();
    const req = { headers: { "x-admin-api-key": "admin-key-123" } };
    const result = await respondAsLookup(baseOrder, req, deps);
    assert.equal(result.user.name, "Dan Odeen");
  });

  test("a same-location kiosk gets the full record", async () => {
    const deps = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L1", isActive: true } } });
    const req = { headers: { authorization: "Bearer kiosk_abc123" } };
    const result = await respondAsLookup(baseOrder, req, deps);
    assert.equal(result.user.name, "Dan Odeen");
  });

  test("a kiosk at another location gets the safe view", async () => {
    const deps = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } });
    const req = { headers: { authorization: "Bearer kiosk_abc123" } };
    const result = await respondAsLookup(baseOrder, req, deps);
    assert.equal("user" in result, false);
  });

  test("the already-checked-in shape: anonymous gets a first name only, owner/staff get the full name", async () => {
    const arrivedOrder = { ...baseOrder, arrivedAt: new Date(), guestName: null };
    const anonResult = await respondAsLookup(arrivedOrder, { headers: {} }, buildDeps());
    assert.equal(anonResult.order.user.name, "Dan");
    assert.equal(anonResult.order.user.membershipTier, undefined);

    const ownerDeps = buildDeps({ customer: { kind: "user", userId: "u1" } });
    const ownerResult = await respondAsLookup(arrivedOrder, { headers: {} }, ownerDeps);
    assert.equal(ownerResult.order.user.name, "Dan Odeen");
    assert.equal(ownerResult.order.user.membershipTier, "NOODLE_MASTER");
  });

  test("a DEMO order is unchanged regardless of caller", async () => {
    const demoOrder = { id: "demo-plan", userId: null, guestId: null, locationId: "L1", guestName: "Alex", user: null };
    const result = await respondAsLookup(demoOrder, { headers: {} }, buildDeps());
    assert.equal(result.guestName, "Alex");
  });
});

describe("end-to-end: GET /orders/status composition (fix round 1 addendum)", () => {
  // Mirrors the route in index.js: guestName is full for canSeeFull, else first-name-only.
  async function statusGuestName(order, req, deps) {
    const canSeeFull = isDemoOrderId(order.id) || (await canSeeFullOrder(req, order, deps, () => NOW));
    const fullGuestName = order.guestName || order.guest?.name || null;
    return canSeeFull ? fullGuestName : firstNameOnly(fullGuestName);
  }

  const guestOrder = { id: "o3", userId: null, guestId: "g1", locationId: "L1", guestName: "Jamie Rivera", guest: null };

  test("anonymous gets a first name only", async () => {
    assert.equal(await statusGuestName(guestOrder, { headers: {} }, buildDeps()), "Jamie");
  });

  test("the verified guest owner gets the full name", async () => {
    const deps = buildDeps({ guests: { "sess-1": { id: "g1", expiresAt: new Date(NOW.getTime() + 60000) } } });
    const req = { headers: { [GUEST_SESSION_HEADER]: "sess-1" } };
    assert.equal(await statusGuestName(guestOrder, req, deps), "Jamie Rivera");
  });

  test("staff (admin) gets the full name", async () => {
    const req = { headers: { "x-admin-api-key": "admin-key-123" } };
    assert.equal(await statusGuestName(guestOrder, req, buildDeps()), "Jamie Rivera");
  });

  test("a same-location kiosk gets the full name; a different-location kiosk gets a first name only", async () => {
    const sameLocation = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L1", isActive: true } } });
    const req = { headers: { authorization: "Bearer kiosk_abc123" } };
    assert.equal(await statusGuestName(guestOrder, req, sameLocation), "Jamie Rivera");

    const otherLocation = buildDeps({ devices: { kiosk_abc123: { id: "d1", locationId: "L2", isActive: true } } });
    assert.equal(await statusGuestName(guestOrder, req, otherLocation), "Jamie");
  });

  test("a DEMO order's guestName is unchanged (single word, but the bypass is unconditional)", async () => {
    const demoOrder = { id: "demo-plan", userId: null, guestId: null, locationId: "L1", guestName: "Alex", guest: null };
    assert.equal(await statusGuestName(demoOrder, { headers: {} }, buildDeps()), "Alex");
  });
});
