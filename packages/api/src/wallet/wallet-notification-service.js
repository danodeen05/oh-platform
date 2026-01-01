/**
 * Wallet Pass Notification Service
 *
 * Handles all six notification types for Apple Wallet:
 * 1. Near Restaurant - Location-based notification with pod availability
 * 2. Streak at Risk - Alert when order streak might break
 * 3. Tier Progress - Notify when close to tier upgrade
 * 4. Challenge Deadline - Remind about expiring challenges
 * 5. Available Credits - Reminder about credit balance
 * 6. Order Completed - Confirmation when order is paid
 *
 * Each notification type has a cooldown period to prevent spamming.
 */

import { PrismaClient } from '@oh/db';
import { notifyUserPassUpdate } from './apns-service.js';
import { markPassUpdated } from './wallet-web-service.js';

const prisma = new PrismaClient();

// Cooldown periods (in hours) between same notification types
const NOTIFICATION_COOLDOWNS = {
  NEAR_RESTAURANT: 24, // Once per day per location
  STREAK_AT_RISK: 12, // Twice per day max
  TIER_PROGRESS: 48, // Every 2 days
  CHALLENGE_DEADLINE: 24, // Once per day
  AVAILABLE_CREDITS: 168, // Once per week
  ORDER_COMPLETED: 0, // No cooldown - each order gets a notification
};

// Tier requirements for progression
const TIER_REQUIREMENTS = {
  CHOPSTICK: { nextTier: 'NOODLE_MASTER', ordersNeeded: 10, referralsNeeded: 5 },
  NOODLE_MASTER: { nextTier: 'BEEF_BOSS', ordersNeeded: 25, referralsNeeded: 10 },
  BEEF_BOSS: null, // Max tier
};

/**
 * Check if a notification can be sent (cooldown check)
 *
 * @param {string} userId - User ID
 * @param {string} notificationType - Type of notification
 * @param {string} locationId - Location ID (for location-specific notifications)
 * @returns {Promise<boolean>}
 */
async function canSendNotification(userId, notificationType, locationId = null) {
  const cooldownHours = NOTIFICATION_COOLDOWNS[notificationType];
  const cooldownStart = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

  const where = {
    userId,
    notificationType,
    sentAt: { gte: cooldownStart },
  };

  // For location-specific notifications, check per location
  if (locationId) {
    where.locationId = locationId;
  }

  const recentNotification = await prisma.walletNotificationLog.findFirst({
    where,
  });

  return !recentNotification;
}

/**
 * Log a sent notification
 *
 * @param {string} userId - User ID
 * @param {string} notificationType - Type of notification
 * @param {string} messageContent - Message sent
 * @param {string} locationId - Location ID (optional)
 */
async function logNotification(userId, notificationType, messageContent, locationId = null) {
  await prisma.walletNotificationLog.create({
    data: {
      userId,
      notificationType,
      messageContent,
      locationId,
    },
  });
}

/**
 * Send notification and trigger pass update
 *
 * @param {string} userId - User ID
 * @param {Object} message - { header, body }
 * @returns {Promise<Object>}
 */
async function sendWalletNotification(userId, message) {
  // Mark pass as updated so Apple knows to fetch a new version
  await markPassUpdated(userId);

  // Send push to trigger the update
  const result = await notifyUserPassUpdate(userId);

  return result;
}

// ===================
// NOTIFICATION TYPE 1: Near Restaurant
// ===================

/**
 * Check and send near restaurant notification
 * Shows pod availability or wait time
 *
 * @param {string} userId - User ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>}
 */
export async function checkAndSendNearRestaurantNotification(userId, locationId) {
  if (!(await canSendNotification(userId, 'NEAR_RESTAURANT', locationId))) {
    return { sent: false, reason: 'cooldown' };
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: {
      stats: true,
      seats: {
        where: { status: 'AVAILABLE' },
      },
    },
  });

  if (!location) {
    return { sent: false, reason: 'location_not_found' };
  }

  // Check if location is open
  if (location.isClosed) {
    return { sent: false, reason: 'location_closed' };
  }

  // Calculate availability
  const availablePods = location.seats.length;

  // Get queue count
  const queuedOrders = await prisma.waitQueue.count({
    where: {
      locationId,
      status: 'WAITING',
    },
  });

  let message;

  if (availablePods > 0) {
    // Pods available
    message = {
      header: 'Pods Available!',
      body: `${availablePods} pod${availablePods > 1 ? 's are' : ' is'} currently open at ${location.name}`,
    };
  } else {
    // All pods occupied, calculate wait time (5 min per order)
    const waitMinutes = queuedOrders * 5;
    message = {
      header: `Welcome to ${location.name}!`,
      body: `All pods busy. Estimated wait: ~${waitMinutes} min`,
    };
  }

  await sendWalletNotification(userId, message);
  await logNotification(userId, 'NEAR_RESTAURANT', message.body, locationId);

  return { sent: true, message };
}

// ===================
// NOTIFICATION TYPE 2: Streak at Risk
// ===================

