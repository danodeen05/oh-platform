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
  visibleMenuItems,
  firstUnreleasedItem,
  redeemReward,
  profileForUser,
} from "../engine.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-01T12:00:00-06:00");

test("cashback of 1% on a $17.99 order is 17 cents, floored, as a CASHBACK lot", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "CHOPSTICK", creditsCents: 0 }],
    orders: [{ id: "o1", userId: "u1", totalCents: 1799, status: "COMPLETED", paymentStatus: "PAID" }],
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
    orders: [{ id: "o1", userId: "u1", totalCents: 1799, status: "COMPLETED", paymentStatus: "PAID" }],
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
    orders: [{ id: "o1", userId: "u1", totalCents: 1000, status: "COMPLETED", paymentStatus: "PAID" }],
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
    orders: [{ id: "o1", userId: "u1", totalCents: 1000, status: "COMPLETED", paymentStatus: "PAID" }],
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
      { id: "o1", userId: "referee", totalCents: 2500, status: "COMPLETED", paymentStatus: "PAID" },
      { id: "o2", userId: "referee", totalCents: 2500, status: "QUEUED", paymentStatus: "PAID" },
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
    orders: [{ id: "o1", userId: "referee", totalCents: 2500, status: "COMPLETED", paymentStatus: "PAID" }],
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

test("the cap only counts real payments: a referrer with stale cap notes and aged-out old payments can be paid 10 more times", async () => {
  // 10 REAL payments from well outside the 30-day window (aged out already).
  const oldRealPayments = Array.from({ length: 10 }, (_, i) => ({
    userId: "referrer",
    type: "REFERRAL_ORDER",
    amountCents: 500,
    createdAt: new Date(NOW.getTime() - (35 + i) * DAY_MS),
  }));
  // 5 zero-amount "cap reached" notes from inside the window. Pre-fix, these
  // counted toward paidInWindow and would have blocked 5 of the 10 new payouts.
  const staleCapNotes = Array.from({ length: 5 }, (_, i) => ({
    userId: "referrer",
    type: "REFERRAL_ORDER",
    amountCents: 0,
    createdAt: new Date(NOW.getTime() - (i + 1) * DAY_MS),
  }));

  const referees = Array.from({ length: 10 }, (_, i) => ({
    id: `referee${i}`,
    membershipTier: "CHOPSTICK",
    creditsCents: 0,
    referredById: "referrer",
  }));
  const orders = referees.map((r, i) => ({
    id: `o${i}`,
    userId: r.id,
    totalCents: 2500,
    status: "COMPLETED",
    paymentStatus: "PAID",
  }));

  const prisma = makeMemoryPrisma({
    users: [{ id: "referrer", membershipTier: "CHOPSTICK", creditsCents: 0 }, ...referees],
    orders,
    creditEvents: [...oldRealPayments, ...staleCapNotes],
  });

  let paidCount = 0;
  for (const order of orders) {
    const result = await onOrderCompleted(prisma, { orderId: order.id, now: NOW });
    if (result.referralPaid) paidCount++;
  }

  assert.equal(paidCount, 10, "all 10 should be paid: only real payments within 30 days count toward the cap");

  const referrer = await prisma.user.findUnique({ where: { id: "referrer" } });
  assert.equal(referrer.creditsCents, 10 * PROGRAM.referral.referrerCents);
});

test("an unpaid order reaching COMPLETED pays nothing", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "CHOPSTICK", creditsCents: 0 }],
    orders: [{ id: "o1", userId: "u1", totalCents: 1799, status: "COMPLETED", paymentStatus: "PENDING" }],
  });

  const result = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });
  assert.deepEqual(result, { cashbackCents: 0, upgradedTo: null, rewardIssued: null, referralPaid: false });

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 0);
  const order = await prisma.order.findUnique({ where: { id: "o1" } });
  assert.ok(!order.membershipProcessedAt, "an unpaid order is never claimed either");
});

