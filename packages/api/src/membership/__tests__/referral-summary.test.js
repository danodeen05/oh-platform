/**
 * Task D9: the referral page's numbers come from REFERRAL CreditLots, the cap
 * count mirrors payReferralIfEligible (positive REFERRAL_ORDER events in the
 * rolling 30 days), and the cap values come from PROGRAM.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { PROGRAM } from "../program.js";
import { referralSummary } from "../referral-summary.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-01T12:00:00-06:00");
const ago = (days) => new Date(NOW.getTime() - days * DAY_MS);

function lot(id, source, amountCents, createdAt, remainingCents = amountCents) {
  return { id, userId: "u1", source, amountCents, remainingCents, createdAt, expiresAt: new Date(createdAt.getTime() + 90 * DAY_MS) };
}

test("earnings are the member's REFERRAL lots only; the cap counts paid referral events in the last 30 days", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "u1", creditsCents: 0 },
      { id: "f1", referredById: "u1" },
      { id: "f2", referredById: "u1" },
      { id: "f3", referredById: "u1" },
      { id: "x1", referredById: "someone-else" },
    ],
    creditLots: [
      lot("l1", "REFERRAL", 500, ago(40), 0),
      lot("l2", "REFERRAL", 500, ago(3)),
      lot("l3", "CASHBACK", 120, ago(2)),
      lot("l4", "WELCOME", 500, ago(50)),
      { ...lot("l5", "REFERRAL", 500, ago(1)), userId: "other" },
    ],
    creditEvents: [
      { id: "e1", userId: "u1", type: "REFERRAL_ORDER", amountCents: 500, createdAt: ago(40) },
      { id: "e2", userId: "u1", type: "REFERRAL_ORDER", amountCents: 500, createdAt: ago(3) },
      { id: "e3", userId: "u1", type: "REFERRAL_ORDER", amountCents: 0, createdAt: ago(2) }, // capped, not paid
      { id: "e4", userId: "u1", type: "CASHBACK", amountCents: 500, createdAt: ago(1) },
    ],
  });
  const s = await referralSummary(prisma, "u1", NOW);
  assert.equal(s.earnedCents, 1000);
  assert.equal(s.paidCount, 2);
  assert.equal(s.paidLast30Days, 1);
  assert.equal(s.maxPaidPer30Days, PROGRAM.referral.maxPaidPer30Days);
  assert.equal(s.remainingThis30Days, PROGRAM.referral.maxPaidPer30Days - 1);
  assert.equal(s.referrerCents, PROGRAM.referral.referrerCents);
  assert.equal(s.refereeCents, PROGRAM.referral.refereeCents);
  assert.equal(s.friendsJoined, 3);
  assert.deepEqual(s.recent.map((r) => r.id), ["l2", "l1"], "newest first, REFERRAL only");
  assert.equal(s.recent[1].remainingCents, 0);
});

test("a member with no referrals gets zeros and the full cap", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const s = await referralSummary(prisma, "u1", NOW);
  assert.equal(s.earnedCents, 0);
  assert.equal(s.paidCount, 0);
  assert.equal(s.friendsJoined, 0);
  assert.equal(s.remainingThis30Days, PROGRAM.referral.maxPaidPer30Days);
  assert.deepEqual(s.recent, []);
});

test("remaining never goes below zero at the cap", async () => {
  const events = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, userId: "u1", type: "REFERRAL_ORDER", amountCents: 500, createdAt: ago(i + 1) }));
  const prisma = makeMemoryPrisma({ users: [{ id: "u1" }], creditEvents: events });
  const s = await referralSummary(prisma, "u1", NOW);
  assert.equal(s.paidLast30Days, 12);
  assert.equal(s.remainingThis30Days, 0);
});
