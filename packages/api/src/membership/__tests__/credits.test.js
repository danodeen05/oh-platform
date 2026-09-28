import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { PROGRAM } from "../program.js";
import {
  grantCredit,
  availableCredit,
  spendCredit,
  expireLots,
  expiringSoon,
  convertLegacyBalances,
  CreditShortError,
  lotsNeedingExpiryWarning,
  markExpiryWarned,
  sendExpiryWarnings,
} from "../credits.js";

const DAY_MS = 24 * 60 * 60 * 1000;

test("grantCredit creates an expiring lot, bumps the cached balance, and logs an event", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  const lot = await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 150, now });

  assert.equal(lot.amountCents, 150);
  assert.equal(lot.remainingCents, 150);
  assert.equal(lot.expiresAt.getTime(), now.getTime() + PROGRAM.creditExpiryDays * DAY_MS);

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 150);

  const events = await prisma.creditEvent.findMany({ where: { userId: "u1" } });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "CASHBACK");
  assert.equal(events[0].amountCents, 150);
});

test("grantCredit maps every source to the right event type", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T00:00:00-06:00");
  const cases = [
    ["CASHBACK", "CASHBACK"],
    ["GOODWILL", "GOODWILL"],
    ["WELCOME", "WELCOME"],
    ["REFERRAL", "REFERRAL_ORDER"],
    ["ADMIN", "ADMIN_ADJUSTMENT"],
    ["LEGACY", "ADMIN_ADJUSTMENT"],
    ["CHALLENGE", "CHALLENGE_REWARD"],
  ];
  for (const [source, eventType] of cases) {
    await grantCredit(prisma, { userId: "u1", source, amountCents: 10, now });
  }
  const events = await prisma.creditEvent.findMany({ where: { userId: "u1" } });
  assert.deepEqual(events.map((e) => e.type), cases.map(([, t]) => t));
});

test("spendCredit takes from the soonest-expiring lot first, across two lots", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  const soonExpiry = new Date(now.getTime() - 80 * DAY_MS); // expires in 10 days
  const laterExpiry = new Date(now.getTime() - 10 * DAY_MS); // expires in 80 days
  const soonLot = await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 200, now: soonExpiry });
  const laterLot = await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 200, now: laterExpiry });

  await spendCredit(prisma, { userId: "u1", amountCents: 250, orderId: "o1", now });

  const lots = await prisma.creditLot.findMany({ where: { userId: "u1" }, orderBy: { expiresAt: "asc" } });
  const spentFromSoon = lots.find((l) => l.id === soonLot.id);
  const spentFromLater = lots.find((l) => l.id === laterLot.id);
  assert.equal(spentFromSoon.remainingCents, 0);
  assert.equal(spentFromLater.remainingCents, 150);

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 150);

  const applied = await prisma.creditEvent.findMany({ where: { userId: "u1", type: "CREDIT_APPLIED" } });
  assert.equal(applied.length, 1);
  assert.equal(applied[0].amountCents, -250);
  assert.equal(applied[0].orderId, "o1");
});

test("overspend throws CreditShortError and changes nothing", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 100, now });

  await assert.rejects(
    () => spendCredit(prisma, { userId: "u1", amountCents: 500, orderId: "o1", now }),
    CreditShortError,
  );

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 100);
  const lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
  assert.equal(lots[0].remainingCents, 100);
  const events = await prisma.creditEvent.findMany({ where: { userId: "u1", type: "CREDIT_APPLIED" } });
  assert.equal(events.length, 0);
});

test("spend skips a lot that expired between quote and pay", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const t0 = new Date("2026-10-01T12:00:00-06:00");
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 300, now: new Date(t0.getTime() - 90 * 864e5) });
  await assert.rejects(() => spendCredit(prisma, { userId: "u1", amountCents: 300, orderId: "o1", now: new Date(t0.getTime() + 1) }), CreditShortError);
  assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 300); // untouched until expireLots runs
});

test("availableCredit sums only unexpired, unspent lots", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 100, now: new Date(now.getTime() - 91 * DAY_MS) }); // already expired
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 200, now });
  assert.equal(await availableCredit(prisma, "u1", now), 200);
});

