/**
 * Membership engine: cashback, tiers, capped referrals, rewards, early access.
 *
 * Built on top of `program.js` (tier config) and `credits.js` (the CreditLot
 * ledger). This module owns the side effects that happen when an order
 * reaches COMPLETED, when a referral signup lands, when a quarter turns
 * over, and the read-side helpers (`profileForUser`, `earlyAccessVisible`).
 *
 * All money math stays in whole cents; percentages are floored (never round
 * up in the member's favor beyond what's configured).
 */
import { PROGRAM, tierRule, evaluateProgress } from "./program.js";
import { grantCredit, availableCredit, expiringSoon } from "./credits.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * "2026-Q4"-style key for `date` as read in `tz` (default America/Denver).
 * Deliberately timezone-aware: the same instant can fall in different
 * quarters in UTC vs. America/Denver near year/quarter boundaries.
 */
export function quarterKey(date, tz = PROGRAM.timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year").value);
  const month = Number(parts.find((p) => p.type === "month").value);
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/** The UTC instant of local midnight on (year, month, day) in `tz`. */
function zonedMidnightUtc(year, month, day, tz) {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === "24" ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asIfUtc - utcGuess;
  return new Date(utcGuess - offset);
}

/** The UTC instant at which the quarter containing `date` (in `tz`) ends. */
function quarterEndUtc(date, tz = PROGRAM.timezone) {
  const [year, quarterNum] = quarterKey(date, tz).split("-Q").map(Number);
  const nextQuarterFirstMonth = quarterNum * 3 + 1; // may be 13
  const nextYear = nextQuarterFirstMonth > 12 ? year + 1 : year;
  const nextMonth = nextQuarterFirstMonth > 12 ? nextQuarterFirstMonth - 12 : nextQuarterFirstMonth;
  return zonedMidnightUtc(nextYear, nextMonth, 1, tz);
}

/**
 * Whether a menu item's early-access window makes it visible to `tier`
 * (null for a guest/anonymous caller) at `now`. Once `releaseAt` passes,
 * every caller sees it; before that, only a tier whose `earlyAccessDays`
 * reaches far enough back from `releaseAt` sees it.
 */
export function earlyAccessVisible(menuItem, tier, now = new Date()) {
  const releaseAt = menuItem?.releaseAt;
  if (!releaseAt) return true;
  const release = releaseAt instanceof Date ? releaseAt : new Date(releaseAt);
  if (now >= release) return true;
  if (!tier) return false;
  const rule = tierRule(tier);
  const earlyAt = new Date(release.getTime() - rule.earlyAccessDays * DAY_MS);
  return now >= earlyAt;
}

/**
 * Evaluates `userId`'s progress and, if they're ready, upgrades their tier:
 * resets both progress counters and issues the upgrade FREE_BOWL reward
 * (issuedFor `upgrade:<newTier>`, window `upgradeRewardWindowDays` long).
 * Returns the new tier key, or null if no upgrade happened.
 */
async function evaluateAndApplyUpgrade(prisma, userId, now) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const progress = evaluateProgress(user);
  if (!progress.ready || !progress.next) return null;

  const newTier = progress.next;
  await prisma.user.update({
    where: { id: userId },
    data: { membershipTier: newTier, tierProgressOrders: 0, tierProgressReferrals: 0 },
  });

  const issuedFor = `upgrade:${newTier}`;
  const existing = await prisma.reward.findFirst({ where: { userId, type: PROGRAM.upgradeReward, issuedFor } });
  if (!existing) {
    await prisma.reward.create({
      data: {
        userId,
        type: PROGRAM.upgradeReward,
        issuedFor,
        windowEndsAt: addDays(now, PROGRAM.upgradeRewardWindowDays),
      },
    });
  }

  // Preserves the pre-engine behavior of awarding the "vip" Badge on reaching
  // BEEF_BOSS (previously in index.js's checkTierUpgrade). This runs for
  // anyone who reaches BEEF_BOSS through this function, including a referrer
  // upgraded by a referral payout, not just someone completing their own order.
  if (newTier === "BEEF_BOSS") {
    const vipBadge = await prisma.badge.findUnique({ where: { slug: "vip" } });
    if (vipBadge) {
      const hasBadge = await prisma.userBadge.findFirst({ where: { userId, badgeId: vipBadge.id } });
      if (!hasBadge) {
        await prisma.userBadge.create({ data: { userId, badgeId: vipBadge.id } }).catch(() => {});
      }
    }
  }

  return newTier;
}

