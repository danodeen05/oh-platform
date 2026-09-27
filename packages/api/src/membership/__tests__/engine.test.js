import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { PROGRAM } from "../program.js";
import {
  onOrderCompleted,
  applyReferralSignup,
  issueQuarterlyPerks,
  quarterKey,
  earlyAccessVisible,
  redeemReward,
  profileForUser,
} from "../engine.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-01T12:00:00-06:00");

test("cashback of 1% on a $17.99 order is 17 cents, floored, as a CASHBACK lot", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "CHOPSTICK", creditsCents: 0 }],
    orders: [{ id: "o1", userId: "u1", totalCents: 1799, status: "COMPLETED" }],
  });

  const result = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });

  assert.equal(result.cashbackCents, 17);
  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 17);
  const lots = await prisma.creditLot.findMany({ where: { userId: "u1", source: "CASHBACK" } });
  assert.equal(lots.length, 1);
  assert.equal(lots[0].amountCents, 17);
});

test("a second onOrderCompleted for the same order changes nothing", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "CHOPSTICK", creditsCents: 0 }],
    orders: [{ id: "o1", userId: "u1", totalCents: 1799, status: "COMPLETED" }],
  });

  await onOrderCompleted(prisma, { orderId: "o1", now: NOW });
  const second = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });

  assert.deepEqual(second, { cashbackCents: 0, upgradedTo: null, rewardIssued: null, referralPaid: false });
  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 17);
  const lots = await prisma.creditLot.findMany({ where: { userId: "u1", source: "CASHBACK" } });
  assert.equal(lots.length, 1);
});

test("10 orders + 2 referrals upgrades to NOODLE_MASTER, resets progress, and issues a FREE_BOWL reward", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      {
        id: "u1",
        membershipTier: "CHOPSTICK",
        creditsCents: 0,
        tierProgressOrders: 9,
        tierProgressReferrals: 2,
      },
    ],
    orders: [{ id: "o1", userId: "u1", totalCents: 1000, status: "COMPLETED" }],
  });

  const result = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });

  assert.equal(result.upgradedTo, "NOODLE_MASTER");
  assert.ok(result.rewardIssued);
  assert.equal(result.rewardIssued.type, "FREE_BOWL");
  assert.equal(result.rewardIssued.issuedFor, "upgrade:NOODLE_MASTER");
  assert.equal(result.rewardIssued.windowEndsAt.getTime(), NOW.getTime() + PROGRAM.upgradeRewardWindowDays * DAY_MS);

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.membershipTier, "NOODLE_MASTER");
  assert.equal(user.tierProgressOrders, 0);
  assert.equal(user.tierProgressReferrals, 0);

  const rewards = await prisma.reward.findMany({ where: { userId: "u1" } });
  assert.equal(rewards.length, 1);
});

test("upgrading to BEEF_BOSS awards the vip badge (preserves the pre-engine checkTierUpgrade behavior)", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "NOODLE_MASTER", creditsCents: 0, tierProgressOrders: 24, tierProgressReferrals: 5 }],
    orders: [{ id: "o1", userId: "u1", totalCents: 1000, status: "COMPLETED" }],
    badges: [{ id: "b1", slug: "vip", name: "VIP", description: "Beef Boss" }],
  });

  const result = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });
  assert.equal(result.upgradedTo, "BEEF_BOSS");

  const earned = await prisma.userBadge.findMany({ where: { userId: "u1" } });
  assert.equal(earned.length, 1);
  assert.equal(earned[0].badgeId, "b1");
});

