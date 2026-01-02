/**
 * Credit Service
 *
 * Centralized service for managing user credits.
 * Automatically triggers Apple Wallet pass refresh when credits change.
 */

import { PrismaClient } from '@oh/db';
import { notifyUserPassUpdate } from '../wallet/apns-service.js';
import { markPassUpdated } from '../wallet/wallet-web-service.js';

const prisma = new PrismaClient();

/**
 * Add credits to a user's account and trigger wallet pass refresh
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {number} params.amountCents - Amount in cents (positive for credit, negative for debit)
 * @param {string} params.type - Credit event type (CASHBACK, REFERRAL_BONUS, etc.)
 * @param {string} [params.orderId] - Associated order ID
 * @param {string} [params.description] - Description of the credit event
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {Promise<Object>} - { success, newBalance, creditEvent }
 */
export async function updateUserCredits({
  userId,
  amountCents,
  type,
  orderId = null,
  description = null,
  metadata = null,
}) {
  // Update user credits and create credit event in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update user's credit balance
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        creditsCents: { increment: amountCents },
      },
    });

    // Create credit event for history
    const creditEvent = await tx.creditEvent.create({
      data: {
        userId,
        type,
        amountCents,
        orderId,
        description,
        metadata,
      },
    });

    return { user, creditEvent };
  });

  // Trigger wallet pass refresh (non-blocking)
  refreshUserWalletPass(userId).catch((err) => {
    console.error(`Failed to refresh wallet pass for user ${userId}:`, err.message);
  });

  return {
    success: true,
    newBalance: result.user.creditsCents,
    creditEvent: result.creditEvent,
  };
}

/**
 * Apply credits to an order (debit from user balance)
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {number} params.amountCents - Amount to apply (positive number, will be debited)
 * @param {string} params.orderId - Order ID
 * @returns {Promise<Object>} - { success, newBalance, amountApplied }
 */
export async function applyCreditsToOrder({ userId, amountCents, orderId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsCents: true },
  });

  if (!user) {
    return { success: false, error: 'user_not_found' };
  }

  // Can only apply up to available balance
  const amountToApply = Math.min(amountCents, user.creditsCents);

  if (amountToApply <= 0) {
    return { success: false, error: 'no_credits_available', newBalance: user.creditsCents };
  }

  const result = await updateUserCredits({
    userId,
    amountCents: -amountToApply, // Negative to debit
    type: 'CREDIT_APPLIED',
    orderId,
    description: `Applied to order ${orderId}`,
  });

  return {
    success: true,
    newBalance: result.newBalance,
    amountApplied: amountToApply,
  };
}

/**
 * Refresh a user's wallet pass with current data
 * Marks the pass as updated and sends push notification to trigger refresh
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { success, pushResult }
 */
export async function refreshUserWalletPass(userId) {
  // Check if user has a wallet registration
  const registration = await prisma.walletPassRegistration.findFirst({
    where: { userId },
  });

  if (!registration) {
    return { success: false, reason: 'no_wallet_registered' };
  }

  // Mark pass as updated (so Apple knows to fetch new version)
  await markPassUpdated(userId);

  // Send push notification to trigger device to fetch updated pass
  const pushResult = await notifyUserPassUpdate(userId);

  return { success: true, pushResult };
}

/**
 * Refresh wallet passes for all users with registered wallets
 * Useful for batch updates (e.g., pod availability changes)
 *
 * @param {string[]} [userIds] - Specific user IDs, or all users with wallets if not provided
 * @returns {Promise<Object>} - { totalUsers, successCount, failCount }
 */
export async function refreshAllWalletPasses(userIds = null) {
  let users;

  if (userIds) {
    users = userIds;
  } else {
    // Get all users with wallet registrations
    const registrations = await prisma.walletPassRegistration.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    users = registrations.map((r) => r.userId);
  }

  let successCount = 0;
  let failCount = 0;

  for (const userId of users) {
    try {
      const result = await refreshUserWalletPass(userId);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`Failed to refresh pass for ${userId}:`, err.message);
      failCount++;
    }
  }

  return { totalUsers: users.length, successCount, failCount };
}