/**
 * Check and send streak at risk notification
 * Alerts when user's streak will break if they don't order today
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
export async function checkAndSendStreakAtRiskNotification(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentStreak: true,
      lastOrderDate: true,
    },
  });

  if (!user || user.currentStreak === 0) {
    return { sent: false, reason: 'no_streak' };
  }

  // Check if streak will break tomorrow (no order today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastOrder = user.lastOrderDate ? new Date(user.lastOrderDate) : null;
  if (lastOrder) {
    lastOrder.setHours(0, 0, 0, 0);
  }

  // If last order was today, streak is safe
  if (lastOrder && lastOrder.getTime() === today.getTime()) {
    return { sent: false, reason: 'ordered_today' };
  }

  // If last order was yesterday, streak at risk
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastOrder && lastOrder.getTime() === yesterday.getTime()) {
    if (!(await canSendNotification(userId, 'STREAK_AT_RISK'))) {
      return { sent: false, reason: 'cooldown' };
    }

    const message = {
      header: 'Streak Alert!',
      body: `Order today to keep your ${user.currentStreak}-day streak!`,
    };

    await sendWalletNotification(userId, message);
    await logNotification(userId, 'STREAK_AT_RISK', message.body);

    return { sent: true, message };
  }

  return { sent: false, reason: 'streak_already_broken_or_safe' };
}

// ===================
// NOTIFICATION TYPE 3: Tier Progress
// ===================

/**
 * Check and send tier progress notification
 * Notifies when user is 1-2 orders away from tier upgrade
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
export async function checkAndSendTierProgressNotification(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      membershipTier: true,
      tierProgressOrders: true,
      tierProgressReferrals: true,
    },
  });

  if (!user) {
    return { sent: false, reason: 'user_not_found' };
  }

  const requirements = TIER_REQUIREMENTS[user.membershipTier];
  if (!requirements) {
    return { sent: false, reason: 'max_tier' };
  }

  const ordersRemaining = requirements.ordersNeeded - user.tierProgressOrders;
  const referralsRemaining = requirements.referralsNeeded - user.tierProgressReferrals;

  // Only notify if close (1-2 orders away)
  const closeToUpgrade = ordersRemaining <= 2 && ordersRemaining > 0;

  if (!closeToUpgrade) {
    return { sent: false, reason: 'not_close_enough' };
  }

  if (!(await canSendNotification(userId, 'TIER_PROGRESS'))) {
    return { sent: false, reason: 'cooldown' };
  }

  // Format tier name nicely
  const nextTierName = requirements.nextTier.replace('_', ' ');

  let message;
  if (referralsRemaining <= 0) {
    // Referrals met, just orders remaining
    message = {
      header: 'Almost There!',
      body: `${ordersRemaining} more order${ordersRemaining > 1 ? 's' : ''} to reach ${nextTierName}!`,
    };
  } else {
    // Both orders and referrals needed
    message = {
      header: 'Tier Progress',
      body: `${ordersRemaining} order${ordersRemaining > 1 ? 's' : ''} + ${referralsRemaining} referral${referralsRemaining > 1 ? 's' : ''} to ${nextTierName}!`,
    };
  }

  await sendWalletNotification(userId, message);
  await logNotification(userId, 'TIER_PROGRESS', message.body);

  return { sent: true, message };
}

// ===================
// NOTIFICATION TYPE 4: Challenge Deadline
// ===================

/**
 * Check and send challenge deadline notifications for all users
 * Alerts about challenges ending in the next 48 hours
 *
 * @returns {Promise<Array>} - Results for each user notified
 */
export async function checkAndSendChallengeDeadlineNotifications() {
  // Find challenges ending in next 48 hours that users haven't completed
  const deadlineThreshold = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const now = new Date();

  const urgentChallenges = await prisma.userChallenge.findMany({
    where: {
      completedAt: null,
      challenge: {
        endsAt: {
          gte: now,
          lte: deadlineThreshold,
        },
        isActive: true,
      },
    },
    include: {
      user: true,
      challenge: true,
    },
  });

  const results = [];

  for (const uc of urgentChallenges) {
    if (!(await canSendNotification(uc.userId, 'CHALLENGE_DEADLINE'))) {
      results.push({ userId: uc.userId, sent: false, reason: 'cooldown' });
      continue;
    }

    // Check if user has wallet registered
    const hasWallet = await prisma.walletPassRegistration.findFirst({
      where: { userId: uc.userId },
    });

    if (!hasWallet) {
      results.push({ userId: uc.userId, sent: false, reason: 'no_wallet' });
      continue;
    }

    const deadline = new Date(uc.challenge.endsAt);
    const hoursUntil = Math.ceil((deadline.getTime() - now.getTime()) / (60 * 60 * 1000));

    let deadlineText;
    if (hoursUntil <= 24) {
      deadlineText = 'today';
    } else if (hoursUntil <= 48) {
      deadlineText = 'tomorrow';
    } else {
      const daysUntil = Math.ceil(hoursUntil / 24);
      deadlineText = `in ${daysUntil} days`;
    }

    const message = {
      header: 'Challenge Ending Soon!',
      body: `Complete "${uc.challenge.name}" ${deadlineText}!`,
    };

    await sendWalletNotification(uc.userId, message);
    await logNotification(uc.userId, 'CHALLENGE_DEADLINE', message.body);

    results.push({ userId: uc.userId, sent: true, message });
  }

  return results;
}

