/**
 * The referral page's numbers (Task D9), returned by GET /users/:id/credits
 * as `referral` (that route is requireSelf, via the /users/:id/* onRoute hook).
 *
 *  - earnedCents / paidCount: the member's REFERRAL CreditLots. These are the
 *    only thing a referral pays out (store credit, never cash), so the
 *    earnings are read from the lots, not from the free-text event log.
 *  - paidLast30Days: what the cap counts. It mirrors payReferralIfEligible
 *    (engine.js): positive REFERRAL_ORDER events in the rolling 30 days.
 *  - friendsJoined: members who signed up with this member's link.
 *  - recent: the latest REFERRAL lots (amount, date, expiry), newest first.
 */
import { PROGRAM } from "./program.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT = 10;

export async function referralSummary(prisma, userId, now = new Date()) {
  const windowStart = new Date(now.getTime() - 30 * DAY_MS);
  const [lots, paidLast30Days, friendsJoined] = await Promise.all([
    prisma.creditLot.findMany({ where: { userId, source: "REFERRAL" }, orderBy: { createdAt: "desc" } }),
    prisma.creditEvent.count({ where: { userId, type: "REFERRAL_ORDER", amountCents: { gt: 0 }, createdAt: { gte: windowStart } } }),
    prisma.user.count({ where: { referredById: userId } }),
  ]);
  const { referrerCents, refereeCents, maxPaidPer30Days } = PROGRAM.referral;
  return {
    earnedCents: lots.reduce((sum, lot) => sum + (lot.amountCents || 0), 0),
    paidCount: lots.length,
    paidLast30Days,
    remainingThis30Days: Math.max(0, maxPaidPer30Days - paidLast30Days),
    maxPaidPer30Days,
    referrerCents,
    refereeCents,
    friendsJoined,
    recent: lots.slice(0, RECENT).map((lot) => ({
      id: lot.id,
      amountCents: lot.amountCents,
      remainingCents: lot.remainingCents,
      createdAt: lot.createdAt,
      expiresAt: lot.expiresAt,
    })),
  };
}
