/**
 * Notification Service
 * Handles SMS (Twilio) notifications for orders
 * Updated: 2026-06-02 - Removed Resend email, switched Twilio to API Keys
 * Updated: 2026-09-28 (Task F2) - Localized customer texts (packages/api/src/notifications/templates/*),
 * a shared phone normalizer, and tier-up / credit-expiry SMS.
 */

import twilio from "twilio";
import QRCode from "qrcode";
import { normalizePhoneE164 } from "./utils/phone.js";
import { resolveLocale, normalizeLocale } from "./locale.js";
import en from "./notifications/templates/en.js";
import zhTW from "./notifications/templates/zh-TW.js";
import zhCN from "./notifications/templates/zh-CN.js";
import es from "./notifications/templates/es.js";

const TEMPLATES = { en, "zh-TW": zhTW, "zh-CN": zhCN, es };

/** The rendered-string template set for `locale` (any of SUPPORTED_LOCALES; anything else falls back to en). */
function templateFor(locale) {
  return TEMPLATES[normalizeLocale(locale)] || TEMPLATES.en;
}

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
 * off | log | live (default "live" when unset). Anything unrecognised is
 * treated as "log", never "live" - same contract as support/routes.js's
 * notifyMode, duplicated here (rather than imported) to keep notifications.js
 * independent of the support module. Every NEW customer-SMS code path this
 * task adds (tier-up, credit-expiry) honors this so dev/test never actually
 * texts anyone (R3).
 */
export function notifyMode(env = process.env) {
  const raw = env.SUPPORT_NOTIFY;
  if (raw === undefined || raw === null || raw === "") return "live";
  const mode = String(raw).trim().toLowerCase();
  return mode === "off" || mode === "live" ? mode : "log";
}

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
 * Send an SMS notification. `to` is normalized to E.164 (packages/api/src/utils/phone.js)
 * before it ever reaches Twilio; an unparseable number is refused rather than
 * sent to a garbled destination.
 */
export async function sendSMS({ to, body }) {
  if (!twilioClient || !TWILIO_PHONE) {
    console.log("[SMS] Twilio not configured, skipping SMS");
    return { success: false, reason: "not_configured" };
  }

  const normalizedPhone = normalizePhoneE164(to);
  if (!normalizedPhone) {
    console.error(`[SMS] Invalid phone number, skipping SMS (...${String(to || "").slice(-4)})`);
    return { success: false, reason: "invalid_phone" };
  }

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

/** Public link to the live order status page (sent in the guest's texts). */
export function orderStatusUrl(order, locale = "en", env = process.env) {
  if (!order?.orderQrCode) return null;
  const base = (env.WEB_APP_URL || "https://www.ohbeef.com").replace(/\/+$/, "");
  return `${base}/${locale}/order/status?orderQrCode=${encodeURIComponent(order.orderQrCode)}`;
}

/**
 * The order confirmation text: number, total, and the live status link, in
 * the resolved locale (order.user, then order.locale/order.guest.locale if
 * present, then "en" - see locale.js resolveLocale). Signature stays
 * `(order, env)`: the demo status-link test (packages/api/src/demo/__tests__/status-link.test.js,
 * pinned per the Plan status demo global constraint) calls it exactly this way.
 */
export function orderConfirmationText(order, env = process.env) {
  const locale = resolveLocale(order?.user, order, order?.guest);
  const t = templateFor(locale);
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);
  const totalFormatted = `$${(order.totalCents / 100).toFixed(2)}`;
  const link = orderStatusUrl(order, locale, env);
  return link
    ? t.orderConfirmed({ orderNumber, total: totalFormatted, link })
    : t.orderConfirmedNoLink({ orderNumber, total: totalFormatted });
}

