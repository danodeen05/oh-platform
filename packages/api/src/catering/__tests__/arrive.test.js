import test from "node:test";
import assert from "node:assert/strict";
import { arriveOrder } from "../arrive.js";

function fake(order) {
  const updates = [];
  return {
    updates,
    order: {
      findFirst: async (q) => (order && q.where.orderSource === "CATERING" ? order : null),
      update: async (u) => { updates.push(u); },
    },
  };
}
const NOW = new Date("2026-10-04T20:00:00Z");
const SAME_DAY = new Date("2026-10-05T01:00:00Z"); // 7 pm Oct 4 in Denver
const LATER = new Date("2026-10-10T20:00:00Z");

test("non-CATERING or missing order is 404", async () => {
  const p = fake(null);
  assert.equal((await arriveOrder(p, "X", { checkDay: false })).status, 404);
  assert.equal(p.updates.length, 0);
});

test("admin arrive flips PAID to QUEUED with queuedAt, even off the event day", async () => {
  const p = fake({ id: "o1", status: "PAID", cateringEvent: { eventDate: LATER } });
  const r = await arriveOrder(p, "X", { checkDay: false, now: NOW });
  assert.deepEqual(r, { status: 200, body: { success: true, status: "QUEUED" } });
  assert.equal(p.updates.length, 1);
  assert.equal(p.updates[0].data.status, "QUEUED");
  assert.equal(p.updates[0].data.queuedAt, NOW);
});

test("already QUEUED reports the current status and does not update", async () => {
  const p = fake({ id: "o1", status: "QUEUED", cateringEvent: { eventDate: LATER } });
  const r = await arriveOrder(p, "X", { checkDay: false });
  assert.deepEqual(r, { status: 200, body: { success: true, status: "QUEUED" } });
  assert.equal(p.updates.length, 0);
});

test("public arrive is day gated", async () => {
  const early = fake({ id: "o1", status: "PAID", cateringEvent: { eventDate: LATER } });
  const r = await arriveOrder(early, "X", { now: NOW });
  assert.equal(r.status, 400);
  assert.equal(early.updates.length, 0);
  const ok = fake({ id: "o1", status: "PAID", cateringEvent: { eventDate: SAME_DAY } });
  assert.equal((await arriveOrder(ok, "X", { now: NOW })).body.status, "QUEUED");
});
