/**
 * Agent Notification Service
 *
 * Extends the existing wallet notification infrastructure to support
 * notifications for autonomous agent events:
 * - Approval needed (high priority)
 * - Question asked (medium priority)
 * - Agent completed (low priority)
 * - Agent error (high priority)
 *
 * Uses existing APNs service for iOS push notifications
 * Falls back to SMS via Twilio for urgent notifications
 */

import { PrismaClient } from '@oh/db';
import { sendPassUpdatePush, isAPNsConfigured } from './apns-service.js';
import { sendSMS } from '../notifications.js';

const prisma = new PrismaClient();

/**
 * Notification types and their priorities
 */
export const NOTIFICATION_TYPES = {
  APPROVAL_NEEDED: {
    type: 'approval_needed',
    priority: 'high',
    useSMS: true,
    title: 'Agent Approval Needed',
  },
  QUESTION_ASKED: {
    type: 'question_asked',
    priority: 'medium',
    useSMS: false,
    title: 'Agent Question',
  },
  AGENT_COMPLETED: {
    type: 'agent_completed',
    priority: 'low',
    useSMS: false,
    title: 'Agent Complete',
  },
  AGENT_ERROR: {
    type: 'agent_error',
    priority: 'high',
    useSMS: true,
    title: 'Agent Error',
  },
};

/**
 * Cooldown periods (in minutes) between same notification types
 */
const NOTIFICATION_COOLDOWNS = {
  approval_needed: 0,    // No cooldown - always send
  question_asked: 5,     // 5 minute cooldown
  agent_completed: 10,   // 10 minute cooldown
  agent_error: 0,        // No cooldown - always send
};

/**
 * Check if we can send this notification (cooldown check)
 */
async function canSendNotification(userId, notificationType) {
  const cooldownMinutes = NOTIFICATION_COOLDOWNS[notificationType];
  if (cooldownMinutes === 0) return true;

  const cooldownStart = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const recent = await prisma.agentNotificationLog.findFirst({
    where: {
      userId,
      type: notificationType,
      sentAt: { gte: cooldownStart },
    },
  });

  return !recent;
}

/**
 * Log a sent notification
 */
async function logNotification(userId, type, message, method, success) {
  try {
    await prisma.agentNotificationLog.create({
      data: {
        userId,
        type,
        message,
        method,
        success,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.warn('[AgentNotification] Could not log notification:', error.message);
  }
}

/**
 * Get user's notification preferences
 */
async function getUserNotificationPrefs(userId) {
  try {
    // Check for agent notification device registrations
    const devices = await prisma.agentNotificationDevice.findMany({
      where: { userId, enabled: true },
    });

    // Check for wallet pass registrations (reuse for APNs)
    const walletDevices = await prisma.walletPassRegistration.findMany({
      where: { userId },
    });

    // Get user's phone for SMS fallback
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, smsOptIn: true },
    });

    return {
      devices,
      walletDevices,
      phone: user?.phone,
      smsEnabled: user?.smsOptIn,
    };
  } catch (error) {
    console.warn('[AgentNotification] Could not get user prefs:', error.message);
    return { devices: [], walletDevices: [], phone: null, smsEnabled: false };
  }
}

/**
 * Send push notification via APNs
 */
