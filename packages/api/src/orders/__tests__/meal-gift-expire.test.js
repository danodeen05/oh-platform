/**
 * Final review I2: the `expire-meal-gifts` job returns each lapsed, funded gift
 * exactly once (claim + MEAL_GIFT grant in one transaction), is idempotent, and
 * never returns an unfunded, accepted or not-yet-lapsed gift.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { expireMealGifts, MEAL_GIFT_RETURN_NOTE } from "../meal-gift-expire.js";

const NOW = new Date("2026-10-01T04:00:00Z");
const PAST = new Date("2026-10-01T03:00:00Z");
const FUTURE = new Date("2026-10-02T03:00:00Z");

function seed() {
  return makeMemoryPrisma({
    users: [
      { id: "giver", creditsCents: 0 },
      { id: "other", creditsCents: 0 },
    ],
    mealGifts: [
      { id: "funded", giverId: "giver", amountCents: 1599, status: "PENDING", expiresAt: PAST, paidAt: PAST, createdAt: PAST },
      { id: "unfunded", giverId: "other", amountCents: 1599, status: "PENDING", expiresAt: PAST, paidAt: null, createdAt: PAST },
      { id: "accepted", giverId: "giver", amountCents: 1599, status: "ACCEPTED", expiresAt: PAST, paidAt: PAST, createdAt: PAST },
      { id: "fresh", giverId: "giver", amountCents: 1599, status: "PENDING", expiresAt: FUTURE, paidAt: PAST, createdAt: PAST },
    ],
  });
}

test("expireMealGifts returns a lapsed funded gift once, as a MEAL_GIFT lot", async () => {
  const prisma = seed();
  const results = await expireMealGifts(prisma, NOW);

  assert.deepEqual(
    results.map((r) => [r.id, r.refunded]).sort(),
    [["funded", true], ["unfunded", false]],
  );
  const lots = await prisma.creditLot.findMany({ where: { userId: "giver", source: "MEAL_GIFT" } });
  assert.equal(lots.length, 1);
  assert.equal(lots[0].amountCents, 1599);
  assert.equal(lots[0].note, MEAL_GIFT_RETURN_NOTE);
  const events = await prisma.creditEvent.findMany({ where: { userId: "giver" } });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "REFUND_RESTORE");
  assert.equal((await prisma.user.findUnique({ where: { id: "giver" } })).creditsCents, 1599);
  assert.equal((await prisma.user.findUnique({ where: { id: "other" } })).creditsCents, 0, "an unfunded gift returns nothing");
  assert.equal((await prisma.mealGift.findUnique({ where: { id: "funded" } })).status, "EXPIRED");
  assert.equal((await prisma.mealGift.findUnique({ where: { id: "unfunded" } })).status, "EXPIRED");
  assert.equal((await prisma.mealGift.findUnique({ where: { id: "accepted" } })).status, "ACCEPTED");
  assert.equal((await prisma.mealGift.findUnique({ where: { id: "fresh" } })).status, "PENDING");
});

test("expireMealGifts is idempotent: a re-run returns nothing more", async () => {
  const prisma = seed();
  await expireMealGifts(prisma, NOW);
  const again = await expireMealGifts(prisma, NOW);
  assert.equal(again.length, 0);
  assert.equal((await prisma.creditLot.findMany({ where: { userId: "giver", source: "MEAL_GIFT" } })).length, 1);
  assert.equal((await prisma.user.findUnique({ where: { id: "giver" } })).creditsCents, 1599);
});

test("concurrent runs (cron + the owner route) return the gift exactly once", async () => {
  const prisma = seed();
  const runs = await Promise.all([expireMealGifts(prisma, NOW), expireMealGifts(prisma, NOW), expireMealGifts(prisma, NOW)]);
  const funded = runs.flat().filter((r) => r.id === "funded");
  assert.equal(funded.length, 1);
  assert.equal((await prisma.creditLot.findMany({ where: { userId: "giver", source: "MEAL_GIFT" } })).length, 1);
  assert.equal((await prisma.user.findUnique({ where: { id: "giver" } })).creditsCents, 1599);
});

test("a failed grant rolls the claim back, so the next run still returns the gift", async () => {
  const prisma = seed();
  const realTx = prisma.$transaction;
  let failOnce = true;
  prisma.$transaction = (fn) =>
    realTx(async (tx) => {
      if (failOnce) {
        const create = tx.creditLot.create;
        tx.creditLot.create = async () => {
          failOnce = false;
          throw new Error("boom");
        };
        try {
          return await fn(tx);
        } finally {
          tx.creditLot.create = create;
        }
      }
      return fn(tx);
    });
  // The unfunded gift is processed first or second; the funded one's grant throws.
  await assert.rejects(expireMealGifts(prisma, NOW), /boom/);
  prisma.$transaction = realTx;
  assert.equal((await prisma.mealGift.findUnique({ where: { id: "funded" } })).status, "PENDING", "claim rolled back");

  const retry = await expireMealGifts(prisma, NOW);
  assert.ok(retry.some((r) => r.id === "funded" && r.refunded));
  assert.equal((await prisma.user.findUnique({ where: { id: "giver" } })).creditsCents, 1599);
});
