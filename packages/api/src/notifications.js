/**
 * Notification Service
 * Handles email (Resend) and SMS (Twilio) notifications for orders
 * Updated: 2026-01-13
 */

import { Resend } from "resend";
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
 * @param {string} from - Optional custom from address (defaults to FROM_EMAIL env var)
 */
export async function sendEmail({ to, subject, html, text, from }) {
  if (!resend) {
    console.log("[EMAIL] Resend not configured, skipping email");
    return { success: false, reason: "not_configured" };
  }

  const fromEmail = from || FROM_EMAIL;

  try {
    const result = await resend.emails.send({
      from: `Oh! Beef Noodle Soup <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    });

    console.log(`[EMAIL] Sent to ${to}: ${subject}`, JSON.stringify(result));
    return { success: true, id: result.id };
  } catch (error) {
    console.error("[EMAIL] Failed to send:", error.message, error);
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
 * Beautiful receipt email with full order details, QR code, and member benefits
 */
export async function sendOrderConfirmation(order, user) {
  const results = { email: null, sms: null };
  const orderNumber = order.kitchenOrderNumber || order.orderNumber.slice(-6);
  const totalFormatted = `$${(order.totalCents / 100).toFixed(2)}`;
  const customerName = user?.name || order.guest?.name || "Valued Guest";
  const isGuest = !user?.id || order.guestId;

  // Calculate order breakdown
  const subtotalCents = order.totalCents || 0;
  const taxRate = order.location?.taxRate || 0.0725; // Default 7.25% if not set
  const taxCents = order.taxCents || Math.round(subtotalCents * taxRate);
  const totalWithTaxCents = subtotalCents + taxCents;

  // Calculate potential member credit (1% cashback for Chopstick tier)
  const potentialCredit = Math.round(subtotalCents * 0.01); // 1% cashback
  const potentialCreditFormatted = `$${(potentialCredit / 100).toFixed(2)}`;

  // Payment method info
  const paymentLast4 = order.paymentMethodLast4;
  const paymentBrand = order.paymentMethodBrand ? order.paymentMethodBrand.charAt(0).toUpperCase() + order.paymentMethodBrand.slice(1) : null;

  // Order date
  const orderDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  // Location name
  const locationName = order.location?.name || "Oh! Beef Noodle Soup";

  // Group items by category
  // Extras (add-ons, sides, drinks, desserts) - these are separate from the bowl
  const extrasItems = order.items?.filter(item => {
    const cat = item.menuItem?.category || "";
    return cat.startsWith("add-on") || cat.startsWith("side") || cat.startsWith("drink") || cat.startsWith("dessert");
  }) || [];
  // Bowl items = everything else (main, slider, topping, garnish, etc.)
  const bowlItems = order.items?.filter(item => {
    const cat = item.menuItem?.category || "";
    return !cat.startsWith("add-on") && !cat.startsWith("side") && !cat.startsWith("drink") && !cat.startsWith("dessert");
  }) || [];

  // Generate QR code for email
  const qrCodeUrl = order.orderQrCode ? `https://ohbeef.com/order/check-in?orderQrCode=${encodeURIComponent(order.orderQrCode)}` : null;
  const orderStatusUrl = order.orderQrCode ? `https://ohbeef.com/order/status?orderQrCode=${encodeURIComponent(order.orderQrCode)}` : null;
  const qrCodeDataUrl = order.orderQrCode ? await generateQRCodeDataURL(order.orderQrCode, 180) : null;

  // Build items HTML for extras (add-ons, sides, drinks, desserts)
  const buildItemsHtml = (items, sectionTitle, bgColor) => {
    if (!items || items.length === 0) return '';
    return `
      <tr>
        <td style="padding-bottom: 20px;">
          <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; color: #7C7A67; text-transform: uppercase; letter-spacing: 1px; font-family: 'Raleway', sans-serif;">${sectionTitle}</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: ${bgColor}; border-radius: 8px; padding: 12px 16px;">
            ${items.map(item => `
              <tr>
                <td style="padding: 4px 0; font-family: 'Raleway', sans-serif;">
                  <p style="margin: 0; font-size: 13px; color: #222222;">${item.menuItem?.name || 'Item'}${item.quantity > 1 ? ` <span style="color: #666666;">x${item.quantity}</span>` : ''}</p>
                </td>
                <td style="padding: 4px 0; text-align: right; vertical-align: top; white-space: nowrap;">
                  ${item.priceCents > 0 ? `<p style="margin: 0; font-size: 13px; color: #222222; font-family: 'Raleway', sans-serif;">$${((item.priceCents * item.quantity) / 100).toFixed(2)}</p>` : `<p style="margin: 0; font-size: 12px; color: #7C7A67; font-family: 'Raleway', sans-serif;">Included</p>`}
                </td>
              </tr>
            `).join('')}
          </table>
        </td>
      </tr>
    `;
  };

  // Build bowl section HTML - all items as a clean consolidated list with total price
  const buildBowlSectionHtml = (items) => {
    if (!items || items.length === 0) return '';

    // Calculate total bowl price
    const bowlTotalCents = items.reduce((sum, item) => sum + ((item.priceCents || 0) * (item.quantity || 1)), 0);
    const bowlTotalFormatted = `$${(bowlTotalCents / 100).toFixed(2)}`;

    // Build each line - if it has a selectedValue, show "Name: Value", otherwise just the name
    const itemLines = items.map(item => {
      const name = item.menuItem?.name || 'Item';
      const value = item.selectedValue || '';
      if (value) {
        return `<p style="margin: 0 0 4px; font-size: 13px; font-family: 'Raleway', sans-serif;"><span style="color: #222222;">${name}:</span> <span style="color: #666666;">${value}</span></p>`;
      } else {
        return `<p style="margin: 0 0 4px; font-size: 13px; color: #222222; font-weight: 500; font-family: 'Raleway', sans-serif;">${name}</p>`;
      }
    }).join('');

    return `
      <tr>
        <td style="padding-bottom: 20px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 12px;">
            <tr>
              <td style="font-size: 12px; font-weight: 600; color: #7C7A67; text-transform: uppercase; letter-spacing: 1px; font-family: 'Raleway', sans-serif;">Your Bowl</td>
              <td style="text-align: right; font-size: 14px; font-weight: 600; color: #222222; font-family: 'Raleway', sans-serif;">${bowlTotalFormatted}</td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: rgba(124, 122, 103, 0.08); border-radius: 8px;">
            <tr>
              <td style="padding: 14px 16px;">
                ${itemLines}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  };

  // Build plain text items list
  const buildItemsText = (items, sectionTitle) => {
    if (!items || items.length === 0) return '';
    return `${sectionTitle}\n${items.map(item =>
      `  - ${item.menuItem?.name || 'Item'}${item.selectedValue ? ` (${item.selectedValue})` : ''}${item.quantity > 1 ? ` x${item.quantity}` : ''}: ${item.priceCents > 0 ? `$${((item.priceCents * item.quantity) / 100).toFixed(2)}` : 'Included'}`
    ).join('\n')}\n`;
  };

  // Build plain text bowl section - all items as a clean list
  const buildBowlSectionText = (items) => {
    if (!items || items.length === 0) return '';
    let text = 'Your Bowl\n';
    items.forEach(item => {
      const name = item.menuItem?.name || 'Item';
      const value = item.selectedValue || '';
      if (value) {
        text += `  ${name}: ${value}\n`;
      } else {
        text += `  ${name}\n`;
      }
    });
    return text;
  };

  // Email notification
  if (user?.email || order.guest?.email) {
    const emailTo = user?.email || order.guest?.email;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Receipt</title>
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
                    <div style="width: 100px; height: 100px; background: #E5E5E5; border-radius: 50%; margin: 0 auto 24px; display: inline-block; padding: 8px; box-sizing: border-box;">
                      <img src="https://ohbeef.com/Oh_Logo_Mark_Web.png" alt="Oh!" width="84" height="84" style="display: block; border: 0;">
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-family: 'Noto Serif TC', Georgia, serif; font-size: 28px; font-weight: 400; letter-spacing: 2px;">Order Confirmed!</h1>
                    <p style="margin: 16px 0 0; color: #C7A878; font-family: 'Raleway', sans-serif; font-size: 15px; font-weight: 400;">Thank you, ${customerName}!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Number Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 20px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 4px; color: rgba(255,255,255,0.9); font-family: 'Raleway', sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 500;">Order Number</p>
                    <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 3px; font-family: 'Raleway', monospace;">#${orderNumber}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Code Section -->
          ${qrCodeDataUrl ? `
          <tr>
            <td style="background: #7C7A67; padding: 32px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #ffffff; font-family: 'Noto Serif TC', Georgia, serif; font-size: 18px; font-weight: 400;">Scan at Check-In Kiosk</p>
              <p style="margin: 0 0 20px; color: rgba(255,255,255,0.8); font-family: 'Raleway', sans-serif; font-size: 13px;">Show this QR code when you arrive at ${locationName}</p>
              <div style="background: white; border-radius: 16px; padding: 16px; display: inline-block; position: relative;">
                <img src="${qrCodeDataUrl}" alt="Order QR Code" width="180" height="180" style="display: block; border: 0;">
                <!-- Oh! Logo overlay in center with rounded corners -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; background: #ffffff; border-radius: 10px; padding: 4px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                  <img src="https://ohbeef.com/Oh_Logo_Mark_Web.png" alt="Oh!" width="36" height="36" style="display: block; border: 0; border-radius: 6px;">
                </div>
              </div>
              <p style="margin: 16px 0 0; color: rgba(255,255,255,0.7); font-family: monospace; font-size: 11px; letter-spacing: 1px;">${order.orderQrCode}</p>
            </td>
          </tr>
          ` : ''}

          <!-- Main Content -->
          <tr>
            <td style="background: #ffffff; padding: 36px 40px;">

              <!-- Order Date & Location -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">${orderDate}</p>
                    <p style="margin: 4px 0 0; color: #7C7A67; font-size: 13px; font-family: 'Raleway', sans-serif; font-weight: 500;">${locationName}</p>
                  </td>
                </tr>
              </table>

              <!-- Order Items -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px; color: #222222; font-family: 'Noto Serif TC', Georgia, serif; font-size: 18px; font-weight: 500;">Your Order</p>
                  </td>
                </tr>
                ${buildBowlSectionHtml(bowlItems)}
                ${buildItemsHtml(extrasItems, "Add-Ons & Extras", "rgba(199, 168, 120, 0.1)")}
              </table>

              <!-- Order Summary -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 8px; border-top: 2px solid #E5E5E5; padding-top: 20px;">
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-size: 14px; font-family: 'Raleway', sans-serif;">Subtotal</td>
                  <td style="padding: 8px 0; text-align: right; color: #222222; font-size: 14px; font-family: 'Raleway', sans-serif;">$${(subtotalCents / 100).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-size: 14px; font-family: 'Raleway', sans-serif;">Tax</td>
                  <td style="padding: 8px 0; text-align: right; color: #222222; font-size: 14px; font-family: 'Raleway', sans-serif;">$${(taxCents / 100).toFixed(2)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 16px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #222222 0%, #333333 100%); border-radius: 8px;">
                      <tr>
                        <td style="padding: 16px 20px; font-weight: 600; color: #ffffff; font-size: 16px; font-family: 'Raleway', sans-serif;">Total Paid</td>
                        <td style="padding: 16px 20px; text-align: right; font-weight: 700; color: #ffffff; font-size: 22px; font-family: 'Raleway', sans-serif;">$${(totalWithTaxCents / 100).toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${paymentLast4 ? `
                <tr>
                  <td colspan="2" style="padding-top: 12px; text-align: center;">
                    <p style="margin: 0; color: #666666; font-size: 12px; font-family: 'Raleway', sans-serif;">
                      Paid with ${paymentBrand || 'Card'} ending in ${paymentLast4}
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>

            </td>
          </tr>

          <!-- Track Order CTA -->
          ${orderStatusUrl ? `
          <tr>
            <td style="background: #fafaf9; padding: 32px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 16px; color: #222222; font-family: 'Raleway', sans-serif; font-size: 15px; font-weight: 500;">Track your order in real-time</p>
              <a href="${orderStatusUrl}" style="display: inline-block; background: #7C7A67; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: 'Raleway', sans-serif;">View Order Status</a>
            </td>
          </tr>
          ` : ''}

          <!-- Member Benefits CTA (for guests) -->
          ${isGuest ? `
          <tr>
            <td style="background: linear-gradient(135deg, #C7A878 0%, #B8956A 100%); padding: 32px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #222222; font-family: 'Noto Serif TC', Georgia, serif; font-size: 20px; font-weight: 500;">Become an Oh! Member</p>
              <p style="margin: 0 0 16px; color: rgba(34,34,34,0.8); font-family: 'Raleway', sans-serif; font-size: 14px; line-height: 1.6;">
                Join Oh! Rewards and earn credits on every order!<br>
                <strong>This order would have earned you ${potentialCreditFormatted} in credits.</strong>
              </p>
              <a href="https://ohbeef.com/member" style="display: inline-block; background: #222222; color: #E5E5E5; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: 'Raleway', sans-serif;">Join Now — It's Free</a>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td width="33%" style="text-align: center; padding: 0 8px;">
                    <p style="margin: 0; font-size: 20px;">💰</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #222222; font-family: 'Raleway', sans-serif;">Earn Cashback</p>
                  </td>
                  <td width="33%" style="text-align: center; padding: 0 8px;">
                    <p style="margin: 0; font-size: 20px;">🏆</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #222222; font-family: 'Raleway', sans-serif;">Collect Badges</p>
                  </td>
                  <td width="33%" style="text-align: center; padding: 0 8px;">
                    <p style="margin: 0; font-size: 20px;">⭐</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #222222; font-family: 'Raleway', sans-serif;">VIP Perks</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- What's Next Section -->
          <tr>
            <td style="background: #ffffff; padding: 36px 40px; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 24px; color: #222222; font-family: 'Noto Serif TC', Georgia, serif; font-size: 18px; font-weight: 500;">What's Next?</p>

              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #7C7A67; border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-weight: 600; font-size: 14px; font-family: 'Raleway', sans-serif;">1</td>
                        <td style="padding-left: 16px;">
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Head to ${locationName}</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">We're preparing your meal fresh</p>
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
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Scan Your QR Code</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Check in at our kiosk to get your pod</p>
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
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Enjoy Your Meal!</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Relax in your private pod</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #222222; border-radius: 0 0 16px 16px; padding: 40px; text-align: center;">
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
                    <a href="mailto:orders@ohbeef.com" style="color: rgba(255,255,255,0.6); text-decoration: none; font-size: 12px; font-family: 'Raleway', sans-serif;">Contact</a>
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
Order Confirmed!

Thank you, ${customerName}!

ORDER #${orderNumber}
${orderDate}
${locationName}

${order.orderQrCode ? `CHECK-IN QR CODE
Scan this code at our kiosk when you arrive:
${order.orderQrCode}

` : ''}YOUR ORDER
${buildBowlSectionText(bowlItems)}${buildItemsText(extrasItems, "Add-Ons & Extras")}
ORDER SUMMARY
Subtotal: $${(subtotalCents / 100).toFixed(2)}
Tax: $${(taxCents / 100).toFixed(2)}
Total Paid: $${(totalWithTaxCents / 100).toFixed(2)}
${paymentLast4 ? `Paid with ${paymentBrand || 'Card'} ending in ${paymentLast4}` : ''}

${orderStatusUrl ? `TRACK YOUR ORDER
${orderStatusUrl}

` : ''}${isGuest ? `BECOME AN OH! MEMBER
Join Oh! Rewards and earn credits on every order!
This order would have earned you ${potentialCreditFormatted} in credits.
Sign up free at: https://ohbeef.com/member

` : ''}WHAT'S NEXT?
1. Head to ${locationName} - We're preparing your meal fresh
2. Scan Your QR Code - Check in at our kiosk to get your pod
3. Enjoy Your Meal! - Relax in your private pod

Questions? Contact us at orders@ohbeef.com

Thank you for dining with Oh!
    `.trim();

    results.email = await sendEmail({
      to: emailTo,
      subject: `Your Oh! Receipt - Order #${orderNumber}`,
      html,
      text,
      from: "receipt@ohbeef.com",
    });
  }

  // SMS notification
  const phone = user?.phone || order.guest?.phone;
  if (phone) {
    results.sms = await sendSMS({
      to: phone,
      body: `Oh! Order #${orderNumber} confirmed! Total: ${totalFormatted}. ${order.orderQrCode ? `Check in at kiosk with code: ${order.orderQrCode.slice(-8)}` : 'Show this text at check-in.'}`,
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
      from: "noreply@ohbeef.com",
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
      from: "noreply@ohbeef.com",
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
    from: "noreply@ohbeef.com",
  });
}

/**
 * Send gift card delivery email to recipient
 * Beautiful email with gift card preview, QR code, and redemption instructions
 */
export async function sendGiftCardEmail(giftCard) {
  const email = giftCard.recipientEmail;
  if (!email) {
    console.log("[EMAIL] No recipient email, skipping gift card delivery");
    return { success: false, reason: "no_email" };
  }

  const amountFormatted = `$${(giftCard.amountCents / 100).toFixed(0)}`;
  const recipientName = giftCard.recipientName || "Friend";
  const personalMessage = giftCard.personalMessage || null;

  // Balance page URL with code pre-filled
  const qrCodeUrl = `https://ohbeef.com/gift-cards/balance?code=${encodeURIComponent(giftCard.code)}`;

  // Design gradients matching the frontend
  const designGradients = {
    classic: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
    dark: "linear-gradient(135deg, #222222 0%, #444444 100%)",
    gold: "linear-gradient(135deg, #C7A878 0%, #8B7355 100%)",
  };
  const cardGradient = designGradients[giftCard.designId] || designGradients.classic;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Received an Oh! Gift Card</title>
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
                    <h1 style="margin: 0; color: #ffffff; font-family: 'Noto Serif TC', Georgia, serif; font-size: 32px; font-weight: 400; letter-spacing: 2px;">You've Received a Gift!</h1>
                    <p style="margin: 16px 0 0; color: #C7A878; font-family: 'Raleway', sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 1px;">Someone special is treating you to Oh!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting Banner -->
          <tr>
            <td style="background: #7C7A67; padding: 28px 40px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-family: 'Noto Serif TC', Georgia, serif; font-size: 22px; font-weight: 400;">
                Hello, ${recipientName}!
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: #ffffff; padding: 40px;">

              <!-- Gift Card Visual Preview -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <div style="width: 320px; max-width: 100%; aspect-ratio: 1.6; border-radius: 16px; background: ${cardGradient}; box-shadow: 0 16px 40px rgba(0,0,0,0.2); position: relative; overflow: hidden;">
                      <!-- Using table-based layout for better email client support -->
                      <table cellpadding="0" cellspacing="0" border="0" width="100%" height="200" style="height: 200px;">
                        <tr>
                          <td style="padding: 24px; vertical-align: top;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td>
                                  <p style="margin: 0; font-size: 10px; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase; font-family: 'Raleway', sans-serif;">Digital Gift Card</p>
                                </td>
                                <td align="right">
                                  <img src="https://ohbeef.com/Oh_Logo_Mark_Web.png" alt="Oh!" width="50" height="50" style="display: block; border: 0; filter: brightness(0) invert(1); opacity: 0.85;">
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="vertical-align: middle;">
                            <p style="margin: 0; font-size: 48px; font-weight: 300; color: #ffffff; font-family: 'Raleway', sans-serif; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">${amountFormatted}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 24px; vertical-align: bottom;">
                            <p style="margin: 0; font-size: 14px; font-weight: 300; color: #ffffff; font-family: 'Raleway', sans-serif;">Oh! Beef Noodle Soup</p>
                            <p style="margin: 4px 0 0; font-size: 11px; color: rgba(255,255,255,0.6); font-family: 'Raleway', sans-serif;">ohbeef.com</p>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              ${personalMessage ? `
              <!-- Personal Message -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td style="background: #fafaf9; border-radius: 12px; padding: 28px; border-left: 4px solid #C7A878;">
                    <p style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #7C7A67; font-family: 'Raleway', sans-serif; font-weight: 600;">Personal Message</p>
                    <p style="margin: 0; font-size: 16px; color: #222222; line-height: 1.7; font-family: 'Raleway', sans-serif; font-style: italic;">"${personalMessage}"</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Gift Card Code & QR Section -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #666666; font-family: 'Raleway', sans-serif; font-weight: 500;">Your Gift Card Code</p>
                    <div style="background: #222222; border-radius: 12px; padding: 24px 32px; display: inline-block;">
                      <p style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: 4px; color: #ffffff; font-family: 'Courier New', monospace;">${giftCard.code}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Check Balance Button -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${qrCodeUrl}" style="display: inline-block; padding: 16px 40px; background: #7C7A67; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Check Balance</a>
                    <p style="margin: 12px 0 0; font-size: 12px; color: #999999; font-family: 'Raleway', sans-serif;">View your balance and start using your gift card</p>
                  </td>
                </tr>
              </table>

              <!-- Value Summary -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background: linear-gradient(135deg, #7C7A67 0%, #6a6857 100%); border-radius: 12px; padding: 20px 24px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="color: rgba(255,255,255,0.9); font-size: 14px; font-family: 'Raleway', sans-serif;">Gift Card Value</td>
                        <td align="right" style="color: #ffffff; font-size: 24px; font-weight: 700; font-family: 'Raleway', sans-serif;">${amountFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- How to Redeem Section -->
          <tr>
            <td style="background: #fafaf9; padding: 36px 40px; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0 0 24px; color: #222222; font-family: 'Noto Serif TC', Georgia, serif; font-size: 18px; font-weight: 500;">How to Redeem</p>

              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #7C7A67; border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-weight: 600; font-size: 14px; font-family: 'Raleway', sans-serif;">1</td>
                        <td style="padding-left: 16px;">
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Visit Oh! Beef Noodle Soup</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Dine in, order online, or shop our store</p>
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
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Scan QR or Enter Code</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Scan the QR code at our kiosk, or enter your code at checkout</p>
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
                          <p style="margin: 0; color: #222222; font-size: 15px; font-weight: 600; font-family: 'Raleway', sans-serif;">Enjoy!</p>
                          <p style="margin: 4px 0 0; color: #666666; font-size: 13px; font-family: 'Raleway', sans-serif;">Your balance never expires</p>
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
              <a href="https://ohbeef.com/gift-cards/balance?code=${encodeURIComponent(giftCard.code)}" style="display: inline-block; background: #222222; color: #E5E5E5; text-decoration: none; padding: 16px 48px; border-radius: 2px; font-weight: 500; font-size: 14px; font-family: 'Raleway', sans-serif; letter-spacing: 0.5px;">Start Ordering</a>
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
                This gift card never expires and can be used<br>
                for any purchase at Oh! Beef Noodle Soup.
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
You've Received a Gift!

Hello, ${recipientName}!

Someone special has sent you an Oh! Gift Card worth ${amountFormatted}!

${personalMessage ? `PERSONAL MESSAGE\n"${personalMessage}"\n\n` : ''}YOUR GIFT CARD CODE
${giftCard.code}

CHECK BALANCE & REDEEM
${qrCodeUrl}

VALUE: ${amountFormatted}

HOW TO REDEEM
1. Visit Oh! Beef Noodle Soup - Dine in, order online, or shop our store
2. Scan QR or Enter Code - Scan the QR code at our kiosk, or enter your code at checkout
3. Enjoy! - Your balance never expires

Start ordering: ${qrCodeUrl}

Questions? Contact us at hello@ohbeef.com

Thank you for being part of the Oh! family!
  `.trim();

  return sendEmail({
    to: email,
    subject: `You've Received a ${amountFormatted} Oh! Gift Card!`,
    html,
    text,
    from: "noreply@ohbeef.com",
  });
}