async function sendPushNotification(pushTokens, title, body) {
  if (!isAPNsConfigured()) {
    console.warn('[AgentNotification] APNs not configured');
    return { success: false, error: 'apns_not_configured' };
  }

  const results = await Promise.allSettled(
    pushTokens.map(token => sendPassUpdatePush(token))
  );

  const successCount = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length;

  return {
    success: successCount > 0,
    sent: successCount,
    failed: results.length - successCount,
  };
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(phone, message) {
  try {
    const result = await sendSMS(phone, message);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('[AgentNotification] SMS failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Format notification message based on type and data
 */
function formatNotification(type, data) {
  const config = Object.values(NOTIFICATION_TYPES).find(t => t.type === type);
  const title = config?.title || 'Agent Notification';

  switch (type) {
    case 'approval_needed':
      return {
        title,
        body: `Action required: ${data.reason || 'Review pending changes'}`,
        sms: `[Oh! Agent] Approval needed for ${data.phase || 'task'}. Open Claude app to review.`,
      };

    case 'question_asked':
      return {
        title,
        body: data.question?.substring(0, 100) || 'Agent has a question',
        sms: `[Oh! Agent] Question: ${data.question?.substring(0, 100)}`,
      };

    case 'agent_completed':
      return {
        title,
        body: `Task completed: ${data.idea?.substring(0, 50) || 'Agent finished'}`,
        sms: null, // Don't SMS for completions
      };

    case 'agent_error':
      return {
        title,
        body: `Error: ${data.error?.substring(0, 100) || 'Agent encountered an error'}`,
        sms: `[Oh! Agent] Error in ${data.phase || 'task'}. Check dashboard for details.`,
      };

    default:
      return {
        title: 'Agent Update',
        body: 'Your agent has an update',
        sms: null,
      };
  }
}

/**
 * Send agent notification
 *
 * Main entry point for sending notifications about agent events.
 *
 * @param {string} userId - User ID to notify
 * @param {string} type - Notification type (approval_needed, question_asked, etc.)
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} - Result { success, methods }
 */
export async function sendAgentNotification(userId, type, data) {
  console.log(`[AgentNotification] Sending ${type} to user ${userId}`);

  // Check cooldown
  if (!(await canSendNotification(userId, type))) {
    console.log(`[AgentNotification] Skipping due to cooldown: ${type}`);
    return { success: false, reason: 'cooldown' };
  }

  // Get user preferences
  const prefs = await getUserNotificationPrefs(userId);

  // Format message
  const message = formatNotification(type, data);

  // Get notification config
  const config = Object.values(NOTIFICATION_TYPES).find(t => t.type === type);
  const isHighPriority = config?.priority === 'high';

  const results = {
    push: null,
    sms: null,
    success: false,
  };

  // Try push notification first
  const pushTokens = [
    ...prefs.devices.map(d => d.pushToken).filter(Boolean),
    ...prefs.walletDevices.map(d => d.pushToken).filter(Boolean),
  ];

  if (pushTokens.length > 0) {
    results.push = await sendPushNotification(pushTokens, message.title, message.body);
    if (results.push.success) {
      results.success = true;
    }
  }

  // SMS fallback for high priority or if push failed
  if (
    config?.useSMS &&
    message.sms &&
    prefs.phone &&
    prefs.smsEnabled &&
    (isHighPriority || !results.push?.success)
  ) {
    results.sms = await sendSMSNotification(prefs.phone, message.sms);
    if (results.sms.success) {
      results.success = true;
    }
  }

  // Log the notification
  await logNotification(
    userId,
    type,
    message.body,
    results.push?.success ? 'push' : results.sms?.success ? 'sms' : 'none',
    results.success
  );

  console.log(`[AgentNotification] Result: ${JSON.stringify(results)}`);

  return results;
}

/**
 * Register a device for agent notifications
 *
 * @param {string} userId - User ID
 * @param {string} pushToken - APNs or FCM push token
 * @param {string} platform - 'ios' or 'android'
 * @param {string} deviceId - Unique device identifier
 * @returns {Promise<Object>}
 */
export async function registerDevice(userId, pushToken, platform, deviceId) {
  try {
    const device = await prisma.agentNotificationDevice.upsert({
      where: {
        userId_deviceId: { userId, deviceId },
      },
      create: {
        userId,
        deviceId,
        pushToken,
        platform,
        enabled: true,
        registeredAt: new Date(),
      },
      update: {
        pushToken,
        platform,
        enabled: true,
        updatedAt: new Date(),
      },
    });

    console.log(`[AgentNotification] Device registered: ${deviceId} for user ${userId}`);

    return { success: true, device };
  } catch (error) {
    console.error('[AgentNotification] Device registration failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Unregister a device
 */
export async function unregisterDevice(userId, deviceId) {
  try {
    await prisma.agentNotificationDevice.delete({
      where: {
        userId_deviceId: { userId, deviceId },
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[AgentNotification] Device unregistration failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update notification preferences
 */
export async function updatePreferences(userId, preferences) {
  try {
    // Update device settings
    if (preferences.deviceId) {
      await prisma.agentNotificationDevice.update({
        where: {
          userId_deviceId: { userId, deviceId: preferences.deviceId },
        },
        data: {
          enabled: preferences.enabled,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[AgentNotification] Preference update failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send batch notifications (for announcements, etc.)
 */
export async function sendBatchNotification(userIds, type, data) {
  const results = await Promise.allSettled(
    userIds.map(userId => sendAgentNotification(userId, type, data))
  );

  const sent = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length;

  return {
    total: userIds.length,
    sent,
    failed: userIds.length - sent,
  };
}

export default sendAgentNotification;
