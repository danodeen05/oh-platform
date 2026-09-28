/**
 * Challenge rewards through the credit ledger (Task D9 fix round 2).
 *
 * A challenge reward is Oh! store credit like any other: a CreditLot with
 * source CHALLENGE (expiring after PROGRAM.creditExpiryDays), granted with
 * grantCreditInTx, which also keeps the cached User.creditsCents and logs the
 * CHALLENGE_REWARD event. It used to be a bare `creditsCents` increment (no
 * lot, never expiring, invisible to checkout's lot-based spending).
 *
 * The grant is idempotent per enrollment: inside one transaction, a
 * conditional updateMany flips UserChallenge.rewardClaimed false -> true, and
 * only the call that wins it grants. Completion and the grant happen in the
 * same transaction, so a challenge is never marked complete without its
 * reward, nor paid twice.
 */
import { grantCreditInTx } from "./credits.js";

function rewardNote(challenge) {
  return `Challenge completed: ${challenge?.name || challenge?.slug || "challenge"}`;
}

async function grantIfAny(tx, { userId, challenge, now }) {
  const amountCents = Number(challenge?.rewardCents) || 0;
  if (amountCents <= 0) return 0;
  await grantCreditInTx(tx, { userId, source: "CHALLENGE", amountCents, note: rewardNote(challenge), now });
  return amountCents;
}

/**
 * Marks an enrollment complete (with its final progress) and grants its
 * reward, once. Returns { completed, rewardCents }: completed is false when
 * another call already completed it.
 */
export async function completeUserChallenge(prisma, { userChallenge, progress, now = new Date() }) {
  return prisma.$transaction(async (tx) => {
    const won = await tx.userChallenge.updateMany({
      where: { id: userChallenge.id, completedAt: null, rewardClaimed: false },
      data: { progress, completedAt: now, rewardClaimed: true, updatedAt: now },
    });
    if (won.count !== 1) return { completed: false, rewardCents: 0 };
    const rewardCents = await grantIfAny(tx, { userId: userChallenge.userId, challenge: userChallenge.challenge, now });
    return { completed: true, rewardCents };
  });
}

/**
 * The claim route for enrollments completed before rewards were automatic:
 * completed, not yet claimed. Grants once. Returns { claimed, rewardCents }.
 */
export async function claimChallengeReward(prisma, { userChallenge, now = new Date() }) {
  return prisma.$transaction(async (tx) => {
    const won = await tx.userChallenge.updateMany({
      where: { id: userChallenge.id, completedAt: { not: null }, rewardClaimed: false },
      data: { rewardClaimed: true, updatedAt: now },
    });
    if (won.count !== 1) return { claimed: false, rewardCents: 0 };
    const rewardCents = await grantIfAny(tx, { userId: userChallenge.userId, challenge: userChallenge.challenge, now });
    return { claimed: true, rewardCents };
  });
}
