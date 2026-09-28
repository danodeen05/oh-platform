import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAdminConsoleRoutes } from "../console-routes.js";

function prismaStub() {
  const calls = {};
  const rec = (name, value) => async (args) => { (calls[name] ||= []).push(args); return value; };
  return {
    calls,
    order: {
      count: rec("order.count", 3),
      aggregate: rec("order.aggregate", { _sum: { totalCents: 4200 } }),
      findMany: rec("order.findMany", [{
        id: "o1", orderNumber: "A100", kitchenOrderNumber: "12", status: "PREPPING", paymentStatus: "PAID",
        totalCents: 1899, createdAt: new Date("2026-09-27T18:00:00Z"), orderSource: "WEB",
        guestName: "Mei", guestPhone: "8015550142", user: null,
        location: { name: "SoHo" }, seat: { number: 7 },
      }]),
      findFirst: rec("order.findFirst", null),
    },
    podCall: { count: rec("podCall.count", 2) },
    shopOrder: { count: rec("shopOrder.count", 1) },
    cateringEvent: { count: rec("cateringEvent.count", 4) },
    planQuestion: { count: rec("planQuestion.count", 5) },
    planNdaCountersigner: { findUnique: rec("planNdaCountersigner.findUnique", null) },
  };
}

async function build(role = "owner", prisma = prismaStub()) {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", async (req) => { req.adminRole = role; });
  await registerAdminConsoleRoutes(app, {
    prisma, resolveTenant: async () => ({ id: "t1" }), now: () => new Date("2026-09-27T20:00:00Z"),
  });
  await app.ready();
  return { app, prisma };
}

test("today: owner gets money and owner rows", async () => {
  const { app } = await build("owner");
  const body = (await app.inject({ url: "/admin/today" })).json();
  assert.equal(body.ordersToday, 3);
  assert.equal(body.salesCents, 4200);
  assert.equal(body.unansweredQuestions, 5);
  assert.equal(body.countersignerMissing, true);
});

test("today: manager never receives sales or owner rows", async () => {
  const { app } = await build("manager");
  const body = (await app.inject({ url: "/admin/today" })).json();
  assert.equal(body.ordersToday, 3);
  assert.ok(!("salesCents" in body));
  assert.ok(!("unansweredQuestions" in body));
  assert.ok(!("countersignerMissing" in body));
});

test("today: counts start at Denver midnight and honour locationId", async () => {
  const { app, prisma } = await build("owner");
  await app.inject({ url: "/admin/today?locationId=L1" });
  const where = prisma.calls["order.count"][0].where;
  assert.equal(where.createdAt.gte.toISOString(), "2026-09-27T06:00:00.000Z");
  assert.equal(where.locationId, "L1");
  assert.equal(where.tenantId, "t1");
});

test("orders: search masks phone to last 4 and flattens names", async () => {
  const { app, prisma } = await build("manager");
  const body = (await app.inject({ url: "/admin/orders?q=mei" })).json();
  assert.deepEqual(body.orders[0], {
    id: "o1", orderNumber: "A100", kitchenOrderNumber: "12", status: "PREPPING", paymentStatus: "PAID",
    totalCents: 1899, createdAt: "2026-09-27T18:00:00.000Z", orderSource: "WEB",
    locationName: "SoHo", seatNumber: 7, seatLabel: 7, customerName: "Mei", phoneLast4: "0142",
  });
  const where = prisma.calls["order.findMany"][0].where;
  assert.ok(Array.isArray(where.OR), "search uses OR across fields");
});

test("orders: blank q lists today; limit is capped at 100", async () => {
  const { app, prisma } = await build("manager");
  await app.inject({ url: "/admin/orders?limit=5000" });
  const args = prisma.calls["order.findMany"][0];
  assert.equal(args.take, 100);
  assert.equal(args.where.createdAt.gte.toISOString(), "2026-09-27T06:00:00.000Z");
});

test("orders: a comb pod shows its label (B-07); the select asks for it (Task D12)", async () => {
  const prisma = prismaStub();
  prisma.order.findMany = async (args) => {
    (prisma.calls["order.findMany"] ||= []).push(args);
    return [{
      id: "o2", orderNumber: "A101", kitchenOrderNumber: null, status: "QUEUED", paymentStatus: "PAID",
      totalCents: 1500, createdAt: new Date("2026-09-27T18:00:00Z"), orderSource: "WEB",
      guestName: "Ana", guestPhone: null, user: null, location: { name: "City Creek" }, seat: { number: "31", label: "B-07" },
    }];
  };
  const { app } = await build("manager", prisma);
  const body = (await app.inject({ url: "/admin/orders" })).json();
  assert.equal(body.orders[0].seatLabel, "B-07");
  assert.deepEqual(prisma.calls["order.findMany"][0].include.seat, { select: { number: true, label: true } });
});

test("order detail: 404 when missing", async () => {
  const { app } = await build("manager");
  assert.equal((await app.inject({ url: "/admin/orders/nope" })).statusCode, 404);
});

test("menu: the console list includes sold-out items, raw names, no localisation", async () => {
  const prisma = prismaStub();
  prisma.menuItem = { findMany: async (args) => { (prisma.calls["menuItem.findMany"] ||= []).push(args); return [{ id: "m1", name: "Bok choy", isAvailable: false }]; } };
  const { app } = await build("manager", prisma);
  const body = (await app.inject({ url: "/admin/menu" })).json();
  assert.deepEqual(body, { items: [{ id: "m1", name: "Bok choy", isAvailable: false }] });
  const where = prisma.calls["menuItem.findMany"][0].where;
  assert.deepEqual(where, { tenantId: "t1" });
});