test("two concurrent onOrderCompleted calls for the same order give exactly one cashback lot, one tier increment and one referral payment", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "referrer", membershipTier: "CHOPSTICK", creditsCents: 0 },
      { id: "referee", membershipTier: "CHOPSTICK", creditsCents: 0, referredById: "referrer" },
    ],
    orders: [{ id: "o1", userId: "referee", totalCents: 1799, status: "COMPLETED", paymentStatus: "PAID" }],
  });

  const [a, b] = await Promise.all([
    onOrderCompleted(prisma, { orderId: "o1", now: NOW }),
    onOrderCompleted(prisma, { orderId: "o1", now: NOW }),
  ]);

  assert.equal([a, b].filter((r) => r.cashbackCents > 0).length, 1, "exactly one call won the claim and paid cashback");
  assert.equal([a, b].filter((r) => r.referralPaid).length, 1, "exactly one referral payment");

  const referee = await prisma.user.findUnique({ where: { id: "referee" } });
  assert.equal(referee.tierProgressOrders, 1, "tier progress incremented exactly once");
  const cashbackLots = await prisma.creditLot.findMany({ where: { userId: "referee", source: "CASHBACK" } });
  assert.equal(cashbackLots.length, 1);

  const referrer = await prisma.user.findUnique({ where: { id: "referrer" } });
  assert.equal(referrer.creditsCents, PROGRAM.referral.referrerCents);
  const referralLots = await prisma.creditLot.findMany({ where: { userId: "referrer", source: "REFERRAL" } });
  assert.equal(referralLots.length, 1);
});

test("a failure injected after the claim leaves membershipProcessedAt null (the whole transaction rolls back)", async () => {
  const base = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "CHOPSTICK", creditsCents: 0 }],
    orders: [{ id: "o1", userId: "u1", totalCents: 1799, status: "COMPLETED", paymentStatus: "PAID" }],
  });

  // Wrap the base client so that once the transaction reaches the user lookup
  // (right after the claim has already landed), it throws.
  const flaky = {
    ...base,
    $transaction: (fn) =>
      base.$transaction((tx) => {
        const wrappedTx = {
          ...tx,
          user: {
            ...tx.user,
            findUnique: async () => {
              throw new Error("simulated failure after claim");
            },
          },
        };
        return fn(wrappedTx);
      }),
  };

  await assert.rejects(() => onOrderCompleted(flaky, { orderId: "o1", now: NOW }), /simulated failure/);

  const order = await base.order.findUnique({ where: { id: "o1" } });
  assert.ok(!order.membershipProcessedAt, "the claim rolled back along with the rest of the transaction");
  const user = await base.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.creditsCents, 0, "no partial cashback was left behind");
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

test("issueQuarterlyPerks tolerates a P2002 conflict (reward already created by someone else) without throwing or stopping the batch", async () => {
  const base = makeMemoryPrisma({
    users: [
      { id: "u1", membershipTier: "BEEF_BOSS" },
      { id: "u2", membershipTier: "BEEF_BOSS" },
    ],
  });
  // u1's reward already exists (as if issued by a concurrent process). Force
  // findFirst to miss it so issueQuarterlyPerks falls through to create() and
  // hits the real (userId, type, issuedFor) unique constraint.
  await base.reward.create({ data: { userId: "u1", type: "PREMIUM_ADDON", issuedFor: "2026-Q4", windowEndsAt: new Date(NOW.getTime() + 1000) } });
  const raceProne = { ...base, reward: { ...base.reward, findFirst: async () => null } };

  const issued = await issueQuarterlyPerks(raceProne, NOW);
  assert.equal(issued, 1, "u1's conflict isn't counted as newly issued, but u2 still gets one");

  const u1Rewards = await base.reward.findMany({ where: { userId: "u1" } });
  assert.equal(u1Rewards.length, 1, "no duplicate reward for u1");
  const u2Rewards = await base.reward.findMany({ where: { userId: "u2" } });
  assert.equal(u2Rewards.length, 1);
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

test("visibleMenuItems and firstUnreleasedItem: GET /menu and POST /orders share the same filter decision", () => {
  const now = new Date("2026-10-01T00:00:00-06:00");
  const released = { id: "bowl-classic", releaseAt: null };
  const beefBossOnly = { id: "bowl-limited", releaseAt: new Date(now.getTime() + 5 * DAY_MS) }; // 5 days out: only BEEF_BOSS's 8-day window reaches it
  const notYetForAnyone = { id: "bowl-future", releaseAt: new Date(now.getTime() + 30 * DAY_MS) };
  const items = [released, beefBossOnly, notYetForAnyone];

  assert.deepEqual(
    visibleMenuItems(items, "BEEF_BOSS", now).map((i) => i.id),
    ["bowl-classic", "bowl-limited"],
  );
  assert.deepEqual(
    visibleMenuItems(items, "CHOPSTICK", now).map((i) => i.id),
    ["bowl-classic"],
  );
  assert.deepEqual(
    visibleMenuItems(items, null, now).map((i) => i.id),
    ["bowl-classic"],
    "a guest or anonymous caller only sees already-released items",
  );

  assert.equal(firstUnreleasedItem(items, "BEEF_BOSS", now)?.id, "bowl-future");
  assert.equal(firstUnreleasedItem(items, "CHOPSTICK", now)?.id, "bowl-limited");
  assert.equal(firstUnreleasedItem([released], "CHOPSTICK", now), null, "nothing to reject when every item is released");
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
  assert.equal(again.reason, "ALREADY_REFERRED");
  const refereeAfter = await prisma.user.findUnique({ where: { id: "referee" } });
  assert.equal(refereeAfter.creditsCents, PROGRAM.referral.refereeCents);
});

// Task D5 fix round 3: a referral code is only for a genuinely new member -
// no referrer on file AND no completed order - never an error, always a
// clear { applied: false, reason, message }.
test("applyReferralSignup refuses an existing member with a completed order, even with no referrer on file", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "referrer", referralCode: "FRIEND1", creditsCents: 0 },
      { id: "veteran", creditsCents: 0, referredById: null },
    ],
    orders: [{ id: "o1", userId: "veteran", totalCents: 1799, status: "COMPLETED", paymentStatus: "PAID" }],
  });

  const result = await applyReferralSignup(prisma, { userId: "veteran", referralCode: "FRIEND1", now: NOW });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "NOT_NEW_MEMBER");
  assert.match(result.message, /new members/i);

  const veteran = await prisma.user.findUnique({ where: { id: "veteran" } });
  assert.equal(veteran.referredById, null);
  assert.equal(veteran.creditsCents, 0);
});

