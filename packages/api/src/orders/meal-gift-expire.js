/**
 * Final review I2 (and M6): returns lapsed meal gifts.
 *
 * Every PENDING gift past `expiresAt` is claimed PENDING -> EXPIRED with a
 * conditional update, and, when the giver actually paid for it (`paidAt`,
 * Task A6), the full amount goes back to the giver as a MEAL_GIFT credit lot
 * (eventType REFUND_RESTORE) IN THE SAME TRANSACTION as the claim. The claim
 * is the idempotency key: a re-run, the `/meal-gifts/expire` route, the
 * cutover backfill's second pass (packages/db/scripts/backfill-mealgift-paidat.ts,
 * same claim, same note) or a concurrent accept can never return a gift twice,
 * and a crash between the claim and the grant loses nothing (both roll back).
 *
 * Used by `POST /meal-gifts/expire` (index.js) and the `expire-meal-gifts`
 * job in cron/wallet-cron.js.
 */
import { grantCreditInTx } from "../membership/credits.js";

export const MEAL_GIFT_RETURN_NOTE = "Meal gift expired and refunded";

/**
 * @returns {Promise<Array<{ id: string, giverId: string, amountCents: number, refunded: boolean }>>}
 *   one entry per gift this call expired (gifts another caller won are left out).
 */
export async function expireMealGifts(prisma, now = new Date()) {
  const lapsed = await prisma.mealGift.findMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const gift of lapsed) {
    // eslint-disable-next-line no-await-in-loop -- one transaction per gift: the claim and the credit commit together
    const outcome = await prisma.$transaction(async (tx) => {
      const claim = await tx.mealGift.updateMany({
        where: { id: gift.id, status: "PENDING", expiresAt: { lte: now } },
        data: { status: "EXPIRED", expiredAt: now },
      });
      if (claim.count !== 1) return null;
      // Re-read inside the transaction: paidAt is what decides the return.
      const fresh = await tx.mealGift.findUnique({ where: { id: gift.id } });
      const refunded = Boolean(fresh?.paidAt) && fresh.amountCents > 0;
      if (refunded) {
        await grantCreditInTx(tx, {
          userId: fresh.giverId,
          source: "MEAL_GIFT",
          eventType: "REFUND_RESTORE",
          amountCents: fresh.amountCents,
          note: MEAL_GIFT_RETURN_NOTE,
          now,
        });
      }
      return { id: gift.id, giverId: fresh.giverId, amountCents: fresh.amountCents, refunded };
    });
    if (outcome) results.push(outcome);
  }
  return results;
}