test("the referral pays $5 to the referrer on the friend's first completed order only", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "referrer", membershipTier: "CHOPSTICK", creditsCents: 0, tierProgressReferrals: 0 },
      { id: "referee", membershipTier: "CHOPSTICK", creditsCents: 0, referredById: "referrer" },
    ],
    orders: [
      { id: "o1", userId: "referee", totalCents: 2500, status: "COMPLETED" },
      { id: "o2", userId: "referee", totalCents: 2500, status: "QUEUED" },
    ],
  });

  const first = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });
  assert.equal(first.referralPaid, true);

  const referrerAfterFirst = await prisma.user.findUnique({ where: { id: "referrer" } });
  assert.equal(referrerAfterFirst.creditsCents, PROGRAM.referral.referrerCents);
  assert.equal(referrerAfterFirst.tierProgressReferrals, 1);

  // The friend's second order later reaches COMPLETED too.
  await prisma.order.update({ where: { id: "o2" }, data: { status: "COMPLETED" } });
  const second = await onOrderCompleted(prisma, { orderId: "o2", now: NOW });
  assert.equal(second.referralPaid, false);

  const referrerAfterSecond = await prisma.user.findUnique({ where: { id: "referrer" } });
  assert.equal(referrerAfterSecond.creditsCents, PROGRAM.referral.referrerCents, "no second payout");
  assert.equal(referrerAfterSecond.tierProgressReferrals, 1);
});

test("an 11th paid referral in 30 days pays nothing and writes a note event", async () => {
  const priorEvents = Array.from({ length: 10 }, (_, i) => ({
    userId: "referrer",
    type: "REFERRAL_ORDER",
    amountCents: 500,
    createdAt: new Date(NOW.getTime() - (i + 1) * DAY_MS),
  }));

  const prisma = makeMemoryPrisma({
    users: [
      { id: "referrer", membershipTier: "CHOPSTICK", creditsCents: 5000 },
      { id: "referee", membershipTier: "CHOPSTICK", creditsCents: 0, referredById: "referrer" },
    ],
    orders: [{ id: "o1", userId: "referee", totalCents: 2500, status: "COMPLETED" }],
    creditEvents: priorEvents,
  });

  const result = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });
  assert.equal(result.referralPaid, false);

  const referrer = await prisma.user.findUnique({ where: { id: "referrer" } });
  assert.equal(referrer.creditsCents, 5000, "no new credit granted past the cap");

  const notes = await prisma.creditEvent.findMany({ where: { userId: "referrer", type: "REFERRAL_ORDER", amountCents: 0 } });
  assert.equal(notes.length, 1);
  assert.match(notes[0].description, /cap/i);
});

test('quarterKey(2026-12-31T23:30:00-07:00) is "2026-Q4" (2027-Q1 in UTC)', () => {
  const date = new Date("2026-12-31T23:30:00-07:00");
  assert.equal(date.getUTCFullYear(), 2027, "sanity: this instant is already 2027 in UTC");
  assert.equal(quarterKey(date), "2026-Q4");
});

test("issueQuarterlyPerks is idempotent per quarter", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "u1", membershipTier: "BEEF_BOSS" },
      { id: "u2", membershipTier: "BEEF_BOSS" },
      { id: "u3", membershipTier: "CHOPSTICK" },
    ],
  });

  const first = await issueQuarterlyPerks(prisma, NOW);
  assert.equal(first, 2);

  const rewardsAfterFirst = await prisma.reward.findMany({ where: {} });
  assert.equal(rewardsAfterFirst.length, 2);
  assert.ok(rewardsAfterFirst.every((r) => r.type === "PREMIUM_ADDON" && r.issuedFor === "2026-Q4"));

  const second = await issueQuarterlyPerks(prisma, NOW);
  assert.equal(second, 0, "already issued for this quarter");

  const rewardsAfterSecond = await prisma.reward.findMany({ where: {} });
  assert.equal(rewardsAfterSecond.length, 2);
});

test("earlyAccessVisible: releaseAt = now + 5 days", () => {
  const now = new Date("2026-10-01T00:00:00-06:00");
  const menuItem = { releaseAt: new Date(now.getTime() + 5 * DAY_MS) };

  assert.equal(earlyAccessVisible(menuItem, "BEEF_BOSS", now), true);
  assert.equal(earlyAccessVisible(menuItem, "NOODLE_MASTER", now), false);
  assert.equal(earlyAccessVisible(menuItem, "CHOPSTICK", now), false);
  assert.equal(earlyAccessVisible(menuItem, null, now), false);
});

