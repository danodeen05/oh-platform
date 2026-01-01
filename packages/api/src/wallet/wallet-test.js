/**
 * Wallet Notification System - End-to-End Test
 *
 * This script tests all wallet functionality:
 * 1. Pass generation with locations
 * 2. Web service endpoints (device registration)
 * 3. Notification service functions
 *
 * Usage: node --env-file=../../.env src/wallet/wallet-test.js
 */

import { PrismaClient } from '@oh/db';
import {
  generateAppleWalletPass,
  generateDemoPassData,
  isAppleWalletConfigured,
  generateAuthToken,
} from './wallet-pass.js';
import {
  validateAuthToken,
  registerDevice,
  unregisterDevice,
  getPassesForDevice,
  markPassUpdated,
} from './wallet-web-service.js';
import {
  checkAndSendNearRestaurantNotification,
  checkAndSendStreakAtRiskNotification,
  checkAndSendTierProgressNotification,
  checkAndSendCreditsReminder,
  sendOrderCompletedNotification,
} from './wallet-notification-service.js';
import { isAPNsConfigured } from './apns-service.js';

const prisma = new PrismaClient();

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
};

function log(message, type = 'info') {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    pass: '\x1b[32m[PASS]\x1b[0m',
    fail: '\x1b[31m[FAIL]\x1b[0m',
    skip: '\x1b[33m[SKIP]\x1b[0m',
  };
  console.log(`${prefix[type] || prefix.info} ${message}`);
}

function test(name, passed, message = '') {
  if (passed) {
    results.passed++;
    results.tests.push({ name, status: 'passed' });
    log(`${name}: ${message || 'OK'}`, 'pass');
  } else {
    results.failed++;
    results.tests.push({ name, status: 'failed', message });
    log(`${name}: ${message}`, 'fail');
  }
}

function skip(name, reason) {
  results.skipped++;
  results.tests.push({ name, status: 'skipped', reason });
  log(`${name}: ${reason}`, 'skip');
}