// ===================
// NOTIFICATION TYPE 5: Available Credits
// ===================

/**
 * Check and send credits reminder notification
 * Reminds users about their available credit balance
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
export async function checkAndSendCreditsReminder(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsCents: true },
  });

  if (!user || user.creditsCents < 100) {
    // Minimum $1.00 to notify
    return { sent: false, reason: 'insufficient_credits' };
  }

  if (!(await canSendNotification(userId, 'AVAILABLE_CREDITS'))) {
    return { sent: false, reason: 'cooldown' };
  }

  const creditsFormatted = `$${(user.creditsCents / 100).toFixed(2)}`;

  const message = {
    header: 'Credits Available!',
    body: `You have ${creditsFormatted} to use on your next order!`,
  };

  await sendWalletNotification(userId, message);
  await logNotification(userId, 'AVAILABLE_CREDITS', message.body);

  return { sent: true, message };
}

// ===================
// NOTIFICATION TYPE 6: Order Completed
// ===================

/**
 * Send order completed notification
 * Confirms that an order was placed on their account
 *
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>}
 */
export async function sendOrderCompletedNotification(userId, orderId) {
  // Get order details
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      totalCents: true,
      location: {
        select: { name: true },
      },
    },
  });

  if (!order) {
    return { sent: false, reason: 'order_not_found' };
  }

  // Check if user has wallet registered
  const hasWallet = await prisma.walletPassRegistration.findFirst({
    where: { userId },
  });

  if (!hasWallet) {
    return { sent: false, reason: 'no_wallet' };
  }

  const totalFormatted = `$${(order.totalCents / 100).toFixed(2)}`;
  const locationName = order.location?.name || 'Oh!';

  const message = {
    header: 'Order Confirmed!',
    body: `Your ${totalFormatted} order at ${locationName} is confirmed.`,
  };

  await sendWalletNotification(userId, message);
  await logNotification(userId, 'ORDER_COMPLETED', message.body);

  return { sent: true, message, total: totalFormatted };
}

// ===================
// BATCH NOTIFICATION FUNCTIONS
// ===================

/**
 * Send streak at risk notifications to all eligible users
 * Should be called daily (e.g., at 5pm local time)
 *
 * @returns {Promise<Object>}
 */
export async function sendBatchStreakAtRiskNotifications() {
  // Find all users with active streaks who have wallet registered
  const usersWithStreaks = await prisma.user.findMany({
    where: {
      currentStreak: { gt: 0 },
      walletRegistrations: { some: {} },
    },
    select: { id: true },
  });

  const results = [];
  for (const user of usersWithStreaks) {
    const result = await checkAndSendStreakAtRiskNotification(user.id);
    results.push({ userId: user.id, ...result });
  }

  const sent = results.filter((r) => r.sent).length;
  const skipped = results.filter((r) => !r.sent).length;

  return { processed: results.length, sent, skipped, results };
}

/**
 * Send credits reminder to all eligible users
 * Should be called weekly
 *
 * @returns {Promise<Object>}
 */
export async function sendBatchCreditsReminder() {
  const usersWithCredits = await prisma.user.findMany({
    where: {
      creditsCents: { gte: 100 }, // At least $1
      walletRegistrations: { some: {} },
    },
    select: { id: true },
  });

  const results = [];
  for (const user of usersWithCredits) {
    const result = await checkAndSendCreditsReminder(user.id);
    results.push({ userId: user.id, ...result });
  }

  const sent = results.filter((r) => r.sent).length;
  const skipped = results.filter((r) => !r.sent).length;

  return { processed: results.length, sent, skipped, results };
}

/**
 * Send tier progress notifications to all eligible users
 * Should be called after each order completion
 *
 * @returns {Promise<Object>}
 */
export async function sendBatchTierProgressNotifications() {
  // Find users who are close to tier upgrade and have wallet
  const eligibleUsers = await prisma.user.findMany({
    where: {
      membershipTier: { in: ['CHOPSTICK', 'NOODLE_MASTER'] },
      walletRegistrations: { some: {} },
    },
    select: {
      id: true,
      membershipTier: true,
      tierProgressOrders: true,
    },
  });

  // Filter to users who are 1-2 orders away
  const closeUsers = eligibleUsers.filter((user) => {
    const req = TIER_REQUIREMENTS[user.membershipTier];
    if (!req) return false;
    const ordersRemaining = req.ordersNeeded - user.tierProgressOrders;
    return ordersRemaining > 0 && ordersRemaining <= 2;
  });

  const results = [];
  for (const user of closeUsers) {
    const result = await checkAndSendTierProgressNotification(user.id);
    results.push({ userId: user.id, ...result });
  }

  const sent = results.filter((r) => r.sent).length;
  const skipped = results.filter((r) => !r.sent).length;

  return { processed: results.length, sent, skipped, results };
}
