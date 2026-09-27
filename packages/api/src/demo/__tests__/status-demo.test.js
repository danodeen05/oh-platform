/** Order-status demo: a synthetic DEMO- order that the real routes (and AI) can read, with every write simulated. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  parseDemoCode, isDemoCode, isDemoOrderId, demoStageAt, buildDemoOrder, createDemoSource, resolveDemoLookup, registerStatusDemoGuard, DEMO_STAGES,
} from "../status-demo.js";

const MENU = [
  ["m1", "MAIN", "Classic Beef Noodle Soup", 1599],
  ["m2", "SLIDER", "Soup Richness", 0],
  ["m3", "SLIDER", "Noodle Texture", 0],
  ["m4", "SLIDER", "Spice Level", 0],
  ["m5", "SIDE", "Wide Noodles", 0],
  ["m6", "ADDON", "Soft-Boild Egg", 199],
  ["m7", "SIDE", "Spicy Cucumbers", 299],
  ["m8", "DRINK", "Pepsi", 249],
  ["m9", "DESSERT", "Mandarin Orange Sherbet", 0],
  ["m10", "ADDON", "Extra Noodles", 299],
].map(([id, categoryType, name, basePriceCents]) => ({ id, categoryType, name, basePriceCents, tenantId: "t-oh" }));
const LOCATION = { id: "loc1", name: "City Creek Mall", city: "Salt Lake City", tenantId: "t-oh" };

function fakeBase() {
  let calls = 0;
  return {
    get calls() { return calls; },
    tenant: { findUnique: async () => ({ id: "t-oh", slug: "oh" }) },
    menuItem: {
      findMany: async ({ where }) => {
        calls += 1;
        return where?.id?.in ? MENU.filter((m) => where.id.in.includes(m.id)) : MENU;
      },
    },
    location: { findFirst: async () => LOCATION },
  };
}

describe("codes and stages", () => {
  test("only DEMO- codes and demo- ids are demo", () => {
    assert.deepEqual(parseDemoCode("DEMO-PLAN"), { base: "DEMO-PLAN", stage: null });
    assert.deepEqual(parseDemoCode("DEMO-PLAN.PREPPING"), { base: "DEMO-PLAN", stage: "PREPPING" });
    assert.deepEqual(parseDemoCode("DEMO-PLAN.BOGUS"), { base: "DEMO-PLAN", stage: null });
    assert.equal(parseDemoCode("ORDER-abc-123"), null);
    assert.equal(parseDemoCode(undefined), null);
    assert.equal(isDemoCode("DEMO-X"), true);
    assert.equal(isDemoCode("ORDER-DEMO-1"), false);
    assert.equal(isDemoOrderId("demo-plan"), true);
    assert.equal(isDemoOrderId("cmabc"), false);
  });
  test("the stage clock loops through the live stages", () => {
    const seen = new Set();
    for (let s = 0; s < 120; s += 1) seen.add(demoStageAt(s * 1000));
    assert.deepEqual([...seen], ["PAID", "QUEUED", "PREPPING", "READY", "SERVING"]);
    assert.equal(demoStageAt(0), demoStageAt(120_000));
    assert.ok(DEMO_STAGES.includes("COMPLETED"));
  });
});

describe("buildDemoOrder", () => {
  const now = new Date("2026-09-27T18:00:00Z");
  test("builds a prisma-shaped order from real menu rows", () => {
    const o = buildDemoOrder({ code: "DEMO-PLAN", stage: "PREPPING", menu: MENU, location: LOCATION, now });
    assert.equal(o.id, "demo-plan");
    assert.equal(o.orderQrCode, "DEMO-PLAN.PREPPING");
    assert.equal(o.status, "PREPPING");
    assert.equal(o.tenantId, "t-oh");
    assert.equal(o.seat.number, "32");
    assert.equal(o.guestName, "Alex");
    assert.ok(o.seatId);
    assert.ok(o.podConfirmedAt && o.prepStartTime && !o.readyTime && !o.deliveredAt);
    assert.equal(o.location.name, "City Creek Mall");
    const names = o.items.map((i) => i.menuItem.name);
    assert.ok(names.includes("Classic Beef Noodle Soup") && names.includes("Mandarin Orange Sherbet") && names.includes("Pepsi"));
    assert.equal(o.items.find((i) => i.menuItem.name === "Spice Level").selectedValue, "Medium");
    assert.equal(o.totalCents, o.items.reduce((s, i) => s + i.priceCents * i.quantity, 0));
    assert.equal(o.totalCents, 1599 + 199 + 299 + 249);
  });
  test("PAID has no pod check-in yet; SERVING has every timestamp but completion", () => {
    const paid = buildDemoOrder({ code: "DEMO-PLAN", stage: "PAID", menu: MENU, location: LOCATION, now });
    assert.equal(paid.podConfirmedAt, null);
    assert.equal(paid.arrivedAt, null);
    const serving = buildDemoOrder({ code: "DEMO-PLAN", stage: "SERVING", menu: MENU, location: LOCATION, now });
    assert.ok(serving.paidAt < serving.arrivedAt && serving.arrivedAt < serving.prepStartTime && serving.prepStartTime < serving.readyTime && serving.readyTime < serving.deliveredAt);
    assert.equal(serving.completedTime, null);
  });
  test("tolerates a menu missing items", () => {
    const o = buildDemoOrder({ code: "DEMO-PLAN", stage: "QUEUED", menu: MENU.slice(0, 1), location: LOCATION, now });
    assert.equal(o.items.length, 1);
    assert.equal(o.totalCents, 1599);
  });
});

describe("resolveDemoLookup", () => {
  test("answers demo lookups by code or id and ignores real ones", async () => {
    const base = fakeBase();
    const source = createDemoSource(base, { now: () => new Date("2026-09-27T18:00:30Z") });
    const byCode = await resolveDemoLookup({ where: { orderQrCode: "DEMO-PLAN.READY" } }, source);
    assert.equal(byCode.status, "READY");
    const byId = await resolveDemoLookup({ where: { id: "demo-plan" } }, source);
    assert.equal(byId.id, "demo-plan");
    assert.equal(await resolveDemoLookup({ where: { orderQrCode: "ORDER-1" } }, source), undefined);
    assert.equal(await resolveDemoLookup({ where: { id: "cmreal" } }, source), undefined);
    assert.equal(await resolveDemoLookup({ where: { status: "PAID" } }, source), undefined);
    assert.equal(await resolveDemoLookup({ where: { id: "demo-plan", userId: "u1" } }, source), undefined, "only exact code or id lookups");
    assert.equal(await resolveDemoLookup({ where: { orderQrCode: "DEMO-PLAN", status: "PAID" } }, source), undefined);
    await resolveDemoLookup({ where: { id: "demo-plan" } }, source);
    assert.equal(base.calls, 1, "menu is cached");
  });
});

describe("tenant guard", () => {
  test("no tenant means an empty demo, never another tenant's menu, and no cache", async () => {
    let menuCalls = 0;
    const base = { tenant: { findUnique: async () => null }, menuItem: { findMany: async () => { menuCalls += 1; return []; } }, location: { findFirst: async () => null } };
    const source = createDemoSource(base);
    const v = await source.load();
    assert.deepEqual(v.menu, []);
    assert.equal(menuCalls, 0);
    const o = await resolveDemoLookup({ where: { orderQrCode: "DEMO-PLAN" } }, source);
    assert.equal(o.items.length, 0);
    assert.equal(o.location.name, "City Creek Mall");
  });
});

describe("write guard", () => {
  async function app() {
    const base = fakeBase();
    const a = Fastify({ logger: false });
    registerStatusDemoGuard(a, { source: createDemoSource(base) });
    const hit = [];
    for (const [m, u] of [["POST", "/orders/:id/call-staff"], ["POST", "/orders/:id/refill"], ["POST", "/orders/:id/extra-vegetables"], ["POST", "/orders/:id/dessert-ready"], ["POST", "/orders/:id/addons"], ["PATCH", "/orders/:id"], ["PATCH", "/kitchen/orders/:id/status"], ["POST", "/orders/link-to-account"], ["POST", "/orders/:id/assign-pod"], ["POST", "/orders/check-in"], ["GET", "/orders/:id"]]) {
      a.route({ method: m, url: u, handler: async () => { hit.push(u); return { real: true }; } });
    }
    await a.ready();
    return { a, hit };
  }
  test("demo writes are simulated and never reach the real handler", async () => {
    const { a, hit } = await app();
    const post = (url, payload = {}, method = "POST") => a.inject({ method, url, payload });
    for (const url of ["/orders/demo-plan/call-staff", "/orders/demo-plan/refill", "/orders/demo-plan/extra-vegetables", "/orders/demo-plan/dessert-ready"]) {
      const r = await post(url);
      assert.equal(r.statusCode, 200, url);
      assert.equal(r.json().demo, true);
    }
    const add = await post("/orders/demo-plan/addons", { items: [{ menuItemId: "m10", quantity: 2 }, { menuItemId: "m7", quantity: 1 }] });
    assert.equal(add.json().totalCents, 299 * 2 + 299);
    assert.match(add.json().order.id, /^demo-addon-/);
    assert.equal((await post(`/orders/${add.json().order.id}`, { paymentStatus: "PAID" }, "PATCH")).json().demo, true);
    assert.equal((await post("/kitchen/orders/demo-plan/status", { status: "COMPLETED" }, "PATCH")).json().demo, true);
    assert.equal((await post("/orders/link-to-account", { orderQrCode: "DEMO-PLAN.SERVING" })).json().demo, true);
    assert.deepEqual(hit, []);
  });
  test("percent-encoded demo ids are still caught (decoded params)", async () => {
    const { a, hit } = await app();
    const r = await a.inject({ method: "POST", url: "/orders/demo%2Dplan/call-staff", payload: {} });
    assert.equal(r.json().demo, true);
    const r2 = await a.inject({ method: "PATCH", url: "/orders/demo-pl%61n", payload: {} });
    assert.equal(r2.json().demo, true);
    assert.deepEqual(hit, []);
  });
  test("any other write that names a demo order is refused, reads pass", async () => {
    const { a, hit } = await app();
    assert.equal((await a.inject({ method: "POST", url: "/orders/demo-plan/assign-pod", payload: {} })).statusCode, 409);
    assert.equal((await a.inject({ method: "POST", url: "/orders/check-in", payload: { orderQrCode: "DEMO-PLAN.PAID" } })).statusCode, 409);
    assert.equal((await a.inject({ method: "GET", url: "/orders/demo-plan" })).statusCode, 200);
    assert.deepEqual(hit, ["/orders/:id"]);
  });
  test("real orders pass straight through", async () => {
    const { a, hit } = await app();
    await a.inject({ method: "POST", url: "/orders/cmreal/call-staff", payload: {} });
    await a.inject({ method: "POST", url: "/orders/link-to-account", payload: { orderQrCode: "ORDER-1" } });
    await a.inject({ method: "PATCH", url: "/kitchen/orders/cmreal/status", payload: { status: "PREPPING" } });
    await a.inject({ method: "POST", url: "/orders/check-in", payload: { orderQrCode: "ORDER-1" } });
    assert.equal(hit.length, 4);
  });
});
