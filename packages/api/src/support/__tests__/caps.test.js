/**
 * Task A9: Chappy's goodwill is store credit only, capped at $5 per order,
 * $10 per rolling 30 days and $45 lifetime (PROGRAM.goodwill), on the
 * member's own order from the last 24 hours. The caps must hold when two
 * grants race.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { goodwillAllowance, grantGoodwill } from "../caps.js";
import { PROGRAM } from "../../membership/program.js";

const NOW = new Date("2026-10-01T12:00:00-06:00");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms) => new Date(NOW.getTime() - ms);

function lot(userId, amountCents, { orderId = null, at = ago(DAY * 100), source = "GOODWILL" } = {}) {
  return { userId, source, amountCents, remainingCents: 0, expiresAt: new Date(at.getTime() + 90 * DAY), orderId, createdAt: at };
}

function setup({ creditLots = [], supportCases = [], orders = [] } = {}) {
  return makeMemoryPrisma({
    users: [
      { id: "u1", email: "u1@x.com", creditsCents: 0 },
      { id: "u2", email: "u2@x.com", creditsCents: 0 },
    ],
    orders: [
      { id: "o1", userId: "u1", paymentStatus: "PAID", totalCents: 1924, createdAt: ago(HOUR) },
      { id: "o2", userId: "u1", paymentStatus: "PAID", totalCents: 1924, createdAt: ago(2 * HOUR) },
      { id: "o3", userId: "u2", paymentStatus: "PAID", totalCents: 1924, createdAt: ago(HOUR) },
      { id: "old", userId: "u1", paymentStatus: "PAID", totalCents: 1924, createdAt: ago(25 * HOUR) },
      { id: "oldButJustCompleted", userId: "u1", paymentStatus: "PAID", totalCents: 1924, createdAt: ago(3 * DAY), completedTime: ago(2 * HOUR) },
      ...orders,
    ],
    creditLots,
    supportCases,
  });
}

describe("goodwill caps come from PROGRAM.goodwill", () => {
  test("config is the owner's numbers", () => {
    assert.deepEqual(PROGRAM.goodwill, { perOrderCents: 500, per30DaysCents: 1000, lifetimeCents: 4500, orderAgeHours: 24 });
  });
});

describe("goodwillAllowance", () => {
  test("a fresh member on their own recent order may get the full $5, reason null", async () => {
    const prisma = setup();
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 500, reason: null });
  });

  test("per order: $5 per order in total", async () => {
    let prisma = setup({ creditLots: [lot("u1", 300, { orderId: "o1", at: ago(HOUR / 2) })] });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 200, reason: "PER_ORDER" });
    prisma = setup({ creditLots: [lot("u1", 500, { orderId: "o1", at: ago(HOUR / 2) })] });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 0, reason: "PER_ORDER" });
  });

  test("rolling 30 days: $10, and a grant 31 days ago no longer counts", async () => {
    let prisma = setup({ creditLots: [lot("u1", 500, { orderId: "x1", at: ago(10 * DAY) }), lot("u1", 500, { orderId: "x2", at: ago(20 * DAY) })] });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 0, reason: "PER_30_DAYS" });
    prisma = setup({ creditLots: [lot("u1", 500, { orderId: "x1", at: ago(10 * DAY) }), lot("u1", 300, { orderId: "x2", at: ago(20 * DAY) })] });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 200, reason: "PER_30_DAYS" });
    prisma = setup({ creditLots: [lot("u1", 500, { orderId: "x1", at: ago(10 * DAY) }), lot("u1", 500, { orderId: "x2", at: ago(31 * DAY) })] });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 500, reason: null });
  });

  test("lifetime: 10 prior grants of $4.50 leave 0, reason LIFETIME", async () => {
    const lots = Array.from({ length: 10 }, (_, i) => lot("u1", 450, { orderId: `h${i}`, at: ago((40 + i * 40) * DAY) }));
    const prisma = setup({ creditLots: lots });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 0, reason: "LIFETIME" });
  });

  test("lifetime: 9 prior grants of $4.50 leave $4.50", async () => {
    const lots = Array.from({ length: 9 }, (_, i) => lot("u1", 450, { orderId: `h${i}`, at: ago((40 + i * 40) * DAY) }));
    const prisma = setup({ creditLots: lots });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 450, reason: "LIFETIME" });
  });

  test("only GOODWILL lots count (cashback, staff credit and other members' goodwill do not)", async () => {
    const prisma = setup({
      creditLots: [
        lot("u1", 5000, { source: "ADMIN", at: ago(DAY) }),
        lot("u1", 5000, { source: "CASHBACK", orderId: "o1", at: ago(DAY) }),
        lot("u2", 4500, { orderId: "o3", at: ago(DAY) }),
      ],
    });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o1", now: NOW }), { allowedCents: 500, reason: null });
  });

  test("someone else's order, or no such order: NOT_OWNER", async () => {
    const prisma = setup();
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "o3", now: NOW }), { allowedCents: 0, reason: "NOT_OWNER" });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "nope", now: NOW }), { allowedCents: 0, reason: "NOT_OWNER" });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: null, orderId: "o1", now: NOW }), { allowedCents: 0, reason: "NOT_OWNER" });
  });

  test("fix round 1: an order that is not PAID (PENDING, REFUNDED) gets ORDER_NOT_PAID, 0 allowed, and no lot", async () => {
    const prisma = setup({
      orders: [
        { id: "pending", userId: "u1", paymentStatus: "PENDING", totalCents: 1924, createdAt: ago(HOUR) },
        { id: "refunded", userId: "u1", paymentStatus: "REFUNDED", totalCents: 1924, createdAt: ago(HOUR) },
        { id: "othersPending", userId: "u2", paymentStatus: "PENDING", totalCents: 1924, createdAt: ago(HOUR) },
      ],
    });
    for (const orderId of ["pending", "refunded"]) {
      assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId, now: NOW }), { allowedCents: 0, reason: "ORDER_NOT_PAID" });
      const r = await grantGoodwill(prisma, { userId: "u1", orderId, requestedCents: 500, caseId: null, now: NOW });
      assert.deepEqual([r.grantedCents, r.reason], [0, "ORDER_NOT_PAID"]);
    }
    assert.equal((await prisma.creditLot.findMany()).length, 0);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 0);
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "othersPending", now: NOW }), { allowedCents: 0, reason: "NOT_OWNER" }, "NOT_OWNER is checked first");
  });

  test("an order older than 24 hours: ORDER_TOO_OLD; a recent completion counts from completion", async () => {
    const prisma = setup();
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "old", now: NOW }), { allowedCents: 0, reason: "ORDER_TOO_OLD" });
    assert.deepEqual(await goodwillAllowance(prisma, { userId: "u1", orderId: "oldButJustCompleted", now: NOW }), { allowedCents: 500, reason: null });
  });
});

describe("grantGoodwill", () => {
  test("grants min(requested, allowed) as a GOODWILL CreditLot expiring in 90 days", async () => {
    const prisma = setup();
    const r = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 800, caseId: null, now: NOW });
    assert.equal(r.grantedCents, 500);
    const lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
    assert.equal(lots.length, 1);
    assert.equal(lots[0].source, "GOODWILL");
    assert.equal(lots[0].amountCents, 500);
    assert.equal(lots[0].remainingCents, 500);
    assert.equal(lots[0].orderId, "o1");
    assert.equal(lots[0].expiresAt.getTime(), NOW.getTime() + 90 * DAY);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 500);
    const events = await prisma.creditEvent.findMany({ where: { userId: "u1" } });
    assert.deepEqual(events.map((e) => [e.type, e.amountCents]), [["GOODWILL", 500]]);
  });

  test("a smaller request is granted as asked", async () => {
    const prisma = setup();
    const r = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 250, caseId: null, now: NOW });
    assert.equal(r.grantedCents, 250);
  });

  test("capped out: grants nothing and writes nothing", async () => {
    const prisma = setup({ creditLots: [lot("u1", 500, { orderId: "o1", at: ago(HOUR / 2) })] });
    const r = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 500, caseId: null, now: NOW });
    assert.equal(r.grantedCents, 0);
    assert.equal(r.reason, "PER_ORDER");
    assert.equal((await prisma.creditLot.findMany()).length, 1);
    assert.equal((await prisma.creditEvent.findMany()).length, 0);
  });

  test("rejects a non-positive or fractional request", async () => {
    const prisma = setup();
    for (const requestedCents of [0, -100, 1.5, "500", null, undefined, NaN]) {
      await assert.rejects(grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents, caseId: null, now: NOW }), RangeError, String(requestedCents));
    }
    assert.equal((await prisma.creditLot.findMany()).length, 0);
  });

  test("never touches Stripe: caps.js has no card path at all", () => {
    const src = readFileSync(new URL("../caps.js", import.meta.url), "utf8");
    assert.doesNotMatch(src, /stripe|refund/i);
  });

  test("concurrency: two simultaneous grants on different orders cannot exceed the 30-day cap", async () => {
    const prisma = setup({ creditLots: [lot("u1", 500, { orderId: "x1", at: ago(5 * DAY) })] });
    const [a, b] = await Promise.all([
      grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 500, caseId: null, now: NOW }),
      grantGoodwill(prisma, { userId: "u1", orderId: "o2", requestedCents: 500, caseId: null, now: NOW }),
    ]);
    assert.equal(a.grantedCents + b.grantedCents, 500);
    const granted = (await prisma.creditLot.findMany({ where: { userId: "u1", source: "GOODWILL" } })).reduce((s, l) => s + l.amountCents, 0);
    assert.equal(granted, 1000);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 500);
  });

  test("concurrency: five simultaneous grants on the same order total at most $5", async () => {
    const prisma = setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 300, caseId: null, now: NOW })));
    assert.equal(results.reduce((s, r) => s + r.grantedCents, 0), 500);
  });

  test("the cap check and the grant share one transaction that locks the member's row first", async () => {
    const prisma = setup();
    await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 500, caseId: null, now: NOW });
    const locks = prisma.$rawLog.filter((q) => /FOR UPDATE/i.test(q.sql));
    assert.equal(locks.length, 1);
    assert.equal(locks[0].inTransaction, true);
    assert.match(locks[0].sql, /"User"/);
    assert.deepEqual(locks[0].values, ["u1"]);
  });

  test("with a caseId: records the grant on the case, and a second call for the same case grants nothing", async () => {
    const prisma = setup({ supportCases: [{ id: "c1", userId: "u1", orderId: "o1", type: "ORDER_ISSUE", status: "OPEN", summary: "cold soup" }] });
    const first = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 300, caseId: "c1", now: NOW });
    assert.equal(first.grantedCents, 300);
    const again = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 200, caseId: "c1", now: NOW });
    assert.equal(again.grantedCents, 0);
    assert.equal(again.alreadyResolved, true);
    const c = await prisma.supportCase.findUnique({ where: { id: "c1" } });
    assert.equal(c.status, "RESOLVED");
    assert.equal(c.resolution, "GOODWILL_CREDIT");
    assert.equal(c.amountCents, 300);
    assert.equal(c.resolvedBy, "goodwill");
    assert.equal((await prisma.creditLot.findMany()).length, 1);
  });

  test("with a caseId: concurrent grants for one case grant once", async () => {
    const prisma = setup({ supportCases: [{ id: "c1", userId: "u1", orderId: "o1", type: "ORDER_ISSUE", status: "OPEN", summary: "cold soup" }] });
    const rs = await Promise.all([1, 2, 3].map(() => grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 100, caseId: "c1", now: NOW })));
    assert.equal(rs.reduce((s, r) => s + r.grantedCents, 0), 100);
  });

  test("with a caseId: someone else's case, or one for another order, is refused and nothing is written", async () => {
    const prisma = setup({
      supportCases: [
        { id: "c2", userId: "u2", orderId: "o3", type: "ORDER_ISSUE", status: "OPEN", summary: "x" },
        { id: "c3", userId: "u1", orderId: "o2", type: "ORDER_ISSUE", status: "OPEN", summary: "x" },
      ],
    });
    const other = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 300, caseId: "c2", now: NOW });
    assert.deepEqual([other.grantedCents, other.reason], [0, "CASE_MISMATCH"]);
    const wrongOrder = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 300, caseId: "c3", now: NOW });
    assert.deepEqual([wrongOrder.grantedCents, wrongOrder.reason], [0, "CASE_MISMATCH"]);
    const missing = await grantGoodwill(prisma, { userId: "u1", orderId: "o1", requestedCents: 300, caseId: "nope", now: NOW });
    assert.deepEqual([missing.grantedCents, missing.reason], [0, "CASE_MISMATCH"]);
    assert.equal((await prisma.creditLot.findMany()).length, 0);
    assert.equal((await prisma.supportCase.findUnique({ where: { id: "c2" } })).status, "OPEN");
  });
});
