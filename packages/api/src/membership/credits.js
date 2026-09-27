/**
 * Credit lot ledger.
 *
 * Member credit (cashback, referral, welcome, goodwill, ...) lives as
 * expiring `CreditLot` rows rather than a single balance. `User.creditsCents`
 * stays as a cached total, kept in sync with the lots in the same
 * transaction as every grant, spend and expiry.
 */
import { PROGRAM } from "./program.js";

export class CreditShortError extends Error {
  constructor(availableCents) {
    super(`Insufficient credit: ${availableCents} cents available`);
    this.name = "CreditShortError";
    this.availableCents = availableCents;
  }
}

// One small table mapping each CreditLotSource to the CreditEvent type it logs.
const GRANT_EVENT_TYPE = {
  CASHBACK: "CASHBACK",
  GOODWILL: "GOODWILL",
  WELCOME: "WELCOME",
  REFERRAL: "REFERRAL_ORDER",
  ADMIN: "ADMIN_ADJUSTMENT",
  LEGACY: "ADMIN_ADJUSTMENT",
  CHALLENGE: "CHALLENGE_REWARD",
};

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Guards every ledger-moving amount: must be a positive integer number of cents. */
function assertPositiveAmount(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RangeError(`amountCents must be a positive integer, got ${amountCents}`);
  }
}

/**
 * Creates a CreditLot expiring `PROGRAM.creditExpiryDays` from `now`,
 * increments the cached `User.creditsCents`, and logs a CreditEvent.
 * Returns the created lot.
 */
export async function grantCredit(prisma, { userId, source, amountCents, orderId = null, note = null, now = new Date() }) {
  assertPositiveAmount(amountCents);
  return prisma.$transaction((tx) => grantCreditInTx(tx, { userId, source, amountCents, orderId, note, now }));
}

/**
 * The same grant as `grantCredit`, but for a caller that already has an open
 * transaction client (`tx`) and wants this grant to be part of it, rather
 * than opening its own nested transaction. Real Prisma's interactive
 * transaction client has no `$transaction` of its own, so code that runs
 * inside e.g. `prisma.$transaction(async (tx) => { ...; await grantCredit(tx, ...); })`
 * would break against a real database even though it happens to work
 * against the in-memory test stub (whose `tx` objects have a `$transaction`
 * too). Use this instead whenever `tx` is already a transaction client.
 */
export async function grantCreditInTx(tx, { userId, source, amountCents, orderId = null, note = null, now = new Date() }) {
  assertPositiveAmount(amountCents);
  const lot = await tx.creditLot.create({
    data: {
      userId,
      source,
      amountCents,
      remainingCents: amountCents,
      expiresAt: addDays(now, PROGRAM.creditExpiryDays),
      orderId,
      note,
    },
  });
  await tx.user.update({ where: { id: userId }, data: { creditsCents: { increment: amountCents } } });
  await tx.creditEvent.create({
    data: {
      userId,
      type: GRANT_EVENT_TYPE[source] || "ADMIN_ADJUSTMENT",
      amountCents,
      orderId,
      description: note,
    },
  });
  return lot;
}

/** Sum of `remainingCents` across lots that haven't expired as of `now`. */
export async function availableCredit(prisma, userId, now = new Date()) {
  const { _sum } = await prisma.creditLot.aggregate({
    where: { userId, remainingCents: { gt: 0 }, expiresAt: { gt: now } },
    _sum: { remainingCents: true },
  });
  return _sum.remainingCents || 0;
}

/**
 * Spends from the soonest-expiring unexpired lots first. Runs inside a
 * transaction: if the available balance (re-checked against `now`, so a lot
 * that expired between quote and pay is excluded) is short, throws
 * CreditShortError and nothing is written.
 */
export async function spendCredit(prisma, { userId, amountCents, orderId, now = new Date() }) {
  assertPositiveAmount(amountCents);
  return prisma.$transaction(async (tx) => {
    const lots = await tx.creditLot.findMany({
      where: { userId, remainingCents: { gt: 0 }, expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" },
    });

    const available = lots.reduce((sum, lot) => sum + lot.remainingCents, 0);
    if (available < amountCents) throw new CreditShortError(available);

    let remaining = amountCents;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.remainingCents, remaining);
      await tx.creditLot.update({ where: { id: lot.id }, data: { remainingCents: { decrement: take } } });
      remaining -= take;
    }

    await tx.user.update({ where: { id: userId }, data: { creditsCents: { decrement: amountCents } } });
    await tx.creditEvent.create({
      data: { userId, type: "CREDIT_APPLIED", amountCents: -amountCents, orderId },
    });
  });
}

/**
 * Zeroes every lot that has expired as of `now`, decrements the cached
 * balance to match, and logs a CREDIT_EXPIRED event per lot. Returns the
 * number of lots expired.
 */
export async function expireLots(prisma, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const lots = await tx.creditLot.findMany({
      where: { remainingCents: { gt: 0 }, expiresAt: { lte: now } },
    });

    for (const lot of lots) {
      const amount = lot.remainingCents;
      await tx.creditLot.update({ where: { id: lot.id }, data: { remainingCents: 0 } });
      await tx.user.update({ where: { id: lot.userId }, data: { creditsCents: { decrement: amount } } });
      await tx.creditEvent.create({
        data: { userId: lot.userId, type: "CREDIT_EXPIRED", amountCents: -amount, orderId: lot.orderId },
      });
    }

    return lots.length;
  });
}

/** Lots expiring within `PROGRAM.expiryWarningDays` of `now` (but not yet expired), soonest first. */
export async function expiringSoon(prisma, userId, now = new Date()) {
  const warnBy = addDays(now, PROGRAM.expiryWarningDays);
  return prisma.creditLot.findMany({
    where: { userId, remainingCents: { gt: 0 }, expiresAt: { gt: now, lte: warnBy } },
    orderBy: { expiresAt: "asc" },
  });
}

/**
 * Cutover helper: for every user with a positive `creditsCents` and no
 * existing lots, creates one LEGACY lot backing that balance (the cached
 * balance itself is left unchanged - the lot just gives it an expiry).
 * Idempotent: a user who already has a lot (from a prior run, or any other
 * source) is skipped. Returns the number of lots created.
 */
export async function convertLegacyBalances(prisma, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({ where: { creditsCents: { gt: 0 } } });

    let count = 0;
    for (const user of users) {
      const existingLot = await tx.creditLot.findFirst({ where: { userId: user.id } });
      if (existingLot) continue;

      await tx.creditLot.create({
        data: {
          userId: user.id,
          source: "LEGACY",
          amountCents: user.creditsCents,
          remainingCents: user.creditsCents,
          expiresAt: addDays(now, PROGRAM.creditExpiryDays),
        },
      });
      await tx.creditEvent.create({
        data: {
          userId: user.id,
          type: GRANT_EVENT_TYPE.LEGACY,
          amountCents: user.creditsCents,
          description: "Legacy balance migration",
        },
      });
      count++;
    }

    return count;
  });
}
