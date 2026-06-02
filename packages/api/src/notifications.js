/**
 * Notification Service
 * Handles SMS (Twilio) notifications for orders
 * Updated: 2026-06-02 - Removed Resend email, switched Twilio to API Keys
 */

import twilio from "twilio";
import QRCode from "qrcode";

/**
 * Generate a QR code as a base64 data URL
 * Uses high error correction to allow for logo overlay
 */
async function generateQRCodeDataURL(data, size = 200) {
  try {
    const dataUrl = await QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "H", // High error correction for logo overlay
      color: {
        dark: "#222222",
        light: "#FFFFFF",
      },
    });
    return dataUrl;
  } catch (error) {
    console.error("[QR] Failed to generate QR code:", error);
    return null;
  }
}

// Initialize Twilio with API Keys (more secure than Auth Tokens)
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET
    ? twilio(process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
      })
    : null;

const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

/**
 * Check if user/guest has opted in to SMS notifications
 * @param {object} user - User object (may have smsOptIn field)
 * @param {object} guest - Guest object (may have smsOptIn field)
 * @returns {boolean} - Whether SMS is allowed
 */
function canSendSMS(user, guest) {
  // Check user opt-in first
  if (user?.smsOptIn === true) return true;
  // Check guest opt-in
  if (guest?.smsOptIn === true) return true;
  // Default to false if no opt-in found
  return false;
}

/**
 * Send an SMS notification
 */
export async function sendSMS({ to, body }) {
  if (!twilioClient || !TWILIO_PHONE) {
    console.log("[SMS] Twilio not configured, skipping SMS");
    return { success: false, reason: "not_configured" };
  }

  // Normalize phone number (ensure it has country code)
  const normalizedPhone = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;

  try {
    const message = await twilioClient.messages.create({
      body,
      from: TWILIO_PHONE,
      to: normalizedPhone,
    });

    console.log(`[SMS] Sent to ${normalizedPhone}: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error("[SMS] Failed to send:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send order confirmation notification (SMS only)
 */
export async function sendOrderConfirmation(order, user) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);
  const totalFormatted = `$${(order.totalCents / 100).toFixed(2)}`;

  // Email notification disabled - Resend removed
  results.email = { success: false, reason: "email_disabled" };

  // SMS notification - only if user/guest has opted in
  const phone = user?.phone || order.guest?.phone;
  if (phone && canSendSMS(user, order.guest)) {
    results.sms = await sendSMS({
      to: phone,
      body: `Oh! Order #${orderNumber} confirmed! Total: ${totalFormatted}. ${order.orderQrCode ? `Check in at kiosk with code: ${order.orderQrCode.slice(-8)}` : 'Show this text at check-in.'}`,
    });
  } else if (phone && !canSendSMS(user, order.guest)) {
    console.log(`[SMS] Skipping order confirmation - no SMS opt-in for phone ${phone.slice(-4)}`);
    results.sms = { success: false, reason: "not_opted_in" };
  }

  return results;
}

/**
 * Send pod ready notification (SMS only)
 */
export async function sendPodReadyNotification(order, user, podNumber) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);

  // Email notification disabled - Resend removed
  results.email = { success: false, reason: "email_disabled" };

  // SMS notification - only if user has opted in
  if (user?.phone && canSendSMS(user, null)) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `Oh! Your Pod #${podNumber} is ready! Order #${orderNumber}. Head to your pod to enjoy your meal!`,
    });
  } else if (user?.phone && !canSendSMS(user, null)) {
    console.log(`[SMS] Skipping pod ready - no SMS opt-in for phone ${user.phone.slice(-4)}`);
    results.sms = { success: false, reason: "not_opted_in" };
  }

  return results;
}

/**
 * Send queue update notification (position changed or estimated wait)
 */
export async function sendQueueUpdateNotification(order, user, queuePosition, estimatedMinutes) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);

  // Only send SMS for queue updates (email would be too spammy) - check opt-in
  if (user?.phone && canSendSMS(user, null)) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `Oh! Order #${orderNumber}: You're #${queuePosition} in line. Estimated wait: ~${estimatedMinutes} min. We'll notify you when your pod is ready!`,
    });
  } else if (user?.phone && !canSendSMS(user, null)) {
    console.log(`[SMS] Skipping queue update - no SMS opt-in for phone ${user.phone.slice(-4)}`);
    results.sms = { success: false, reason: "not_opted_in" };
  }

  return results;
}

/**
 * Send order ready for pickup notification (for non-pod orders) - SMS only
 */
export async function sendOrderReadyNotification(order, user) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);

  // Email notification disabled - Resend removed
  results.email = { success: false, reason: "email_disabled" };

  // SMS notification - check opt-in
  if (user?.phone && canSendSMS(user, null)) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `Oh! Your order #${orderNumber} is ready! Head over to pick it up. Enjoy!`,
    });
  } else if (user?.phone && !canSendSMS(user, null)) {
    console.log(`[SMS] Skipping order ready - no SMS opt-in for phone ${user.phone.slice(-4)}`);
    results.sms = { success: false, reason: "not_opted_in" };
  }

  return results;
}

/**
 * Send admin notification for new user creation
 * Note: Admin SMS doesn't require user opt-in - it's internal notification
 */
export async function sendAdminNewUserNotification(user) {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) {
    console.log("[ADMIN SMS] ADMIN_PHONE_NUMBER not configured, skipping");
    return { success: false, reason: "not_configured" };
  }

  const name = user.name || "Not provided";
  const contact = user.email || user.phone || "Unknown";
  const referred = user.referredById ? "Yes" : "No";

  return sendSMS({
    to: adminPhone,
    body: `[Oh! Admin] New user created\nName: ${name}\nContact: ${contact}\nReferred: ${referred}`,
  });
}

/**
 * Check if notification providers are configured
 */
export function getNotificationStatus() {
  return {
    email: {
      configured: false,
      provider: "Disabled",
    },
    sms: {
      configured: !!(twilioClient && TWILIO_PHONE),
      provider: "Twilio",
    },
  };
}

/**
 * Send shop order confirmation - DISABLED (email removed)
 * Returns a stub response for backwards compatibility
 */
export async function sendShopOrderConfirmation(order) {
  console.log("[EMAIL] Shop order confirmation disabled - Resend removed");
  return { success: false, reason: "email_disabled" };
}

/**
 * Send gift card email - DISABLED (email removed)
 * Returns a stub response for backwards compatibility
 */
export async function sendGiftCardEmail(giftCard) {
  console.log("[EMAIL] Gift card email disabled - Resend removed");
  return { success: false, reason: "email_disabled" };
}
