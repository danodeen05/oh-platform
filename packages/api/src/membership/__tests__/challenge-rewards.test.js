/**
 * Task D9 fix round 2: challenge rewards are CHALLENGE credit lots through the
 * ledger, granted in the same transaction as completion, once per enrollment.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { PROGRAM } from "../program.js";
import { completeUserChallenge, claimChallengeReward } from "../challenge-rewards.js";

const NOW = new Date("2026-10-01T12:00:00-06:00");
const DAY_MS = 864e5;
const EARLY = { id: "ch1", slug: "early-bird", name: "Early Bird", rewardCents: 400, requirements: { type: "early_order", beforeHour: 11 }, isActive: true };

function db(uc = {}) {
  const userChallenge = { id: "uc1", userId: "u1", challengeId: "ch1", progress: { current: 0 }, completedAt: null, rewardClaimed: false, ...uc };
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }], challenges: [EARLY], userChallenges: [userChallenge] });
  return { prisma, userChallenge: { ...userChallenge, challenge: EARLY } };
}

test("completion grants one CHALLENGE lot that expires like all credit, and the cache follows the lot", async () => {
  const { prisma, userChallenge } = db();
  const r = await completeUserChallenge(prisma, { userChallenge, progress: { current: 1 }, now: NOW });
  assert.deepEqual(r, { completed: true, rewardCents: 400 });
  const lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
  assert.equal(lots.length, 1);
  assert.equal(lots[0].source, "CHALLENGE");
  assert.equal(lots[0].amountCents, 400);
  assert.equal(lots[0].expiresAt.getTime(), NOW.getTime() + PROGRAM.creditExpiryDays * DAY_MS);
  assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 400);
  assert.equal((await prisma.creditEvent.findMany({ where: { userId: "u1", type: "CHALLENGE_REWARD" } })).length, 1);
  const uc = await prisma.userChallenge.findUnique({ where: { id: "uc1" } });
  assert.ok(uc.completedAt);
  assert.equal(uc.rewardClaimed, true);
  assert.deepEqual(uc.progress, { current: 1 });
});

test("two concurrent completions and a later claim pay exactly once", async () => {
  const { prisma, userChallenge } = db();
  const results = await Promise.all([
    completeUserChallenge(prisma, { userChallenge, progress: { current: 1 }, now: NOW }),
    completeUserChallenge(prisma, { userChallenge, progress: { current: 1 }, now: NOW }),
  ]);
  assert.equal(results.filter((r) => r.completed).length, 1);
  assert.deepEqual(await claimChallengeReward(prisma, { userChallenge, now: NOW }), { claimed: false, rewardCents: 0 });
  assert.equal((await prisma.creditLot.findMany({ where: { userId: "u1" } })).length, 1);
  assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 400);
});

test("an older completion (completed, unclaimed) is claimed once through the ledger; not completed can't be claimed", async () => {
  const { prisma, userChallenge } = db({ completedAt: new Date(NOW.getTime() - DAY_MS) });
  const [a, b] = await Promise.all([claimChallengeReward(prisma, { userChallenge, now: NOW }), claimChallengeReward(prisma, { userChallenge, now: NOW })]);
  assert.equal([a, b].filter((r) => r.claimed).length, 1);
  assert.equal((await prisma.creditLot.findMany({ where: { userId: "u1", source: "CHALLENGE" } })).length, 1);

  const fresh = db();
  assert.deepEqual(await claimChallengeReward(fresh.prisma, { userChallenge: fresh.userChallenge, now: NOW }), { claimed: false, rewardCents: 0 });
  assert.equal((await fresh.prisma.creditLot.findMany()).length, 0);
});

test("a zero-reward challenge completes with no lot", async () => {
  const { prisma, userChallenge } = db();
  const r = await completeUserChallenge(prisma, { userChallenge: { ...userChallenge, challenge: { ...EARLY, rewardCents: 0 } }, progress: { current: 1 }, now: NOW });
  assert.deepEqual(r, { completed: true, rewardCents: 0 });
  assert.equal((await prisma.creditLot.findMany()).length, 0);
});