test("expireLots zeroes expired lots, writes CREDIT_EXPIRED events, and returns the count", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }, { id: "u2", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 100, now: new Date(now.getTime() - 91 * DAY_MS) });
  await grantCredit(prisma, { userId: "u2", source: "WELCOME", amountCents: 50, now: new Date(now.getTime() - 91 * DAY_MS) });
  await grantCredit(prisma, { userId: "u2", source: "WELCOME", amountCents: 50, now }); // still valid

  const count = await expireLots(prisma, now);
  assert.equal(count, 2);

  const u1 = await prisma.user.findUnique({ where: { id: "u1" } });
  const u2 = await prisma.user.findUnique({ where: { id: "u2" } });
  assert.equal(u1.creditsCents, 0);
  assert.equal(u2.creditsCents, 50);

  const expired = await prisma.creditEvent.findMany({ where: { type: "CREDIT_EXPIRED" } });
  assert.equal(expired.length, 2);

  const lots = await prisma.creditLot.findMany({ where: {} });
  assert.ok(lots.every((l) => l.remainingCents >= 0));
  assert.equal(lots.find((l) => l.userId === "u1").remainingCents, 0);
});

test("expiringSoon returns lots within the warning window, ordered soonest first", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  // expires in exactly PROGRAM.expiryWarningDays - 1 (inside the window)
  const soon = await grantCredit(prisma, {
    userId: "u1", source: "CASHBACK", amountCents: 50,
    now: new Date(now.getTime() - (PROGRAM.creditExpiryDays - (PROGRAM.expiryWarningDays - 1)) * DAY_MS),
  });
  // expires far in the future (outside the window)
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 50, now });
  // already expired (should not show up as "soon")
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 50, now: new Date(now.getTime() - (PROGRAM.creditExpiryDays + 1) * DAY_MS) });

  const soonLots = await expiringSoon(prisma, "u1", now);
  assert.equal(soonLots.length, 1);
  assert.equal(soonLots[0].id, soon.id);
});

test("grantCredit rejects non-positive or non-integer amounts and writes nothing", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");

  for (const bad of [-100, 0, 12.5]) {
    await assert.rejects(
      () => grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: bad, now }),
      RangeError,
    );
  }

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 0);
  assert.equal((await prisma.creditLot.findMany({ where: { userId: "u1" } })).length, 0);
  assert.equal((await prisma.creditEvent.findMany({ where: { userId: "u1" } })).length, 0);
});

test("spendCredit rejects non-positive or non-integer amounts and writes nothing", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 100, now });

  for (const bad of [-100, 0, 12.5]) {
    await assert.rejects(
      () => spendCredit(prisma, { userId: "u1", amountCents: bad, orderId: "o1", now }),
      RangeError,
    );
  }

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 100);
  const lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
  assert.equal(lots[0].remainingCents, 100);
  assert.equal((await prisma.creditEvent.findMany({ where: { userId: "u1", type: "CREDIT_APPLIED" } })).length, 0);
});

test("convertLegacyBalances creates one LEGACY lot per user with a positive balance and no lots, and is idempotent", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "u1", creditsCents: 500 },
      { id: "u2", creditsCents: 0 },
      { id: "u3", creditsCents: 300 },
    ],
  });
  const now = new Date("2026-10-01T12:00:00-06:00");
  // u3 already has a lot (e.g. from a prior migration run) - should be left alone.
  await grantCredit(prisma, { userId: "u3", source: "CASHBACK", amountCents: 300, now });

  const firstCount = await convertLegacyBalances(prisma, now);
  assert.equal(firstCount, 1); // only u1

  const u1Lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
  assert.equal(u1Lots.length, 1);
  assert.equal(u1Lots[0].source, "LEGACY");
  assert.equal(u1Lots[0].remainingCents, 500);

  const u1 = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(u1.creditsCents, 500); // cached balance unchanged, lot just backs it now

  const secondCount = await convertLegacyBalances(prisma, now);
  assert.equal(secondCount, 0); // idempotent: u1 now has a lot, nothing left to convert

  const u1LotsAfter = await prisma.creditLot.findMany({ where: { userId: "u1" } });
  assert.equal(u1LotsAfter.length, 1); // no duplicate lot created
});

