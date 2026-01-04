/**
 * Notification Service
 * Handles email (Resend) and SMS (Twilio) notifications for orders
 */

import { Resend } from "resend";
import twilio from "twilio";

// Initialize providers (will be null if env vars not set)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@oh-beef.com";
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

/**
 * Send an email notification
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    console.log("[EMAIL] Resend not configured, skipping email");
    return { success: false, reason: "not_configured" };
  }

  try {
    const result = await resend.emails.send({
      from: `Oh! Beef Noodle Soup <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });

    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
    return { success: true, id: result.id };
  } catch (error) {
    console.error("[EMAIL] Failed to send:", error);
    return { success: false, error: error.message };
  }
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
 * Send order confirmation notification
 */
export async function sendOrderConfirmation(order, user) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);
  const totalFormatted = `$${(order.totalCents / 100).toFixed(2)}`;

  // Email notification
  if (user?.email) {
    results.email = await sendEmail({
      to: user.email,
      subject: `Oh! Order Confirmed - #${orderNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #7C7A67; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Oh! Beef Noodle Soup</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="margin-top: 0;">Order Confirmed!</h2>
            <p>Thank you for your order. We're preparing your delicious meal!</p>

            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Order Number:</strong> #${orderNumber}</p>
              <p style="margin: 8px 0 0;"><strong>Total:</strong> ${totalFormatted}</p>
            </div>

            <p>You can track your order status at any time by visiting your order page or scanning your QR code at our check-in kiosk.</p>

            <p style="margin-top: 24px;">See you soon!</p>
            <p style="color: #666;">— The Oh! Team</p>
          </div>
          <div style="background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">Oh! Beef Noodle Soup</p>
          </div>
        </div>
      `,
      text: `Order Confirmed!\n\nOrder Number: #${orderNumber}\nTotal: ${totalFormatted}\n\nTrack your order at our website or check in at the kiosk.\n\nSee you soon!\n— The Oh! Team`,
    });
  }

  // SMS notification
  if (user?.phone) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `Oh! Order Confirmed #${orderNumber}. Total: ${totalFormatted}. Track your order at our website or check in at the kiosk when you arrive.`,
    });
  }

  return results;
}

/**
 * Send pod ready notification
 */
export async function sendPodReadyNotification(order, user, podNumber) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);

  // Email notification
  if (user?.email) {
    results.email = await sendEmail({
      to: user.email,
      subject: `Oh! Your Pod is Ready - Pod #${podNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #7C7A67; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Oh! Beef Noodle Soup</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="margin-top: 0; color: #22c55e;">Your Pod is Ready!</h2>

            <div style="background: #22c55e; color: white; padding: 32px; border-radius: 12px; text-align: center; margin: 16px 0;">
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">Go to</p>
              <p style="margin: 8px 0; font-size: 48px; font-weight: bold;">Pod #${podNumber}</p>
            </div>

            <p>Order #${orderNumber} is ready. Please head to your assigned pod to enjoy your meal!</p>

            <p style="margin-top: 24px;">Enjoy!</p>
            <p style="color: #666;">— The Oh! Team</p>
          </div>
          <div style="background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">Oh! Beef Noodle Soup</p>
          </div>
        </div>
      `,
      text: `Your Pod is Ready!\n\nPod #${podNumber}\n\nOrder #${orderNumber} is ready. Please head to your assigned pod to enjoy your meal!\n\nEnjoy!\n— The Oh! Team`,
    });
  }

  // SMS notification
  if (user?.phone) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `Oh! Your Pod #${podNumber} is ready! Order #${orderNumber}. Head to your pod to enjoy your meal!`,
    });
  }

  return results;
}

/**
 * Send queue update notification (position changed or estimated wait)
 */
export async function sendQueueUpdateNotification(order, user, queuePosition, estimatedMinutes) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);

  // Only send SMS for queue updates (email would be too spammy)
  if (user?.phone) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `Oh! Order #${orderNumber}: You're #${queuePosition} in line. Estimated wait: ~${estimatedMinutes} min. We'll notify you when your pod is ready!`,
    });
  }

  return results;
}

/**
 * Send order ready for pickup notification (for non-pod orders)
 */
export async function sendOrderReadyNotification(order, user) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);

  // Email notification
  if (user?.email) {
    results.email = await sendEmail({
      to: user.email,
      subject: `Oh! Your Order is Ready - #${orderNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #7C7A67; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Oh! Beef Noodle Soup</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="margin-top: 0; color: #22c55e;">Your Order is Ready!</h2>

            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Order Number:</strong> #${orderNumber}</p>
            </div>

            <p>Your delicious meal is ready and waiting for you. Head over to pick it up!</p>

            <p style="margin-top: 24px;">Enjoy!</p>
            <p style="color: #666;">— The Oh! Team</p>
          </div>
          <div style="background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">Oh! Beef Noodle Soup</p>
          </div>
        </div>
      `,
      text: `Your Order is Ready!\n\nOrder #${orderNumber} is ready and waiting for you. Head over to pick it up!\n\nEnjoy!\n— The Oh! Team`,
    });
  }

  // SMS notification
  if (user?.phone) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `Oh! Your order #${orderNumber} is ready! Head over to pick it up. Enjoy!`,
    });
  }

  return results;
}

/**
 * Send admin notification for new user creation
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
      configured: !!resend,
      provider: "Resend",
    },
    sms: {
      configured: !!(twilioClient && TWILIO_PHONE),
      provider: "Twilio",
    },
  };
}