test("applyReferralSignup refuses self-referral with a clear reason, not an error", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", referralCode: "MYCODE", creditsCents: 0, referredById: null }],
  });

  const result = await applyReferralSignup(prisma, { userId: "u1", referralCode: "MYCODE", now: NOW });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "SELF_REFERRAL");

  const u1 = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(u1.referredById, null);
  assert.equal(u1.creditsCents, 0);
});

test("applyReferralSignup refuses an unknown code with a clear reason", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", creditsCents: 0, referredById: null }],
  });

  const result = await applyReferralSignup(prisma, { userId: "u1", referralCode: "NOPE", now: NOW });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "INVALID_CODE");
});

test("applyReferralSignup still works for a genuinely new member (no orders, no referrer)", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "referrer", referralCode: "FRIEND1", creditsCents: 0 },
      { id: "newbie", creditsCents: 0, referredById: null },
    ],
  });

  const result = await applyReferralSignup(prisma, { userId: "newbie", referralCode: "FRIEND1", now: NOW });
  assert.equal(result.applied, true);
  const newbie = await prisma.user.findUnique({ where: { id: "newbie" } });
  assert.equal(newbie.referredById, "referrer");
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
  // A lot the daily cron already warned about (Task F2): the internal marker
  // must never reach this customer-facing response (fix round 1, review minor).
  await prisma.creditLot.create({ data: { userId: "u1", source: "WELCOME", amountCents: 50, remainingCents: 50, expiresAt: new Date(NOW.getTime() + 2 * DAY_MS), note: "Welcome bonus [expiry-warned]" } });

  const profile = await profileForUser(prisma, "u1", NOW);

  assert.equal(profile.tier, "CHOPSTICK");
  assert.equal(profile.cashbackPct, 1);
  assert.equal(profile.progress.orders.have, 3);
  assert.equal(profile.progress.referrals.have, 1);
  assert.equal(profile.credits, 250);
  assert.deepEqual(profile.expiring.map((l) => l.id).sort(), (await prisma.creditLot.findMany({ where: { userId: "u1" } })).map((l) => l.id).sort());
  assert.ok(profile.expiring.every((l) => !String(l.note || "").includes("[expiry-warned]")), "no lot note leaks the internal marker");
  assert.equal(profile.expiring.find((l) => l.source === "WELCOME").note, "Welcome bonus"); // marker stripped, rest of the note kept
  assert.deepEqual(profile.rewards, []);
  assert.deepEqual(profile.badges, []);
  assert.deepEqual(profile.flags, { welcomeSeenAt: null, lastTierCelebrated: null });
});

test("two concurrent redemptions of one reward: exactly one succeeds", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1" }],
    rewards: [{ id: "r1", userId: "u1", type: "FREE_BOWL", issuedFor: "upgrade:NOODLE_MASTER", windowEndsAt: new Date(NOW.getTime() + DAY_MS), redeemedAt: null }],
  });
  const results = await Promise.allSettled([
    prisma.$transaction((tx) => redeemReward(tx, { userId: "u1", rewardId: "r1", orderId: "o1", now: NOW })),
    prisma.$transaction((tx) => redeemReward(tx, { userId: "u1", rewardId: "r1", orderId: "o2", now: NOW })),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const reward = await prisma.reward.findUnique({ where: { id: "r1" } });
  assert.ok(["o1", "o2"].includes(reward.redeemedOrderId));
});