test("two concurrent spends that together exceed the balance: exactly one succeeds", async () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", creditsCents: 500 }],
    creditLots: [{ id: "l1", userId: "u1", source: "WELCOME", amountCents: 500, remainingCents: 500, expiresAt: new Date(now.getTime() + 86400000) }],
  });
  const results = await Promise.allSettled([
    spendCredit(prisma, { userId: "u1", amountCents: 300, orderId: "o1", now }),
    spendCredit(prisma, { userId: "u1", amountCents: 300, orderId: "o2", now }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const lost = results.find((r) => r.status === "rejected");
  assert.ok(lost.reason instanceof CreditShortError);
  assert.equal((await prisma.creditLot.findUnique({ where: { id: "l1" } })).remainingCents, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 200);
});

test("the per-lot decrement is conditional: a lot drained under us is CreditShortError, never negative", async () => {
  const { spendCreditInTx } = await import("../credits.js");
  const now = new Date("2026-10-01T12:00:00Z");
  const calls = [];
  const tx = {
    creditLot: {
      findMany: async () => [{ id: "l1", userId: "u1", remainingCents: 500, expiresAt: new Date(now.getTime() + 86400000) }],
      updateMany: async (args) => {
        calls.push(args);
        return { count: 0 }; // a concurrent spend took it first
      },
    },
    user: { update: async () => assert.fail("must not touch the balance") },
    creditEvent: { create: async () => assert.fail("must not log a spend") },
  };
  await assert.rejects(spendCreditInTx(tx, { userId: "u1", amountCents: 300, orderId: "o1", now }), CreditShortError);
  assert.deepEqual(calls[0].where, { id: "l1", remainingCents: { gte: 300 }, expiresAt: { gt: now } });
  assert.deepEqual(calls[0].data, { remainingCents: { decrement: 300 } });
  await assert.rejects(spendCreditInTx(tx, { userId: "u1", amountCents: 0, orderId: "o1", now }), RangeError);
});

test("lotsNeedingExpiryWarning finds unwarned lots inside the warning window, and markExpiryWarned is a note-based marker (no new CreditEvent, no migration)", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const now = new Date("2026-10-01T12:00:00-06:00");
  // Inside the warning window.
  const soon = await grantCredit(prisma, {
    userId: "u1", source: "CASHBACK", amountCents: 50,
    now: new Date(now.getTime() - (PROGRAM.creditExpiryDays - (PROGRAM.expiryWarningDays - 1)) * DAY_MS),
  });
  // Far in the future: not due yet.
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 50, now });

  const first = await lotsNeedingExpiryWarning(prisma, now);
  assert.deepEqual(first.map((l) => l.id), [soon.id]);

  await markExpiryWarned(prisma, soon.id);
  const lot = await prisma.creditLot.findUnique({ where: { id: soon.id } });
  assert.match(lot.note || "", /\[expiry-warned\]/);

  // Once warned, a second cron run (even with the same `now`) doesn't find it again.
  const second = await lotsNeedingExpiryWarning(prisma, now);
  assert.deepEqual(second, []);

  // No CreditEvent was written for the warning itself - just the two original
  // CASHBACK grants - so the warning never shows up in the customer's own
  // credit history (GET /users/:id/credits returns raw creditEvents).
  const events = await prisma.creditEvent.findMany({ where: { userId: "u1" } });
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.type === "CASHBACK"));
});

test("markExpiryWarned is idempotent and preserves an existing note", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", creditsCents: 100 }],
    creditLots: [{ id: "l1", userId: "u1", source: "CASHBACK", amountCents: 100, remainingCents: 100, expiresAt: new Date("2026-11-01"), note: "1% cashback on order" }],
  });
  const once = await markExpiryWarned(prisma, "l1");
  assert.match(once.note, /^1% cashback on order \[expiry-warned\]$/);
  const twice = await markExpiryWarned(prisma, "l1");
  assert.equal(twice.note, once.note); // no double-append
});

test("sendExpiryWarnings: the warning is sent once per lot across two cron runs", async () => {
  const now = new Date("2026-10-01T12:00:00-06:00");
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", creditsCents: 50, phone: "+18015551234", smsOptIn: true, locale: "en" }],
    creditLots: [
      { id: "l1", userId: "u1", source: "CASHBACK", amountCents: 50, remainingCents: 50, expiresAt: new Date(now.getTime() + 3 * DAY_MS) },
    ],
  });
  const logs = [];
  const first = await sendExpiryWarnings(prisma, { now, env: { SUPPORT_NOTIFY: "log" }, log: (l) => logs.push(l) });
  assert.equal(first.warned, 1);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /would send credit-expiry warning for lot l1/);

  const second = await sendExpiryWarnings(prisma, { now, env: { SUPPORT_NOTIFY: "log" }, log: (l) => logs.push(l) });
  assert.equal(second.warned, 0); // already marked - not considered again
  assert.equal(logs.length, 1); // no new log line
});

test("sendExpiryWarnings: SUPPORT_NOTIFY=off does nothing at all, not even marking the lot", async () => {
  const now = new Date("2026-10-01T12:00:00-06:00");
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", creditsCents: 50, phone: "+18015551234", smsOptIn: true }],
    creditLots: [
      { id: "l1", userId: "u1", source: "CASHBACK", amountCents: 50, remainingCents: 50, expiresAt: new Date(now.getTime() + 3 * DAY_MS) },
    ],
  });
  const result = await sendExpiryWarnings(prisma, { now, env: { SUPPORT_NOTIFY: "off" } });
  assert.deepEqual(result, { sent: 0, warned: 0 });
  const lot = await prisma.creditLot.findUnique({ where: { id: "l1" } });
  assert.equal(lot.note, undefined);
});