test("earlyAccessVisible: no releaseAt, or releaseAt already past, is visible to everyone", () => {
  const now = new Date("2026-10-01T00:00:00-06:00");
  assert.equal(earlyAccessVisible({ releaseAt: null }, null, now), true);
  assert.equal(earlyAccessVisible({ releaseAt: new Date(now.getTime() - DAY_MS) }, null, now), true);
});

test("applyReferralSignup grants a WELCOME lot to the referee and sets referredById, once", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "referrer", referralCode: "FRIEND1", creditsCents: 0 },
      { id: "referee", creditsCents: 0, referredById: null },
    ],
  });

  const result = await applyReferralSignup(prisma, { userId: "referee", referralCode: "FRIEND1", now: NOW });
  assert.equal(result.applied, true);

  const referee = await prisma.user.findUnique({ where: { id: "referee" } });
  assert.equal(referee.referredById, "referrer");
  assert.equal(referee.creditsCents, PROGRAM.referral.refereeCents);

  const lots = await prisma.creditLot.findMany({ where: { userId: "referee", source: "WELCOME" } });
  assert.equal(lots.length, 1);

  // Applying again (e.g. a retried signup) must not double-grant.
  const again = await applyReferralSignup(prisma, { userId: "referee", referralCode: "FRIEND1", now: NOW });
  assert.equal(again.applied, false);
  const refereeAfter = await prisma.user.findUnique({ where: { id: "referee" } });
  assert.equal(refereeAfter.creditsCents, PROGRAM.referral.refereeCents);
});

test("redeemReward marks redeemed, and rejects an already-redeemed or expired reward", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1" }],
    rewards: [
      { id: "r1", userId: "u1", type: "FREE_BOWL", issuedFor: "upgrade:NOODLE_MASTER", windowEndsAt: new Date(NOW.getTime() + DAY_MS) },
      { id: "r2", userId: "u1", type: "FREE_BOWL", issuedFor: "upgrade:BEEF_BOSS", windowEndsAt: new Date(NOW.getTime() - DAY_MS) },
    ],
  });

  const redeemed = await redeemReward(prisma, { userId: "u1", rewardId: "r1", orderId: "o1", now: NOW });
  assert.equal(redeemed.redeemedOrderId, "o1");

  await assert.rejects(() => redeemReward(prisma, { userId: "u1", rewardId: "r1", orderId: "o2", now: NOW }), /already redeemed/);
  await assert.rejects(() => redeemReward(prisma, { userId: "u1", rewardId: "r2", orderId: "o3", now: NOW }), /expired/);
  await assert.rejects(() => redeemReward(prisma, { userId: "u1", rewardId: "does-not-exist", orderId: "o4", now: NOW }), /not found/);
});

test("profileForUser returns tier, progress, credits, expiring, rewards, badges and flags", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      {
        id: "u1",
        membershipTier: "CHOPSTICK",
        creditsCents: 0,
        tierProgressOrders: 3,
        tierProgressReferrals: 1,
        welcomeSeenAt: null,
        lastTierCelebrated: null,
      },
    ],
  });
  await prisma.creditLot.create({ data: { userId: "u1", source: "CASHBACK", amountCents: 200, remainingCents: 200, expiresAt: new Date(NOW.getTime() + DAY_MS) } });

  const profile = await profileForUser(prisma, "u1", NOW);

  assert.equal(profile.tier, "CHOPSTICK");
  assert.equal(profile.cashbackPct, 1);
  assert.equal(profile.progress.orders.have, 3);
  assert.equal(profile.progress.referrals.have, 1);
  assert.equal(profile.credits, 200);
  assert.deepEqual(profile.expiring.map((l) => l.id), (await prisma.creditLot.findMany({ where: { userId: "u1" } })).map((l) => l.id));
  assert.deepEqual(profile.rewards, []);
  assert.deepEqual(profile.badges, []);
  assert.deepEqual(profile.flags, { welcomeSeenAt: null, lastTierCelebrated: null });
});