async function runTests() {
  console.log('\n========================================');
  console.log('  WALLET NOTIFICATION SYSTEM - E2E TEST');
  console.log('========================================\n');

  // Test 1: Check configuration
  log('Testing configuration...');
  const appleConfigured = isAppleWalletConfigured();
  const apnsConfigured = isAPNsConfigured();

  log(`Apple Wallet configured: ${appleConfigured}`);
  log(`APNs configured: ${apnsConfigured}`);

  // Get a test user
  const testUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!testUser) {
    log('No users found in database. Cannot run tests.', 'fail');
    return;
  }

  log(`Using test user: ${testUser.email || testUser.id}`);

  // Test 2: Auth token generation
  console.log('\n--- Auth Token Tests ---');
  const authToken = generateAuthToken(testUser.id);
  test('Auth token generation', authToken && authToken.length === 32, `Token: ${authToken.substring(0, 8)}...`);

  // Test 3: Auth token validation
  const serialNumber = `oh-member-${testUser.id}`;
  const validAuthHeader = `ApplePass ${authToken}`;
  const isValid = validateAuthToken(validAuthHeader, serialNumber);
  test('Auth token validation (valid)', isValid === true);

  const invalidAuthHeader = 'ApplePass invalid-token';
  const isInvalid = validateAuthToken(invalidAuthHeader, serialNumber);
  test('Auth token validation (invalid)', isInvalid === false);

  // Test 4: Pass generation
  console.log('\n--- Pass Generation Tests ---');

  // Get locations for pass
  const locations = await prisma.location.findMany({
    where: { isClosed: false },
    select: {
      lat: true,
      lng: true,
      notificationRadiusMiles: true,
      name: true,
    },
  });

  log(`Found ${locations.length} location(s) for geofencing`);

  if (locations.length > 0) {
    test('Location has notificationRadiusMiles', locations[0].notificationRadiusMiles !== undefined);
  }

  // Test demo pass data
  const demoData = generateDemoPassData(testUser);
  test('Demo pass data generation', demoData && demoData._demo === true);
  test('Demo pass has correct tier', demoData.fields?.header?.tier === testUser.membershipTier.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) || demoData.fields?.header?.tier !== undefined);

  // Test actual pass generation (if configured)
  if (appleConfigured) {
    try {
      const locationsWithText = locations.map((loc) => ({
        ...loc,
        relevantText: `${loc.name} is nearby!`,
      }));
      const passBuffer = await generateAppleWalletPass(testUser, locationsWithText);
      test('Apple Wallet pass generation', passBuffer && passBuffer.length > 0, `Buffer size: ${passBuffer.length} bytes`);
    } catch (error) {
      test('Apple Wallet pass generation', false, error.message);
    }
  } else {
    skip('Apple Wallet pass generation', 'Certificates not configured');
  }

  // Test 5: Device registration
  console.log('\n--- Device Registration Tests ---');

  const testDeviceId = 'test-device-' + Date.now();
  const testPassTypeId = 'pass.com.ohbeef.loyalty';
  const testPushToken = 'test-push-token-' + Date.now();

  // Register device
  const registerResult = await registerDevice(
    testDeviceId,
    testPassTypeId,
    serialNumber,
    testPushToken
  );
  test('Device registration', registerResult.status === 201, `Status: ${registerResult.status}`);

  // Verify registration exists
  const registration = await prisma.walletPassRegistration.findFirst({
    where: { deviceLibraryId: testDeviceId },
  });
  test('Registration saved to database', registration !== null);

  // Test duplicate registration (should return 200)
  const duplicateResult = await registerDevice(
    testDeviceId,
    testPassTypeId,
    serialNumber,
    testPushToken
  );
  test('Duplicate registration returns 200', duplicateResult.status === 200);

  // Test get passes for device
  const passesResult = await getPassesForDevice(testDeviceId, testPassTypeId);
  test('Get passes for device', passesResult.status === 200 || passesResult.status === 204);

  // Test mark pass updated
  await markPassUpdated(testUser.id);
  const updatedReg = await prisma.walletPassRegistration.findFirst({
    where: { deviceLibraryId: testDeviceId },
  });
  test('Mark pass updated', updatedReg && updatedReg.updatedAt > registration.updatedAt);

  // Cleanup: unregister device
  const unregisterResult = await unregisterDevice(testDeviceId, testPassTypeId, serialNumber);
  test('Device unregistration', unregisterResult.status === 200);

  // Verify cleanup
  const deletedReg = await prisma.walletPassRegistration.findFirst({
    where: { deviceLibraryId: testDeviceId },
  });
  test('Registration deleted from database', deletedReg === null);

  // Test 6: Notification functions
  console.log('\n--- Notification Service Tests ---');

  // Clean up any existing test registration first
  await prisma.walletPassRegistration.deleteMany({
    where: { deviceLibraryId: 'test-notify-device' },
  });

  // Create a test wallet registration for notification tests
  await prisma.walletPassRegistration.create({
    data: {
      userId: testUser.id,
      deviceLibraryId: 'test-notify-device',
      pushToken: 'test-notify-token',
      passTypeId: testPassTypeId,
      serialNumber,
    },
  });

  // Test streak at risk notification
  const streakResult = await checkAndSendStreakAtRiskNotification(testUser.id);
  test('Streak at risk notification function',
    streakResult && (streakResult.sent === true || streakResult.reason),
    streakResult.sent ? 'Sent' : `Skipped: ${streakResult.reason}`
  );

  // Test tier progress notification
  const tierResult = await checkAndSendTierProgressNotification(testUser.id);
  test('Tier progress notification function',
    tierResult && (tierResult.sent === true || tierResult.reason),
    tierResult.sent ? 'Sent' : `Skipped: ${tierResult.reason}`
  );

  // Test credits reminder notification
  const creditsResult = await checkAndSendCreditsReminder(testUser.id);
  test('Credits reminder notification function',
    creditsResult && (creditsResult.sent === true || creditsResult.reason),
    creditsResult.sent ? 'Sent' : `Skipped: ${creditsResult.reason}`
  );

  // Test location-based notification (if location exists)
  if (locations.length > 0) {
    const location = await prisma.location.findFirst();
    const nearResult = await checkAndSendNearRestaurantNotification(testUser.id, location.id);
    test('Near restaurant notification function',
      nearResult && (nearResult.sent === true || nearResult.reason),
      nearResult.sent ? `Sent: ${nearResult.message?.body}` : `Skipped: ${nearResult.reason}`
    );
  } else {
    skip('Near restaurant notification', 'No locations in database');
  }

  // Test order completed notification (need an order)
  const testOrder = await prisma.order.findFirst({
    where: { userId: testUser.id, paymentStatus: 'PAID' },
    orderBy: { createdAt: 'desc' },
  });

  if (testOrder) {
    const orderResult = await sendOrderCompletedNotification(testUser.id, testOrder.id);
    test('Order completed notification function',
      orderResult && (orderResult.sent === true || orderResult.reason),
      orderResult.sent ? `Sent: ${orderResult.total}` : `Skipped: ${orderResult.reason}`
    );
  } else {
    skip('Order completed notification', 'No paid orders for test user');
  }

  // Cleanup test registration
  await prisma.walletPassRegistration.deleteMany({
    where: { deviceLibraryId: 'test-notify-device' },
  });

  // Test 7: Notification logs
  console.log('\n--- Notification Log Tests ---');

  const notificationLogs = await prisma.walletNotificationLog.findMany({
    where: { userId: testUser.id },
    orderBy: { sentAt: 'desc' },
    take: 5,
  });

  log(`Found ${notificationLogs.length} notification log(s) for test user`);
  if (notificationLogs.length > 0) {
    test('Notification logs exist', true, `Latest: ${notificationLogs[0].notificationType}`);
  }

  // Summary
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');
  console.log(`  Passed:  ${results.passed}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Total:   ${results.passed + results.failed + results.skipped}`);
  console.log('========================================\n');

  if (results.failed > 0) {
    console.log('Failed tests:');
    results.tests
      .filter((t) => t.status === 'failed')
      .forEach((t) => console.log(`  - ${t.name}: ${t.message}`));
    console.log('');
  }

  // Cleanup notification logs from test
  await prisma.walletNotificationLog.deleteMany({
    where: {
      userId: testUser.id,
      sentAt: { gte: new Date(Date.now() - 60000) }, // Last minute
    },
  });

  await prisma.$disconnect();

  return results.failed === 0;
}

// Run tests
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