test("redeemReward claims conditionally (a racing redemption is refused)", async () => {
  const calls = [];
  const tx = {
    reward: {
      findUnique: async () => ({ id: "r1", userId: "u1", redeemedAt: null, windowEndsAt: new Date(NOW.getTime() + DAY_MS) }),
      updateMany: async (args) => {
        calls.push(args);
        return { count: 0 };
      },
    },
  };
  await assert.rejects(redeemReward(tx, { userId: "u1", rewardId: "r1", orderId: "o1", now: NOW }), /already redeemed/);
  assert.deepEqual(calls[0].where, { id: "r1", userId: "u1", redeemedAt: null, windowEndsAt: { gt: NOW } });
});

test("cashback base: $20.00 subtotal, $2 promo, plus tax -> 1% of $18.00 = 18 cents", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "CHOPSTICK", creditsCents: 0 }],
    orders: [{ id: "o1", userId: "u1", subtotalCents: 2000, promoDiscountCents: 200, rewardDiscountCents: 0, taxCents: 170, totalCents: 1970, amountDueCents: 1470, creditsAppliedCents: 500, status: "COMPLETED", paymentStatus: "PAID" }],
  });
  const result = await onOrderCompleted(prisma, { orderId: "o1", now: NOW });
  assert.equal(result.cashbackCents, 18);
});

test("sweepUnprocessedCompletedOrders pays COMPLETED+PAID orders older than 5 minutes that were never processed", async () => {
  const { sweepUnprocessedCompletedOrders } = await import("../engine.js");
  const old = new Date(NOW.getTime() - 10 * 60 * 1000);
  const fresh = new Date(NOW.getTime() - 60 * 1000);
  const prisma = makeMemoryPrisma({
    users: [{ id: "u1", membershipTier: "CHOPSTICK", creditsCents: 0, tierProgressOrders: 0, tierProgressReferrals: 0 }],
    orders: [
      { id: "stuck", userId: "u1", totalCents: 2000, status: "COMPLETED", paymentStatus: "PAID", membershipProcessedAt: null, updatedAt: old },
      { id: "fresh", userId: "u1", totalCents: 2000, status: "COMPLETED", paymentStatus: "PAID", membershipProcessedAt: null, updatedAt: fresh },
      { id: "unpaid", userId: "u1", totalCents: 2000, status: "COMPLETED", paymentStatus: "PENDING", membershipProcessedAt: null, updatedAt: old },
    ],
  });

  const swept = await sweepUnprocessedCompletedOrders(prisma, NOW);

  assert.equal(swept, 1);
  assert.ok((await prisma.order.findUnique({ where: { id: "stuck" } })).membershipProcessedAt);
  assert.equal((await prisma.order.findUnique({ where: { id: "fresh" } })).membershipProcessedAt ?? null, null);
  assert.equal((await prisma.creditLot.findMany({ where: { source: "CASHBACK" } })).length, 1);
  assert.equal(await sweepUnprocessedCompletedOrders(prisma, NOW), 0, "idempotent");
});

// Final review I1: concurrent POST /users {referredByCode} for the same
// member must mint exactly one WELCOME lot (conditional claim + grant in one tx).
test("applyReferralSignup: 5 concurrent signups for one user grant exactly one WELCOME lot", async () => {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "referrer", referralCode: "FRIEND1", creditsCents: 0 },
      { id: "referee", creditsCents: 0, referredById: null },
    ],
  });

  const results = await Promise.all(
    Array.from({ length: 5 }, () => applyReferralSignup(prisma, { userId: "referee", referralCode: "FRIEND1", now: NOW })),
  );

  assert.equal(results.filter((r) => r.applied).length, 1);
  for (const r of results.filter((r) => !r.applied)) assert.equal(r.reason, "ALREADY_REFERRED");
  const lots = await prisma.creditLot.findMany({ where: { userId: "referee", source: "WELCOME" } });
  assert.equal(lots.length, 1);
  const referee = await prisma.user.findUnique({ where: { id: "referee" } });
  assert.equal(referee.creditsCents, PROGRAM.referral.refereeCents);
  assert.equal(referee.referredById, "referrer");
});
