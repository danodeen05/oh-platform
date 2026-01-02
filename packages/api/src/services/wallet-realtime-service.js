/**
 * Wallet Real-Time Update Service
 *
 * Handles real-time updates to Apple Wallet passes:
 * - Pod availability updates (refreshes relevantText with current data)
 * - Triggered when significant changes happen at locations
 */

import { PrismaClient } from '@oh/db';
import { refreshAllWalletPasses } from './credit-service.js';

const prisma = new PrismaClient();

// Track last known pod availability to detect significant changes
let lastKnownAvailability = new Map();

/**
 * Check if pod availability has changed significantly at any location
 * "Significant" = pods went from 0 to available, or from available to 0
 *
 * @returns {Promise<Object>} - { hasSignificantChange, changes }
 */
export async function checkPodAvailabilityChanges() {
  const locations = await prisma.location.findMany({
    where: { isClosed: false },
    select: {
      id: true,
      name: true,
      seats: {
        select: { status: true },
      },
    },
  });

  const changes = [];

  for (const location of locations) {
    const availablePods = location.seats.filter((s) => s.status === 'AVAILABLE').length;
    const previousAvailable = lastKnownAvailability.get(location.id) ?? -1;

    // Significant changes:
    // 1. Pods became available when there were none
    // 2. All pods became occupied when there were some available
    const becameAvailable = previousAvailable === 0 && availablePods > 0;
    const becameUnavailable = previousAvailable > 0 && availablePods === 0;

    if (becameAvailable || becameUnavailable) {
      changes.push({
        locationId: location.id,
        locationName: location.name,
        previousAvailable,
        currentAvailable: availablePods,
        changeType: becameAvailable ? 'PODS_AVAILABLE' : 'ALL_PODS_OCCUPIED',
      });
    }

    // Update tracking
    lastKnownAvailability.set(location.id, availablePods);
  }

  return {
    hasSignificantChange: changes.length > 0,
    changes,
  };
}

/**
 * Refresh all wallet passes with current location data
 * Should be called when pod availability changes significantly
 *
 * @returns {Promise<Object>} - Result of refreshAllWalletPasses
 */
export async function refreshPassesWithCurrentAvailability() {
  console.log('[Wallet] Refreshing all passes with current pod availability...');
  const result = await refreshAllWalletPasses();
  console.log(`[Wallet] Refreshed ${result.successCount}/${result.totalUsers} passes`);
  return result;
}

/**
 * Check for changes and refresh passes if needed
 * This should be called periodically (e.g., every 5 minutes)
 * or triggered by pod status changes
 *
 * @returns {Promise<Object>}
 */
export async function checkAndRefreshPasses() {
  const { hasSignificantChange, changes } = await checkPodAvailabilityChanges();

  if (hasSignificantChange) {
    console.log('[Wallet] Significant pod changes detected:', changes);
    const result = await refreshPassesWithCurrentAvailability();
    return { triggered: true, changes, refreshResult: result };
  }

  return { triggered: false, message: 'No significant changes' };
}

/**
 * Force refresh passes for users near a specific location
 * Useful when a pod becomes available at a specific location
 *
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>}
 */
export async function refreshPassesForLocationUsers(locationId) {
  // For now, refresh all users since we don't track user locations
  // In the future, could use user's last order location or preferences
  return refreshPassesWithCurrentAvailability();
}

/**
 * Initialize the availability tracking with current state
 * Should be called on server startup
 */
export async function initializeAvailabilityTracking() {
  const locations = await prisma.location.findMany({
    where: { isClosed: false },
    select: {
      id: true,
      seats: {
        select: { status: true },
      },
    },
  });

  for (const location of locations) {
    const availablePods = location.seats.filter((s) => s.status === 'AVAILABLE').length;
    lastKnownAvailability.set(location.id, availablePods);
  }

  console.log(`[Wallet] Initialized availability tracking for ${locations.length} locations`);
}