/**
 * Pays the referrer PROGRAM.referral.referrerCents when `referee`'s order is
 * their first COMPLETED order, capped at `maxPaidPer30Days` paid referrals
 * per referrer in a rolling 30-day window. Over the cap, writes a zero-amount
 * "note" CreditEvent instead of paying, and pays nothing.
 * Returns true if a referral was actually paid.
 */
async function payReferralIfEligible(prisma, { referee, order, now }) {
  if (!referee?.referredById) return false;

  const completedCount = await prisma.order.count({
    where: { userId: referee.id, status: "COMPLETED" },
  });
  if (completedCount !== 1) return false; // not their first completed order

  const referrerId = referee.referredById;
  const windowStart = new Date(now.getTime() - 30 * DAY_MS);
  const paidInWindow = await prisma.creditEvent.count({
    where: { userId: referrerId, type: "REFERRAL_ORDER", createdAt: { gte: windowStart } },
  });

  if (paidInWindow >= PROGRAM.referral.maxPaidPer30Days) {
    await prisma.creditEvent.create({
      data: {
        userId: referrerId,
        type: "REFERRAL_ORDER",
        amountCents: 0,
        orderId: order.id,
        description: `Referral cap reached: ${PROGRAM.referral.maxPaidPer30Days} paid referrals in the last 30 days`,
      },
    });
    return false;
  }

  await grantCredit(prisma, {
    userId: referrerId,
    source: "REFERRAL",
    amountCents: PROGRAM.referral.referrerCents,
    orderId: order.id,
    note: "Referral bonus - friend completed their first order",
    now,
  });
  await prisma.user.update({
    where: { id: referrerId },
    data: { tierProgressReferrals: { increment: 1 } },
  });
  await evaluateAndApplyUpgrade(prisma, referrerId, now);

  return true;
}

/**
 * Runs every membership side effect for an order that has just reached
 * COMPLETED: cashback, tier-progress increment and upgrade, and the
 * referrer's payout. Idempotent per order: a CASHBACK CreditEvent already
 * carrying this orderId means the order was already processed, so a second
 * call is a no-op.
 */
