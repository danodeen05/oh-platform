/**
 * Apple Wallet Web Service Implementation
 *
 * Required endpoints for pass updates per Apple specification:
 * https://developer.apple.com/documentation/walletpasses/adding_a_web_service_to_update_passes
 *
 * Endpoints:
 * - POST /wallet/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber
 * - DELETE /wallet/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber
 * - GET /wallet/v1/devices/:deviceLibraryId/registrations/:passTypeId
 * - GET /wallet/v1/passes/:passTypeId/:serialNumber
 * - POST /wallet/v1/log
 */

import { PrismaClient } from '@oh/db';
import { generateAuthToken, generateAppleWalletPass } from './wallet-pass.js';

const prisma = new PrismaClient();

/**
 * Validate authentication token from Apple Wallet request
 * @param {string} authHeader - Authorization header value (ApplePass <token>)
 * @param {string} serialNumber - Pass serial number (oh-member-{userId})
 * @returns {boolean} - Whether token is valid
 */
export function validateAuthToken(authHeader, serialNumber) {
  if (!authHeader?.startsWith('ApplePass ')) {
    return false;
  }

  const token = authHeader.substring(10); // Remove 'ApplePass ' prefix
  const userId = serialNumber.replace('oh-member-', '');
  const expectedToken = generateAuthToken(userId);

  return token === expectedToken;
}

/**
 * Register device for push notifications
 * Called when user adds pass to Apple Wallet
 *
 * @param {string} deviceLibraryId - Device identifier from Apple
 * @param {string} passTypeId - Pass type ID (pass.com.ohbeef.loyalty)
 * @param {string} serialNumber - Pass serial number (oh-member-{userId})
 * @param {string} pushToken - APNs push token
 * @returns {Object} - { status: 200|201 }
 */
export async function registerDevice(deviceLibraryId, passTypeId, serialNumber, pushToken) {
  const userId = serialNumber.replace('oh-member-', '');

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { status: 401 };
  }

  // Check if registration already exists
  const existing = await prisma.walletPassRegistration.findUnique({
    where: {
      deviceLibraryId_passTypeId_serialNumber: {
        deviceLibraryId,
        passTypeId,
        serialNumber,
      },
    },
  });

  if (existing) {
    // Update existing registration
    await prisma.walletPassRegistration.update({
      where: { id: existing.id },
      data: {
        pushToken,
        updatedAt: new Date(),
      },
    });
    return { status: 200 }; // Already registered
  }

  // Create new registration
  await prisma.walletPassRegistration.create({
    data: {
      userId,
      deviceLibraryId,
      pushToken,
      passTypeId,
      serialNumber,
    },
  });

  return { status: 201 }; // Newly registered
}

/**
 * Unregister device (user removed pass from wallet)
 *
 * @param {string} deviceLibraryId - Device identifier from Apple
 * @param {string} passTypeId - Pass type ID
 * @param {string} serialNumber - Pass serial number
 * @returns {Object} - { status: 200 }
 */
export async function unregisterDevice(deviceLibraryId, passTypeId, serialNumber) {
  await prisma.walletPassRegistration.deleteMany({
    where: {
      deviceLibraryId,
      passTypeId,
      serialNumber,
    },
  });

  return { status: 200 };
}

/**
 * Get list of passes registered for a device
 * Returns serial numbers of passes that have been updated since the given timestamp
 *
 * @param {string} deviceLibraryId - Device identifier from Apple
 * @param {string} passTypeId - Pass type ID
 * @param {string} passesUpdatedSince - Unix timestamp (optional)
 * @returns {Object} - { status: 200|204, body?: { lastUpdated, serialNumbers } }
 */
export async function getPassesForDevice(deviceLibraryId, passTypeId, passesUpdatedSince) {
  const where = {
    deviceLibraryId,
    passTypeId,
  };

  if (passesUpdatedSince) {
    where.updatedAt = { gt: new Date(parseInt(passesUpdatedSince) * 1000) };
  }

  const registrations = await prisma.walletPassRegistration.findMany({
    where,
    select: { serialNumber: true, updatedAt: true },
  });

  if (registrations.length === 0) {
    return { status: 204 }; // No content - no updates
  }

  const lastUpdated = Math.max(...registrations.map(r => r.updatedAt.getTime() / 1000));

  return {
    status: 200,
    body: {
      lastUpdated: Math.floor(lastUpdated).toString(),
      serialNumbers: registrations.map(r => r.serialNumber),
    },
  };
}

/**
 * Get the latest version of a pass
 * Called when Apple Wallet needs to refresh the pass
 *
 * @param {string} passTypeId - Pass type ID
 * @param {string} serialNumber - Pass serial number
 * @returns {Object} - { status: 200|404, contentType?, body? }
 */
export async function getUpdatedPass(passTypeId, serialNumber) {
  const userId = serialNumber.replace('oh-member-', '');

  // Get user with all required data for pass generation
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { status: 404 };
  }

  // Get all open locations for relevantLocations
  const locations = await prisma.location.findMany({
    where: { isClosed: false },
    select: {
      lat: true,
      lng: true,
      notificationRadiusMiles: true,
      name: true,
    },
  });

  // Add relevantText to each location
  const locationsWithText = locations.map(loc => ({
    ...loc,
    relevantText: `${loc.name} is nearby!`,
  }));

  try {
    const passBuffer = await generateAppleWalletPass(user, locationsWithText);

    return {
      status: 200,
      contentType: 'application/vnd.apple.pkpass',
      body: passBuffer,
    };
  } catch (error) {
    console.error('Error generating pass:', error);
    return { status: 500 };
  }
}

/**
 * Mark a pass registration as updated
 * This triggers Apple Wallet to fetch a new version of the pass
 *
 * @param {string} userId - User ID
 */
export async function markPassUpdated(userId) {
  await prisma.walletPassRegistration.updateMany({
    where: { userId },
    data: { updatedAt: new Date() },
  });
}
