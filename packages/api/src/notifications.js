/**
 * Notification Service
 * Handles email (Resend) and SMS (Twilio) notifications for orders
 * Updated: 2026-01-04
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

/**
 * Send shop order confirmation email
 * For online store purchases (merchandise, food products, etc.)
 */
export async function sendShopOrderConfirmation(order) {
  const email = order.shippingEmail;
  if (!email) {
    console.log("[EMAIL] No shipping email, skipping shop order confirmation");
    return { success: false, reason: "no_email" };
  }

  const totalFormatted = `$${(order.totalCents / 100).toFixed(2)}`;
  const subtotalFormatted = `$${(order.subtotalCents / 100).toFixed(2)}`;
  const shippingFormatted = order.shippingCents > 0 ? `$${(order.shippingCents / 100).toFixed(2)}` : "FREE";
  const taxFormatted = `$${(order.taxCents / 100).toFixed(2)}`;
  const orderDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build items list HTML with product images
  const itemsHtml = order.items
    .map(
      (item) => {
        const imageUrl = item.product?.imageUrl;
        const imageHtml = imageUrl
          ? `<img src="${imageUrl}" alt="${item.product?.name || 'Product'}" width="60" height="60" style="display: block; width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 0;">`
          : `<div style="width: 60px; height: 60px; background: linear-gradient(135deg, #E5E5E5 0%, #d5d5d5 100%); border-radius: 8px;"></div>`;

        return `
      <tr>
        <td style="padding: 18px 0; border-bottom: 1px solid #E5E5E5;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="64" style="vertical-align: top;">
                ${imageHtml}
              </td>
              <td style="vertical-align: top; padding-left: 16px;">
                <p style="margin: 0 0 6px; font-weight: 600; color: #222222; font-size: 15px; font-family: 'Raleway', sans-serif;">
                  ${item.product?.name || "Product"}
                </p>
                ${item.variant ? `<p style="margin: 0 0 4px; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Variant: ${item.variant}</p>` : ""}
                <p style="margin: 0; color: #7C7A67; font-size: 13px; font-family: 'Raleway', sans-serif; font-weight: 500;">Qty: ${item.quantity}</p>
              </td>
              <td style="vertical-align: top; text-align: right; white-space: nowrap;">
                <p style="margin: 0; font-weight: 600; color: #222222; font-size: 16px; font-family: 'Raleway', sans-serif;">
                  $${((item.priceCents * item.quantity) / 100).toFixed(2)}
                </p>
                ${item.quantity > 1 ? `<p style="margin: 6px 0 0; color: #666666; font-size: 12px; font-family: 'Raleway', sans-serif;">$${(item.priceCents / 100).toFixed(2)} each</p>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
      }
    )
    .join("");

  // Build items list text
  const itemsText = order.items
    .map(
      (item) =>
        `- ${item.product?.name || "Product"}${item.variant ? ` (${item.variant})` : ""} x ${item.quantity}: $${((item.priceCents * item.quantity) / 100).toFixed(2)}`
    )
    .join("\n");

  // Shipping address HTML
  const shippingAddressHtml =
    order.fulfillmentType === "SHIPPING" && order.shippingAddress1
      ? `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 28px;">
        <tr>
          <td style="background: #fafaf9; border-radius: 12px; padding: 24px; border: 1px solid #E5E5E5;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="40" style="vertical-align: top; padding-right: 16px;">
                  <div style="width: 36px; height: 36px; background: #7C7A67; border-radius: 50%; text-align: center; line-height: 36px;">
                    <span style="color: white; font-size: 16px;">📍</span>
                  </div>
                </td>
                <td>
                  <p style="margin: 0 0 10px; font-weight: 600; color: #222222; font-size: 14px; font-family: 'Raleway', sans-serif; text-transform: uppercase; letter-spacing: 1px;">Shipping To</p>
                  <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6; font-family: 'Raleway', sans-serif;">
                    <strong style="color: #222222;">${order.shippingName || ""}</strong><br>
                    ${order.shippingAddress1 || ""}${order.shippingAddress2 ? `<br>${order.shippingAddress2}` : ""}<br>
                    ${order.shippingCity || ""}, ${order.shippingState || ""} ${order.shippingZip || ""}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `
      : order.fulfillmentType === "PICKUP"
      ? `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 28px;">
        <tr>
          <td style="background: #fafaf9; border-radius: 12px; padding: 24px; border: 1px solid #E5E5E5;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="40" style="vertical-align: top; padding-right: 16px;">
                  <div style="width: 36px; height: 36px; background: #C7A878; border-radius: 50%; text-align: center; line-height: 36px;">
                    <span style="color: white; font-size: 16px;">🏠</span>
                  </div>
                </td>
                <td>
                  <p style="margin: 0 0 10px; font-weight: 600; color: #222222; font-size: 14px; font-family: 'Raleway', sans-serif; text-transform: uppercase; letter-spacing: 1px;">Pickup</p>
                  <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6; font-family: 'Raleway', sans-serif;">
                    We'll notify you when your order is ready for pickup.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `
      : "";

  // Discounts rows
  let discountsHtml = "";
  let discountsText = "";
  if (order.creditsApplied > 0) {
    discountsHtml += `
      <tr>
        <td style="padding: 8px 0; color: #555555; font-size: 14px;">Oh! Credits Applied</td>
        <td style="padding: 8px 0; text-align: right; color: #16a34a; font-weight: 500; font-size: 14px;">-$${(order.creditsApplied / 100).toFixed(2)}</td>
      </tr>`;
    discountsText += `Oh! Credits Applied: -$${(order.creditsApplied / 100).toFixed(2)}\n`;
  }
  if (order.giftCardApplied > 0) {
    discountsHtml += `
      <tr>
        <td style="padding: 8px 0; color: #555555; font-size: 14px;">Gift Card Applied</td>
        <td style="padding: 8px 0; text-align: right; color: #16a34a; font-weight: 500; font-size: 14px;">-$${(order.giftCardApplied / 100).toFixed(2)}</td>
      </tr>`;
    discountsText += `Gift Card Applied: -$${(order.giftCardApplied / 100).toFixed(2)}\n`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&family=Noto+Serif+TC:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #E5E5E5; font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #E5E5E5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px;">

          <!-- Header with Logo -->
          <tr>
            <td style="background: #222222; border-radius: 16px 16px 0 0; padding: 48px 40px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <!-- Oh! Character Logo with light background circle -->
                    <div style="width: 120px; height: 120px; background: #E5E5E5; border-radius: 50%; margin: 0 auto 24px; display: inline-block; padding: 10px; box-sizing: border-box;">
                      <img src="https://ohbeef.com/Oh_Logo_Mark_Web.png" alt="Oh!" width="100" height="100" style="display: block; border: 0;">
                    </div>

                    <!-- Title in Noto Serif TC style -->
                    <h1 style="margin: 0; color: #ffffff; font-family: 'Noto Serif TC', Georgia, serif; font-size: 32px; font-weight: 400; letter-spacing: 2px;">Order Confirmed</h1>
                    <p style="margin: 16px 0 0; color: #C7A878; font-family: 'Raleway', sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 1px;">Thank you for shopping with Oh!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Number Banner -->
          <tr>
            <td style="background: #7C7A67; padding: 24px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px; color: rgba(255,255,255,0.8); font-family: 'Raleway', sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 500;">Order Number</p>
                    <p style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600; letter-spacing: 3px; font-family: 'Raleway', monospace;">${order.orderNumber}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: #ffffff; padding: 36px 40px;">

              <!-- Order Date -->
              <p style="margin: 0 0 28px; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Ordered on ${orderDate}</p>

              <!-- Items Section -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 20px; color: #222222; font-family: 'Noto Serif TC', Georgia, serif; font-size: 18px; font-weight: 500;">Items Ordered</p>
                  </td>
                </tr>
                ${itemsHtml}
              </table>

              <!-- Order Summary -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 28px; border-top: 2px solid #E5E5E5; padding-top: 24px;">
                <tr>
                  <td style="padding: 10px 0; color: #666666; font-size: 14px; font-family: 'Raleway', sans-serif;">Subtotal</td>
                  <td style="padding: 10px 0; text-align: right; color: #222222; font-size: 14px; font-family: 'Raleway', sans-serif;">${subtotalFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666666; font-size: 14px; font-family: 'Raleway', sans-serif;">Shipping</td>
                  <td style="padding: 10px 0; text-align: right; color: ${order.shippingCents > 0 ? '#222222' : '#7C7A67'}; font-size: 14px; font-weight: ${order.shippingCents > 0 ? '400' : '600'}; font-family: 'Raleway', sans-serif;">${shippingFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666666; font-size: 14px; font-family: 'Raleway', sans-serif;">Tax</td>
                  <td style="padding: 10px 0; text-align: right; color: #222222; font-size: 14px; font-family: 'Raleway', sans-serif;">${taxFormatted}</td>
                </tr>
                ${discountsHtml}
                <tr>
                  <td colspan="2" style="padding-top: 20px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #7C7A67 0%, #6a6857 100%); border-radius: 8px;">
                      <tr>
                        <td style="padding: 18px 20px; font-weight: 600; color: #ffffff; font-size: 16px; font-family: 'Raleway', sans-serif;">Total</td>
                        <td style="padding: 18px 20px; text-align: right; font-weight: 700; color: #ffffff; font-size: 22px; font-family: 'Raleway', sans-serif;">${totalFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Shipping Address -->
              ${shippingAddressHtml}

            </td>
          </tr>

          <!-- What's Next Section -->
          <tr>
            <td style="background: #fafaf9; padding: 36px 40px; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 24px; color: #222222; font-family: 'Noto Serif TC', Georgia, serif; font-size: 18px; font-weight: 500;">What Happens Next?</p>

              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #7C7A67; border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-weight: 600; font-size: 14px; font-family: 'Raleway', sans-serif;">1</td>
                        <td style="padding-left: 16px;">
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Order Processing</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">We're preparing your items with care</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #C7A878; border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-weight: 600; font-size: 14px; font-family: 'Raleway', sans-serif;">2</td>
                        <td style="padding-left: 16px;">
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Shipping Confirmation</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">You'll receive tracking info once shipped</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #222222; border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-weight: 600; font-size: 14px; font-family: 'Raleway', sans-serif;">3</td>
                        <td style="padding-left: 16px;">
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Delivery</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Enjoy your Oh! products!</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="background: #ffffff; padding: 36px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
              <a href="https://ohbeef.com/en/store" style="display: inline-block; background: #222222; color: #E5E5E5; text-decoration: none; padding: 16px 40px; border-radius: 2px; font-weight: 500; font-size: 14px; font-family: 'Raleway', sans-serif; letter-spacing: 0.5px;">Continue Shopping</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #222222; border-radius: 0 0 16px 16px; padding: 40px; text-align: center;">
              <!-- Small logo in footer with light background circle -->
              <div style="width: 60px; height: 60px; background: #E5E5E5; border-radius: 50%; margin: 0 auto 16px; display: inline-block; padding: 5px; box-sizing: border-box;">
                <img src="https://ohbeef.com/Oh_Logo_Mark_Web.png" alt="Oh!" width="50" height="50" style="display: block; border: 0;">
              </div>

              <p style="margin: 0 0 6px; color: #C7A878; font-family: 'Noto Serif TC', Georgia, serif; font-size: 18px; font-weight: 400;">Oh! Beef Noodle Soup</p>
              <p style="margin: 0 0 24px; color: rgba(255,255,255,0.5); font-family: 'Raleway', sans-serif; font-size: 12px; letter-spacing: 1px;">The only restaurant built around <strong style="color: rgba(255,255,255,0.7);">you</strong></p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 12px;">
                    <a href="https://instagram.com/ohbeefnoodlesoup" style="color: rgba(255,255,255,0.6); text-decoration: none; font-size: 12px; font-family: 'Raleway', sans-serif;">Instagram</a>
                  </td>
                  <td style="color: rgba(255,255,255,0.2);">|</td>
                  <td style="padding: 0 12px;">
                    <a href="https://ohbeef.com" style="color: rgba(255,255,255,0.6); text-decoration: none; font-size: 12px; font-family: 'Raleway', sans-serif;">Website</a>
                  </td>
                  <td style="color: rgba(255,255,255,0.2);">|</td>
                  <td style="padding: 0 12px;">
                    <a href="mailto:hello@ohbeef.com" style="color: rgba(255,255,255,0.6); text-decoration: none; font-size: 12px; font-family: 'Raleway', sans-serif;">Contact</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 28px 0 0; color: rgba(255,255,255,0.35); font-size: 11px; font-family: 'Raleway', sans-serif; line-height: 1.6;">
                Questions about your order?<br>
                Reply to this email or contact us at orders@ohbeef.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
OH! BEEF NOODLE SOUP
Order Confirmed

Order Number: ${order.orderNumber}
Date: ${orderDate}

ITEMS ORDERED
${itemsText}

ORDER SUMMARY
Subtotal: ${subtotalFormatted}
Shipping: ${shippingFormatted}
Tax: ${taxFormatted}
${discountsText}Total: ${totalFormatted}

${order.fulfillmentType === "SHIPPING" && order.shippingAddress1 ? `SHIPPING TO
${order.shippingName || ""}
${order.shippingAddress1 || ""}${order.shippingAddress2 ? `\n${order.shippingAddress2}` : ""}
${order.shippingCity || ""}, ${order.shippingState || ""} ${order.shippingZip || ""}` : ""}

WHAT HAPPENS NEXT?
1. Order Processing - We're preparing your items with care
2. Shipping Confirmation - You'll receive tracking info once shipped
3. Delivery - Enjoy your Oh! products!

Questions? Contact us at hello@ohbeef.com

Thank you for shopping with Oh!
  `.trim();

  return sendEmail({
    to: email,
    subject: `Order Confirmed - #${order.orderNumber} | Oh! Beef Noodle Soup`,
    html,
    text,
  });
}