export async function onOrderCompleted(prisma, { orderId, now = new Date() }) {
  const already = await prisma.creditEvent.findFirst({ where: { orderId, type: "CASHBACK" } });
  if (already) {
    return { cashbackCents: 0, upgradedTo: null, rewardIssued: null, referralPaid: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.userId) {
    return { cashbackCents: 0, upgradedTo: null, rewardIssued: null, referralPaid: false };
  }

  const user = await prisma.user.findUnique({ where: { id: order.userId } });
  if (!user) {
    return { cashbackCents: 0, upgradedTo: null, rewardIssued: null, referralPaid: false };
  }

  const rule = tierRule(user.membershipTier);
  const cashbackCents = Math.floor((order.totalCents * rule.cashbackPct) / 100);
  if (cashbackCents > 0) {
    await grantCredit(prisma, {
      userId: user.id,
      source: "CASHBACK",
      amountCents: cashbackCents,
      orderId,
      note: `${rule.cashbackPct}% cashback on order`,
      now,
    });
  } else {
    // Nothing to grant, but we still need a marker for the idempotency check above.
    await prisma.creditEvent.create({
      data: { userId: user.id, type: "CASHBACK", amountCents: 0, orderId, description: "No cashback (order too small)" },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { tierProgressOrders: { increment: 1 } },
  });

  const upgradedTo = await evaluateAndApplyUpgrade(prisma, user.id, now);
  const rewardIssued = upgradedTo
    ? await prisma.reward.findFirst({ where: { userId: user.id, type: PROGRAM.upgradeReward, issuedFor: `upgrade:${upgradedTo}` } })
    : null;

  const referralPaid = await payReferralIfEligible(prisma, { referee: user, order, now });

  return { cashbackCents, upgradedTo, rewardIssued, referralPaid };
}

/**
 * Applies a referral code at signup: sets `referredById` (only if the user
 * doesn't already have a referrer) and grants the referee a WELCOME credit
 * lot. Does not pay the referrer; that happens in `onOrderCompleted` on the
 * referee's first completed order.
 */
export async function applyReferralSignup(prisma, { userId, referralCode, now = new Date() }) {
  if (!referralCode) return { applied: false };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.referredById) return { applied: false };

  const referrer = await prisma.user.findUnique({ where: { referralCode } });
  if (!referrer || referrer.id === userId) return { applied: false };

  await prisma.user.update({ where: { id: userId }, data: { referredById: referrer.id } });
  await grantCredit(prisma, {
    userId,
    source: "WELCOME",
    amountCents: PROGRAM.referral.refereeCents,
    note: "Welcome bonus - referred by a friend",
    now,
  });

  return { applied: true, referrerId: referrer.id };
}

/**
 * Issues one PREMIUM_ADDON reward per BEEF_BOSS member for the quarter
 * containing `now`. Idempotent: a member who already has a reward for this
 * quarter is skipped. Returns the number of rewards issued.
 */
export async function issueQuarterlyPerks(prisma, now = new Date()) {
  const { tier, type } = PROGRAM.quarterlyPerk;
  const issuedFor = quarterKey(now, PROGRAM.timezone);
  const windowEndsAt = quarterEndUtc(now, PROGRAM.timezone);

  const members = await prisma.user.findMany({ where: { membershipTier: tier } });
  let issued = 0;
  for (const member of members) {
    const existing = await prisma.reward.findFirst({ where: { userId: member.id, type, issuedFor } });
    if (existing) continue;
    await prisma.reward.create({ data: { userId: member.id, type, issuedFor, windowEndsAt } });
    issued++;
  }
  return issued;
}

/**
 * Marks a Reward redeemed against `orderId`. Throws if it doesn't belong to
 * `userId`, is already redeemed, or its window has passed. Takes a
 * transaction client (`tx`) so callers can apply it atomically alongside the
 * order write.
 */
export async function redeemReward(tx, { userId, rewardId, orderId, now = new Date() }) {
  const reward = await tx.reward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.userId !== userId) {
    throw new Error("Reward not found");
  }
  if (reward.redeemedAt) {
    throw new Error("Reward already redeemed");
  }
  if (reward.windowEndsAt <= now) {
    throw new Error("Reward expired");
  }
  return tx.reward.update({ where: { id: rewardId }, data: { redeemedOrderId: orderId, redeemedAt: now } });
}

/**
 * Everything the /users/:id/profile UI needs from the membership engine:
 * current tier, progress toward the next one, spendable credit, lots
 * expiring soon, active rewards, earned badges and a couple of UI flags.
 */
export async function profileForUser(prisma, userId, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const rule = tierRule(user.membershipTier);
  const progress = evaluateProgress(user);

  const [credits, expiring, rewards, userBadges] = await Promise.all([
    availableCredit(prisma, userId, now),
    expiringSoon(prisma, userId, now),
    prisma.reward.findMany({ where: { userId } }),
    safeFindMany(prisma.userBadge, { where: { userId } }),
  ]);

  const badgeIds = userBadges.map((ub) => ub.badgeId);
  const badgeRows = badgeIds.length ? await safeFindMany(prisma.badge, { where: { id: { in: badgeIds } } }) : [];
  const badgesById = new Map(badgeRows.map((b) => [b.id, b]));
  const badges = userBadges.map((ub) => ({ ...ub, badge: badgesById.get(ub.badgeId) || null }));

  const activeRewards = rewards.filter((r) => !r.redeemedAt && r.windowEndsAt > now);

  return {
    tier: user.membershipTier,
    cashbackPct: rule.cashbackPct,
    progress,
    credits,
    expiring,
    rewards: activeRewards,
    badges,
    flags: {
      welcomeSeenAt: user.welcomeSeenAt || null,
      lastTierCelebrated: user.lastTierCelebrated || null,
    },
  };
}

/** Tolerates a prisma stub (tests) that doesn't implement a given delegate. */
async function safeFindMany(delegate, args) {
  if (!delegate || typeof delegate.findMany !== "function") return [];
  return delegate.findMany(args);
}
