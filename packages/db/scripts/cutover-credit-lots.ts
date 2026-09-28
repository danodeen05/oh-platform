/**
 * Task G3 cutover: moves every remaining piece of member credit onto the
 * CreditLot ledger.
 *
 *  1. `convertLegacyBalances` (the API's own helper): a user with a positive
 *     cached `creditsCents` and no lots gets one LEGACY lot backing it.
 *     Release 1 already ran this in prod (1 user); a re-run skips anyone
 *     who has a lot. It runs FIRST, because step 2 gives users lots, and a
 *     user with a legacy balance and a pending referral must keep both.
 *  2. Every undisbursed `PendingCredit` (the retired 1st/16th referral
 *     payout queue; nothing writes it since Task A5) is paid out with
 *     `grantCreditInTx(source REFERRAL)` and marked disbursed, in one
 *     transaction per row. The claim is a conditional
 *     `updateMany({ disbursedAt: null })`, so two runs (or a re-run after a
 *     crash) never pay a row twice. A row with a non-positive amount is
 *     counted and left undisbursed for a human to look at. These credits
 *     were earned under the old rules, so the new 10-per-30-days referral
 *     cap is not applied to them.
 *  3. Read-only drift check: users whose cached `creditsCents` differs from
 *     the sum of their lots' `remainingCents`. It changes nothing; a
 *     non-zero count is for the operator to review.
 *
 * `--dry-run` computes the same counts and writes nothing.
 * Prints COUNTS ONLY (no user ids, no amounts per user).
 *
 * Usage (from packages/db):
 *   pnpm exec tsx scripts/cutover-credit-lots.ts --dry-run
 *   pnpm exec tsx scripts/cutover-credit-lots.ts
 * Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { PrismaClient } from "@prisma/client";
import { convertLegacyBalances, grantCreditInTx } from "../../api/src/membership/credits.js";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";

export interface CreditCutoverCounts {
  legacyUsers: number;
  legacyCents: number;
  pendingFound: number;
  pendingPaid: number;
  pendingPaidCents: number;
  pendingInvalid: number;
  driftUsers: number;
  driftCents: number;
}

export const PENDING_NOTE = "Referral credit (pending payout, paid at cutover)";

/** Users a real `convertLegacyBalances` would convert (positive balance, no lot at all). */
async function legacyCandidates(prisma: any): Promise<{ id: string; creditsCents: number }[]> {
  const users = await prisma.user.findMany({ where: { creditsCents: { gt: 0 } }, select: { id: true, creditsCents: true } });
  const out: { id: string; creditsCents: number }[] = [];
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop -- small table, one query per candidate keeps it stub-friendly
    const lot = await prisma.creditLot.findFirst({ where: { userId: user.id }, select: { id: true } });
    if (!lot) out.push({ id: user.id, creditsCents: user.creditsCents });
  }
  return out;
}

/** Users whose cached balance differs from the sum of their lots' remaining cents (read only). */
async function drift(prisma: any): Promise<{ users: number; cents: number }> {
  const lots = await prisma.creditLot.findMany({ select: { userId: true, remainingCents: true } });
  const byUser = new Map<string, number>();
  for (const lot of lots) byUser.set(lot.userId, (byUser.get(lot.userId) ?? 0) + lot.remainingCents);
  const users = await prisma.user.findMany({
    where: { OR: [{ creditsCents: { gt: 0 } }, { id: { in: [...byUser.keys()] } }] },
    select: { id: true, creditsCents: true },
  });
  let count = 0;
  let cents = 0;
  for (const user of users) {
    const diff = (user.creditsCents ?? 0) - (byUser.get(user.id) ?? 0);
    if (diff !== 0) {
      count++;
      cents += Math.abs(diff);
    }
  }
  return { users: count, cents };
}

export async function cutoverCreditLots(prisma: any, { dryRun, now = new Date() }: { dryRun: boolean; now?: Date }): Promise<CreditCutoverCounts> {
  const counts: CreditCutoverCounts = { legacyUsers: 0, legacyCents: 0, pendingFound: 0, pendingPaid: 0, pendingPaidCents: 0, pendingInvalid: 0, driftUsers: 0, driftCents: 0 };

  // 1. Legacy balances.
  const candidates = await legacyCandidates(prisma);
  counts.legacyCents = candidates.reduce((sum, u) => sum + u.creditsCents, 0);
  // legacyUsers is the helper's own count on a real run (the truth if anything raced the pre-count).
  counts.legacyUsers = dryRun ? candidates.length : await convertLegacyBalances(prisma, now);

  // 2. Undisbursed pending credit.
  const pending = await prisma.pendingCredit.findMany({ where: { disbursedAt: null }, orderBy: { createdAt: "asc" } });
  counts.pendingFound = pending.length;
  for (const row of pending) {
    if (!Number.isInteger(row.amountCents) || row.amountCents <= 0) {
      counts.pendingInvalid++;
      continue;
    }
    if (dryRun) {
      counts.pendingPaid++;
      counts.pendingPaidCents += row.amountCents;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- one transaction per row: a failure leaves the rest intact and re-runnable
    const paid = await prisma.$transaction(async (tx: any) => {
      const claim = await tx.pendingCredit.updateMany({ where: { id: row.id, disbursedAt: null }, data: { disbursedAt: now } });
      if (claim.count !== 1) return false; // paid by a concurrent or earlier run
      await grantCreditInTx(tx, { userId: row.userId, source: "REFERRAL", amountCents: row.amountCents, orderId: row.sourceOrderId ?? null, note: PENDING_NOTE, now });
      return true;
    });
    if (paid) {
      counts.pendingPaid++;
      counts.pendingPaidCents += row.amountCents;
    }
  }

  // 3. Drift (read only).
  const d = await drift(prisma);
  counts.driftUsers = d.users;
  counts.driftCents = d.cents;
  return counts;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const target = requireSafeTarget("cutover-credit-lots");
  console.log(targetBanner("cutover-credit-lots", target, dryRun));
  const prisma = new PrismaClient();
  try {
    const counts = await cutoverCreditLots(prisma, { dryRun, now: new Date() });
    console.log(`[cutover-credit-lots]${dryRun ? " [dry run]" : ""} ${JSON.stringify(counts)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error(`[cutover-credit-lots] failed: ${err?.message ?? err}`);
    process.exit(1);
  });
}
