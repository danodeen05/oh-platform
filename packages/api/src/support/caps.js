/**
 * Goodwill caps (Task A9).
 *
 * Chappy's goodwill is STORE CREDIT ONLY: a GOODWILL CreditLot through
 * membership/credits.js, never money back to a card. The owner's caps live in
 * PROGRAM.goodwill: per order, per rolling 30 days, lifetime, and only on the
 * member's own order from the last `orderAgeHours`.
 *
 * Concurrency: grantGoodwill locks the member's User row (SELECT ... FOR
 * UPDATE) as the first statement of its transaction, then re-reads the caps
 * and writes the lot in that same transaction. A second grant for the same
 * member blocks on the lock until the first commits, and under READ COMMITTED
 * its later statements see the first grant's lot, so no interleaving can take
 * a member past any cap.
 */
import { PROGRAM } from "../membership/program.js";
import { grantCreditInTx } from "../membership/credits.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function sumGoodwill(prisma, where) {
  const { _sum } = await prisma.creditLot.aggregate({ where: { source: "GOODWILL", ...where }, _sum: { amountCents: true } });
  return _sum.amountCents || 0;
}

/**
 * How much goodwill `userId` may still get for `orderId` as of `now`.
 * Returns { allowedCents, reason }. `reason` names the cap that holds the
 * allowance below the full per-order amount ("PER_ORDER", "PER_30_DAYS",
 * "LIFETIME"; the most lasting one on a tie), or why nothing is allowed at
 * all ("NOT_OWNER", "ORDER_NOT_PAID", "ORDER_TOO_OLD"); it is null when the full per-order
 * amount is available.
 */
export async function goodwillAllowance(prisma, { userId, orderId, now = new Date() }) {
  const caps = PROGRAM.goodwill;
  const order = userId && orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
  if (!order || order.userId !== userId) return { allowedCents: 0, reason: "NOT_OWNER" };
  // Goodwill makes up for a paid meal: only on an order whose paymentStatus is still PAID.
  if (order.paymentStatus !== "PAID") return { allowedCents: 0, reason: "ORDER_NOT_PAID" };

  const at = new Date(order.completedTime || order.createdAt);
  if (!(now.getTime() - at.getTime() <= caps.orderAgeHours * 60 * 60 * 1000)) return { allowedCents: 0, reason: "ORDER_TOO_OLD" };

  const [orderUsed, recentUsed, lifetimeUsed] = await Promise.all([
    sumGoodwill(prisma, { userId, orderId }),
    sumGoodwill(prisma, { userId, createdAt: { gt: new Date(now.getTime() - 30 * DAY_MS) } }),
    sumGoodwill(prisma, { userId }),
  ]);
  // Most lasting first, so a tie reports the cap that will not lift soon.
  const left = [
    ["LIFETIME", caps.lifetimeCents - lifetimeUsed],
    ["PER_30_DAYS", caps.per30DaysCents - recentUsed],
    ["PER_ORDER", caps.perOrderCents - orderUsed],
  ].map(([reason, cents]) => [reason, Math.max(0, cents)]);
  const [reason, allowedCents] = left.reduce((best, cur) => (cur[1] < best[1] ? cur : best));
  return { allowedCents: Math.min(allowedCents, caps.perOrderCents), reason: allowedCents < caps.perOrderCents ? reason : null };
}

/**
 * Grants min(requestedCents, allowance) as a GOODWILL CreditLot (90-day
 * expiry, via grantCreditInTx). With a `caseId`, the case must be the
 * member's (and for this order, when it names one) and still unresolved; it
 * is claimed and marked RESOLVED / GOODWILL_CREDIT in the same transaction,
 * so one case grants at most once.
 *
 * Returns { grantedCents, allowedCents, reason, lot, alreadyResolved }.
 * Throws RangeError for a requestedCents that is not a positive integer.
 */
export async function grantGoodwill(prisma, { userId, orderId, requestedCents, caseId = null, now = new Date() }) {
  if (!Number.isInteger(requestedCents) || requestedCents <= 0) {
    throw new RangeError(`requestedCents must be a positive integer, got ${requestedCents}`);
  }
  const nothing = (fields) => ({ grantedCents: 0, allowedCents: 0, reason: null, lot: null, alreadyResolved: false, ...fields });

  return prisma.$transaction(async (tx) => {
    // Serialize goodwill per member: every cap below is read under this lock.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

    if (caseId) {
      const c = await tx.supportCase.findUnique({ where: { id: caseId } });
      if (!c || c.userId !== userId || (c.orderId && c.orderId !== orderId)) return nothing({ reason: "CASE_MISMATCH" });
      if (c.status !== "OPEN" || c.resolution) return nothing({ alreadyResolved: true });
    }

    const { allowedCents, reason } = await goodwillAllowance(tx, { userId, orderId, now });
    const amountCents = Math.min(requestedCents, allowedCents);
    if (amountCents <= 0) return nothing({ allowedCents, reason });

    if (caseId) {
      const claim = await tx.supportCase.updateMany({
        where: { id: caseId, status: "OPEN", resolution: null },
        data: { status: "RESOLVED", resolution: "GOODWILL_CREDIT", amountCents, resolvedBy: "goodwill", resolvedAt: now },
      });
      if (claim.count !== 1) return nothing({ alreadyResolved: true });
    }

    const lot = await grantCreditInTx(tx, {
      userId,
      source: "GOODWILL",
      amountCents,
      orderId,
      note: caseId ? `goodwill, support case ${caseId}` : "goodwill",
      now,
    });
    return { grantedCents: amountCents, allowedCents, reason, lot, alreadyResolved: false };
  });
}
