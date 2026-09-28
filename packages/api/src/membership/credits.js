/**
 * Credit lot ledger.
 *
 * Member credit (cashback, referral, welcome, goodwill, ...) lives as
 * expiring `CreditLot` rows rather than a single balance. `User.creditsCents`
 * stays as a cached total, kept in sync with the lots in the same
 * transaction as every grant, spend and expiry.
 */
import { PROGRAM } from "./program.js";
import { sendCreditExpiryWarning, notifyMode } from "../notifications.js";

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
  MEAL_GIFT: "GIFT_EXCESS",
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
export async function grantCredit(prisma, { userId, source, amountCents, orderId = null, note = null, eventType = null, now = new Date() }) {
  assertPositiveAmount(amountCents);
  return prisma.$transaction((tx) => grantCreditInTx(tx, { userId, source, amountCents, orderId, note, eventType, now }));
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
export async function grantCreditInTx(tx, { userId, source, amountCents, orderId = null, note = null, eventType = null, now = new Date() }) {
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
      // eventType overrides the source's default (e.g. MEAL_GIFT logs GIFT_EXCESS or REFUND).
      type: eventType || GRANT_EVENT_TYPE[source] || "ADMIN_ADJUSTMENT",
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
  return prisma.$transaction((tx) => spendCreditInTx(tx, { userId, amountCents, orderId, now }));
}

/**
 * The same spend as `spendCredit`, inside a transaction the caller already
 * holds (see `grantCreditInTx` for why: a real interactive-transaction client
 * has no `$transaction`). Throws CreditShortError before writing anything when
 * the unexpired balance is short, so the caller's whole transaction rolls back.
 */
export async function spendCreditInTx(tx, { userId, amountCents, orderId, now = new Date(), description = undefined, metadata = undefined }) {
  assertPositiveAmount(amountCents);
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
    // Conditional decrement: a concurrent spend that already took from this
    // lot makes the WHERE miss (count 0) instead of driving it negative.
    const res = await tx.creditLot.updateMany({
      where: { id: lot.id, remainingCents: { gte: take }, expiresAt: { gt: now } },
      data: { remainingCents: { decrement: take } },
    });
    if (res.count !== 1) throw new CreditShortError(available - (amountCents - remaining));
    remaining -= take;
  }

  await tx.user.update({ where: { id: userId }, data: { creditsCents: { decrement: amountCents } } });
  await tx.creditEvent.create({
    // description/metadata: optional context, e.g. a shop order (CreditEvent.orderId is a food Order).
    data: { userId, type: "CREDIT_APPLIED", amountCents: -amountCents, orderId, ...(description ? { description } : {}), ...(metadata ? { metadata } : {}) },
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

// Idempotency marker for the expiry-warning SMS, stored as a note on the lot
// itself rather than a new CreditEvent type. Two reasons: (1) the controller
// notes prefer a note on an existing thing over a schema migration, and (2)
// a CreditEvent would show up in the customer's own /users/:id/credits
// history (GET returns the last 50 raw), which would confuse a member with a
// $0.00 "admin adjustment" line that isn't real money moving.
const EXPIRY_WARNED_MARKER = "expiry-warned";

function isExpiryWarned(lot) {
  return typeof lot.note === "string" && lot.note.includes(`[${EXPIRY_WARNED_MARKER}]`);
}

/**
 * Every not-yet-expired lot (across all users) that expires within
 * `PROGRAM.expiryWarningDays` of `now` and hasn't been warned about yet
 * (see `markExpiryWarned`). This is what the daily cron sends the
 * `creditExpiring` SMS for; a lot appears here at most once no matter how
 * many times the cron runs. Soonest-expiring first.
 */
export async function lotsNeedingExpiryWarning(prisma, now = new Date()) {
  const warnBy = addDays(now, PROGRAM.expiryWarningDays);
  const lots = await prisma.creditLot.findMany({
    where: { remainingCents: { gt: 0 }, expiresAt: { gt: now, lte: warnBy } },
    orderBy: { expiresAt: "asc" },
  });
  return lots.filter((lot) => !isExpiryWarned(lot));
}

/**
 * Marks `lot` as warned so a later cron run's `lotsNeedingExpiryWarning`
 * skips it. Idempotent: calling it twice on the same lot is a no-op the
 * second time.
 */
export async function markExpiryWarned(prisma, lotId) {
  const lot = await prisma.creditLot.findUnique({ where: { id: lotId } });
  if (!lot || isExpiryWarned(lot)) return lot || null;
  const marker = `[${EXPIRY_WARNED_MARKER}]`;
  const note = lot.note ? `${lot.note} ${marker}` : marker;
  return prisma.creditLot.update({ where: { id: lotId }, data: { note } });
}

/**
 * Strips the internal `[expiry-warned]` marker from `lot.note` (Task F2 fix
 * round 1, review minor). Nothing parses `note` today, but `profileForUser`
 * (membership/engine.js) returns raw `expiringSoon` lots - including
 * `note` - to the customer over `GET /users/:id/profile`, and those are
 * exactly the ones the marker gets attached to. Returns `lot` unchanged if
 * it has no marker (so callers can map over a mixed list safely).
 */
export function stripExpiryWarnedMarker(lot) {
  if (!isExpiryWarned(lot)) return lot;
  const note = lot.note.replace(`[${EXPIRY_WARNED_MARKER}]`, "").trim() || null;
  return { ...lot, note };
}

/**
 * Sends AT MOST ONE `creditExpiring` SMS per user per run (Task F2 fix round
 * 1, controller ruling: one text per small cashback lot is spam). Every
 * unwarned lot `lotsNeedingExpiryWarning` returns is grouped by `userId`;
 * the group's `remainingCents` are summed and its soonest `expiresAt` is
 * used. A text is sent only if that total reaches `PROGRAM.expiryWarningMinCents`
 * (100 cents) - below it, nothing is sent, but every lot in the group is
 * still marked warned (see `markExpiryWarned`), so a lot is only ever
 * considered once, whether or not it crossed the floor with its group.
 *
 * Honors `notifications.js`'s SUPPORT_NOTIFY gate (off | log | live) the
 * same way every other customer-SMS code path does (R3): "off" does nothing
 * at all (not even a lookup), "log" looks the lots up and logs what it would
 * have sent without calling Twilio, "live" actually sends (still subject to
 * `canSendSMS`/opt-in inside `sendCreditExpiryWarning`, and to Twilio simply
 * not being configured in dev/test). Never throws.
 */
export async function sendExpiryWarnings(prisma, { now = new Date(), env = process.env, log = console.log } = {}) {
  const mode = notifyMode(env);
  if (mode === "off") return { sent: 0, warned: 0 };

  const lots = await lotsNeedingExpiryWarning(prisma, now);
  const byUser = new Map(); // userId -> lot[]
  for (const lot of lots) {
    if (!byUser.has(lot.userId)) byUser.set(lot.userId, []);
    byUser.get(lot.userId).push(lot);
  }

  let sent = 0;
  let warned = 0;
  for (const [userId, userLots] of byUser) {
    const totalCents = userLots.reduce((sum, l) => sum + l.remainingCents, 0);
    const soonestExpiresAt = userLots.reduce((min, l) => (l.expiresAt < min ? l.expiresAt : min), userLots[0].expiresAt);

    if (totalCents >= PROGRAM.expiryWarningMinCents) {
      try {
        if (mode === "log") {
          log(`[cron] SUPPORT_NOTIFY=log: would send credit-expiry warning to user ${userId} for ${userLots.length} lot(s), $${(totalCents / 100).toFixed(2)}`);
        } else {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user) {
            const result = await sendCreditExpiryWarning(user, { totalCents, soonestExpiresAt });
            if (result?.success) sent++;
          }
        }
      } catch (err) {
        console.error(`[cron] sendExpiryWarnings failed for user ${userId}:`, err?.message || err);
      }
    }

    for (const lot of userLots) {
      await markExpiryWarned(prisma, lot.id);
      warned++;
    }
  }
  return { sent, warned };
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
