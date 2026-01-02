/**
 * Apple Push Notification Service for Wallet Pass Updates
 *
 * Sends empty push notifications to trigger pass refresh.
 * Uses HTTP/2 to communicate with APNs servers.
 *
 * SETUP REQUIRED:
 * 1. Create an APNs Key in Apple Developer Portal
 * 2. Download the .p8 key file
 * 3. Set environment variables:
 *    - APPLE_APNS_KEY_ID (10-character key ID)
 *    - APPLE_APNS_PRIVATE_KEY_BASE64 (base64-encoded .p8 file content)
 *    - APPLE_TEAM_ID (already set for wallet pass)
 *    - APPLE_PASS_TYPE_ID (already set for wallet pass)
 *    - APPLE_APNS_ENVIRONMENT (optional: 'production' or 'sandbox', defaults to NODE_ENV-based)
 */

import http2 from 'http2';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@oh/db';

const prisma = new PrismaClient();

const APNS_HOST_PRODUCTION = 'api.push.apple.com';
const APNS_HOST_SANDBOX = 'api.sandbox.push.apple.com';

/**
 * Determine APNs environment
 *
 * For Apple Wallet passes, the APNs environment depends on how the PASS is signed,
 * not the app. Passes signed with production certificates use production APNs.
 *
 * APPLE_APNS_ENVIRONMENT env var allows explicit override if needed.
 * Default: 'production' (correct for production-signed wallet passes)
 */
export function getAPNsEnvironment() {
  // Explicit override takes precedence
  if (process.env.APPLE_APNS_ENVIRONMENT) {
    return process.env.APPLE_APNS_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production';
  }
  // Default to production - wallet passes are signed with production certificates
  return 'production';
}

// Cache for JWT tokens (valid for 1 hour)
let cachedJWT = null;
let jwtExpiry = 0;

/**
 * Check if APNs is configured
 * @returns {boolean}
 */
export function isAPNsConfigured() {
  return !!(
    process.env.APPLE_APNS_KEY_ID &&
    process.env.APPLE_APNS_PRIVATE_KEY_BASE64 &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_TYPE_ID
  );
}

/**
 * Generate JWT for APNs authentication
 * Uses ES256 algorithm with the .p8 key
 * @returns {string} - JWT token
 */
function generateAPNsJWT() {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 5 min buffer)
  if (cachedJWT && jwtExpiry > now + 300) {
    return cachedJWT;
  }

  const keyId = process.env.APPLE_APNS_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const privateKey = Buffer.from(
    process.env.APPLE_APNS_PRIVATE_KEY_BASE64,
    'base64'
  ).toString();

  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: teamId,
    expiresIn: '1h',
    header: {
      alg: 'ES256',
      kid: keyId,
    },
  });

  // Cache for 55 minutes
  cachedJWT = token;
  jwtExpiry = now + 3300;

  return token;
}

/**
 * Send push notification to a single device
 * For wallet passes, this is an empty push that triggers the device
 * to fetch the updated pass from the web service
 *
 * @param {string} pushToken - Device push token
 * @returns {Promise<Object>} - { success: boolean, status?: number, error?: string }
 */
export async function sendPassUpdatePush(pushToken) {
  if (!isAPNsConfigured()) {
    console.warn('APNs not configured, skipping push notification');
    return { success: false, error: 'not_configured' };
  }

  const environment = getAPNsEnvironment();
  const host = environment === 'production' ? APNS_HOST_PRODUCTION : APNS_HOST_SANDBOX;
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;

  console.log(`[APNs] Sending push to ${environment} (${host}), topic: ${passTypeId}`);

  return new Promise((resolve) => {
    let client;

    try {
      client = http2.connect(`https://${host}`);

      client.on('error', (err) => {
        console.error('APNs connection error:', err.message);
        resolve({ success: false, error: err.message });
      });

      const jwtToken = generateAPNsJWT();

      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${pushToken}`,
        authorization: `bearer ${jwtToken}`,
        'apns-topic': passTypeId,
        'apns-push-type': 'background',
        'apns-priority': '5', // Low priority for background push
      });

      // Empty payload for pass updates
      req.write(JSON.stringify({}));
      req.end();

      let responseData = '';

      req.on('data', (chunk) => {
        responseData += chunk;
      });

      req.on('response', (headers) => {
        const status = headers[':status'];

        // Wait for all data before resolving
        req.on('end', () => {
          if (status === 200) {
            console.log('[APNs] Push sent successfully');
            resolve({ success: true });
          } else {
            // Parse error response from APNs
            let errorInfo = responseData;
            try {
              const parsed = JSON.parse(responseData);
              errorInfo = parsed.reason || responseData;
            } catch (e) {
              // responseData is not JSON
            }
            console.error(`[APNs] Push failed: status=${status}, reason=${errorInfo}, token=${pushToken.substring(0, 20)}...`);
            resolve({ success: false, status, error: errorInfo });
          }
        });
      });

      req.on('error', (err) => {
        console.error('APNs request error:', err.message);
        resolve({ success: false, error: err.message });
      });

      req.on('close', () => {
        client.close();
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        req.close();
        client.close();
        resolve({ success: false, error: 'timeout' });
      }, 10000);
    } catch (error) {
      console.error('APNs error:', error.message);
      if (client) client.close();
      resolve({ success: false, error: error.message });
    }
  });
}

/**
 * Send update notification to all registered devices for a user
 * This triggers all devices to fetch an updated pass
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { sent: number, failed: number }
 */
export async function notifyUserPassUpdate(userId) {
  const registrations = await prisma.walletPassRegistration.findMany({
    where: {
      userId,
    },
  });

  if (registrations.length === 0) {
    return { sent: 0, failed: 0, reason: 'no_registrations' };
  }

  const results = await Promise.allSettled(
    registrations.map((reg) => sendPassUpdatePush(reg.pushToken))
  );

  const sent = results.filter(
    (r) => r.status === 'fulfilled' && r.value.success
  ).length;
  const failed = results.filter(
    (r) => r.status === 'rejected' || !r.value?.success
  ).length;

  return { sent, failed };
}

/**
 * Send update notification to all registered devices for multiple users
 *
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Object>} - { totalSent: number, totalFailed: number }
 */
export async function notifyMultipleUsersPassUpdate(userIds) {
  const results = await Promise.allSettled(
    userIds.map((userId) => notifyUserPassUpdate(userId))
  );

  let totalSent = 0;
  let totalFailed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalSent += result.value.sent;
      totalFailed += result.value.failed;
    } else {
      totalFailed += 1;
    }
  }

  return { totalSent, totalFailed };
}