export async function sendOrderConfirmation(order, user) {
  const results = { email: null, sms: null };

  // Email notification disabled - Resend removed
  results.email = { success: false, reason: "email_disabled" };

  // SMS notification - only if user/guest has opted in
  const phone = user?.phone || order.guest?.phone;
  if (phone && canSendSMS(user, order.guest)) {
    results.sms = await sendSMS({
      to: phone,
      body: orderConfirmationText({ ...order, user: order.user || user }),
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
    const locale = resolveLocale(user, order, null);
    const t = templateFor(locale);
    // Previously called orderStatusUrl(order) with no locale; the link now
    // matches the text it's sent in (Task F2 binding note).
    const link = orderStatusUrl(order, locale);
    results.sms = await sendSMS({
      to: user.phone,
      body: link ? t.podReady({ podNumber, link }) : t.podReadyNoLink({ podNumber, orderNumber }),
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
    const t = templateFor(resolveLocale(user, order, null));
    results.sms = await sendSMS({
      to: user.phone,
      body: t.queueUpdate({ orderNumber, position: queuePosition, minutes: estimatedMinutes }),
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
    const t = templateFor(resolveLocale(user, order, null));
    results.sms = await sendSMS({
      to: user.phone,
      body: t.orderReady({ orderNumber }),
    });
  } else if (user?.phone && !canSendSMS(user, null)) {
    console.log(`[SMS] Skipping order ready - no SMS opt-in for phone ${user.phone.slice(-4)}`);
    results.sms = { success: false, reason: "not_opted_in" };
  }

  return results;
}

/**
 * Send a tier-up SMS (Task F2): sent when membership/engine.js's
 * onOrderCompleted returns `upgradedTo`. Localized by the user's locale.
 */
export async function sendTierUp(user, tierKey) {
  if (!user?.phone || !canSendSMS(user, null)) {
    return { success: false, reason: user?.phone ? "not_opted_in" : "no_phone" };
  }
  const locale = resolveLocale(user, null, null);
  const t = templateFor(locale);
  const link = (() => {
    const base = (process.env.WEB_APP_URL || "https://www.ohbeef.com").replace(/\/+$/, "");
    return `${base}/${locale}/member`;
  })();
  return sendSMS({ to: user.phone, body: t.tierUp({ tierKey, link }) });
}

/**
 * Fire-and-forget wrapper for every onOrderCompleted call site (index.js x2,
 * orders/routes.js, orders/service.js runPaidEffects): looks up the user,
 * honors SUPPORT_NOTIFY, and sends `sendTierUp` only when there's an actual
 * upgrade. Always called AFTER the membership transaction has committed,
 * never from inside it. Never throws.
 */
export async function notifyTierUpIfNeeded(prisma, { userId, upgradedTo }, { env = process.env, log = console.log } = {}) {
  if (!upgradedTo || !userId) return null;
  const mode = notifyMode(env);
  if (mode === "off") return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    if (mode === "log") {
      log(`[notifications] SUPPORT_NOTIFY=log: would send tier-up (${upgradedTo}) SMS to user ${userId}`);
      return null;
    }
    return await sendTierUp(user, upgradedTo);
  } catch (err) {
    console.error("[notifications] notifyTierUpIfNeeded failed:", err?.message || err);
    return null;
  }
}

/**
 * Send a credit-expiry-warning SMS (Task F2): membership/credits.js's
 * `lotsNeedingExpiryWarning` finds lots inside PROGRAM.expiryWarningDays of
 * expiring that haven't been warned about yet; the daily cron
 * (cron/wallet-cron.js) calls this once per lot, then marks it warned.
 */
export async function sendCreditExpiryWarning(user, lot) {
  if (!user?.phone || !canSendSMS(user, null)) {
    return { success: false, reason: user?.phone ? "not_opted_in" : "no_phone" };
  }
  const locale = resolveLocale(user, null, null);
  const t = templateFor(locale);
  const amount = `$${(lot.remainingCents / 100).toFixed(2)}`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "2-digit", day: "2-digit" }).format(lot.expiresAt);
  const link = (() => {
    const base = (process.env.WEB_APP_URL || "https://www.ohbeef.com").replace(/\/+$/, "");
    return `${base}/${locale}/member/credits`;
  })();
  return sendSMS({ to: user.phone, body: t.creditExpiring({ amount, date, link }) });
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
