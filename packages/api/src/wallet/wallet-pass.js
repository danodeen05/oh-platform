/**
 * Apple Wallet Pass Generator for Oh! Loyalty Program
 *
 * This module generates Apple Wallet (.pkpass) loyalty cards for members.
 *
 * SETUP REQUIRED:
 * 1. Create an Apple Developer account ($99/year)
 * 2. Create a Pass Type ID in Apple Developer Portal
 * 3. Generate certificates:
 *    - Pass Type ID Certificate (.p12)
 *    - Apple WWDR Certificate
 * 4. Set environment variables:
 *    - APPLE_PASS_TYPE_ID (e.g., pass.com.oh.loyalty)
 *    - APPLE_TEAM_ID (your 10-character team ID)
 *
 *    Option A - File paths (for local development):
 *    - APPLE_PASS_CERT_PATH (path to .pem cert file)
 *    - APPLE_PASS_KEY_PATH (path to .pem key file)
 *    - APPLE_WWDR_CERT_PATH (path to WWDR certificate)
 *
 *    Option B - Base64 encoded (for production/Railway):
 *    - APPLE_PASS_CERT_BASE64 (base64 encoded cert PEM)
 *    - APPLE_PASS_KEY_BASE64 (base64 encoded key PEM)
 *    - APPLE_WWDR_CERT_BASE64 (base64 encoded WWDR PEM)
 *
 * For testing without certificates, use the demo mode.
 */

import { PKPass } from 'passkit-generator';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tier configuration - using olive tones matching website
const TIER_CONFIG = {
  CHOPSTICK: {
    name: 'Chopstick',
    cashback: '1%',
    color: 'rgb(124, 122, 103)', // Subtle olive (#7C7A67)
  },
  NOODLE_MASTER: {
    name: 'Noodle Master',
    cashback: '2%',
    color: 'rgb(100, 98, 82)', // Darker olive
  },
  BEEF_BOSS: {
    name: 'Beef Boss',
    cashback: '3%',
    color: 'rgb(75, 73, 60)', // Darkest olive
  },
};

/**
 * Generate authentication token for wallet pass web service
 * Used to verify requests from Apple Wallet
 */
export function generateAuthToken(userId) {
  const secret = process.env.WALLET_AUTH_SECRET || 'default-wallet-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(userId)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Check if Apple Wallet certificates are configured
 * Supports both file paths (local) and base64 env vars (production)
 */
export function isAppleWalletConfigured() {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const teamId = process.env.APPLE_TEAM_ID;

  // Check for base64 encoded certs (production)
  const certBase64 = process.env.APPLE_PASS_CERT_BASE64;
  const keyBase64 = process.env.APPLE_PASS_KEY_BASE64;
  const wwdrBase64 = process.env.APPLE_WWDR_CERT_BASE64;

  if (passTypeId && teamId && certBase64 && keyBase64 && wwdrBase64) {
    return true;
  }

  // Check for file paths (local development)
  const certPath = process.env.APPLE_PASS_CERT_PATH;
  const keyPath = process.env.APPLE_PASS_KEY_PATH;
  const wwdrPath = process.env.APPLE_WWDR_CERT_PATH;

  return !!(passTypeId && teamId && certPath && keyPath && wwdrPath &&
            existsSync(certPath) && existsSync(keyPath) && existsSync(wwdrPath));
}

/**
 * Load certificates from either base64 env vars or file paths
 */
function loadCertificates() {
  // Try base64 first (production)
  if (process.env.APPLE_PASS_CERT_BASE64) {
    return {
      signerCert: Buffer.from(process.env.APPLE_PASS_CERT_BASE64, 'base64'),
      signerKey: Buffer.from(process.env.APPLE_PASS_KEY_BASE64, 'base64'),
      wwdr: Buffer.from(process.env.APPLE_WWDR_CERT_BASE64, 'base64'),
    };
  }

  // Fall back to file paths (local development)
  return {
    signerCert: readFileSync(process.env.APPLE_PASS_CERT_PATH),
    signerKey: readFileSync(process.env.APPLE_PASS_KEY_PATH),
    wwdr: readFileSync(process.env.APPLE_WWDR_CERT_PATH),
  };
}

/**
 * Generate an Apple Wallet pass for a user
 *
 * @param {Object} user - User object from database
 * @param {string} user.id - User ID
 * @param {string} user.name - User name
 * @param {string} user.email - User email
 * @param {string} user.membershipTier - CHOPSTICK, NOODLE_MASTER, or BEEF_BOSS
 * @param {number} user.creditsCents - Credits in cents
 * @param {number} user.lifetimeOrderCount - Total orders
 * @param {number} user.currentStreak - Current order streak
 * @param {string} user.referralCode - User's referral code
 * @param {Date} user.createdAt - Account creation date
 * @param {Array} locations - Array of location objects with lat, lng, notificationRadiusMiles, availablePods, avgWaitMinutes
 * @returns {Promise<Buffer>} - .pkpass file buffer
 */
export async function generateAppleWalletPass(user, locations = []) {
  if (!isAppleWalletConfigured()) {
    throw new Error('Apple Wallet certificates not configured. See wallet-pass.js for setup instructions.');
  }

  const tierConfig = TIER_CONFIG[user.membershipTier] || TIER_CONFIG.CHOPSTICK;
  const creditsFormatted = `$${(user.creditsCents / 100).toFixed(2)}`;
  const memberSince = new Date(user.createdAt).getFullYear().toString();

  // Load certificates (from base64 env vars or file paths)
  const { signerCert, signerKey, wwdr } = loadCertificates();

  // Create the pass using the model directory for images
  const modelPath = join(__dirname, 'pass-template.pass');

  // Build locations for geofencing notifications
  // Note: This data is a snapshot at pass generation time. For live updates,
  // push notifications should be sent when availability changes significantly.
  const passLocations = locations.map(loc => {
    const availablePods = loc.availablePods ?? 0;
    const avgWaitMinutes = loc.avgWaitMinutes ?? 0;
    const locationName = loc.name || 'Oh!';

    // Build dynamic notification message
    let relevantText = `${locationName} is nearby!`;
    if (availablePods > 0) {
      relevantText += ` Currently, we have ${availablePods} pod${availablePods !== 1 ? 's' : ''} available`;
      if (avgWaitMinutes > 0) {
        relevantText += ` and ${avgWaitMinutes} min wait time`;
      } else {
        relevantText += ` with no wait`;
      }
      relevantText += `.`;
    } else if (avgWaitMinutes > 0) {
      relevantText += ` Currently, ${avgWaitMinutes} min wait time.`;
    }

    // Add credit balance if user has credits
    if (user.creditsCents > 0) {
      relevantText += ` Stop by and use your ${creditsFormatted} credit!`;
    } else {
      relevantText += ` Stop by for some delicious noodles!`;
    }

    // Location schema requires latitude/longitude, relevantText is optional
    return {
      latitude: loc.lat,
      longitude: loc.lng,
      relevantText,
    };
  });

  // Calculate max notification radius from locations (use largest radius)
  // Convert miles to meters (1 mile = 1609.34 meters)
  const maxRadiusMiles = Math.max(...locations.map(loc => loc.notificationRadiusMiles || 20), 20);
  const maxDistanceMeters = maxRadiusMiles * 1609.34;

  // passkit-generator v3 uses PKPass.from() with model path
  // NOTE: locations must be set via setLocations() method, not in the override object
  const pass = await PKPass.from(
    {
      model: modelPath,
      certificates: {
        signerCert,
        signerKey,
        wwdr,
      },
    },
    {
      // Override pass.json values
      serialNumber: `oh-member-${user.id}`,
      description: 'Oh! Membership Card',
      organizationName: 'Oh!',
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      backgroundColor: tierConfig.color,
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(255, 255, 255)',
      logoText: 'Oh!',
      // Web service for push updates
      webServiceURL: process.env.WALLET_WEB_SERVICE_URL || 'https://api.ohbeef.com/wallet',
      authenticationToken: generateAuthToken(user.id),
      // maxDistance is a pass-level property (in meters)
      maxDistance: maxDistanceMeters,
    }
  );

  // Set geofencing locations using the setLocations method
  // This is required because locations can't be passed in the override object
  if (passLocations.length > 0) {
    pass.setLocations(...passLocations);
  }

  // Set pass type - using generic for better layout control
  pass.type = 'generic';

  // Header - Credit balance (top right)
  pass.headerFields.push({
    key: 'balance',
    label: 'CREDIT BALANCE',
    value: creditsFormatted,
  });

  // Primary - Membership tier (large, center)
  pass.primaryFields.push({
    key: 'tier',
    label: 'CURRENT MEMBERSHIP TIER',
    value: tierConfig.name,
  });

  // Secondary - Stats row
  pass.secondaryFields.push(
    {
      key: 'orders',
      label: 'ORDERS',
      value: user.lifetimeOrderCount.toString(),
    },
    {
      key: 'cashback',
      label: 'CASHBACK',
      value: tierConfig.cashback,
    },
    {
      key: 'streak',
      label: 'STREAK',
      value: `${user.currentStreak}`,
    }
  );

  // Back of pass - Additional info (use unique keys to avoid conflicts with front fields)
  pass.backFields.push(
    {
      key: 'member-name',
      label: 'Member Name',
      value: user.name || 'Oh! Member',
    },
    {
      key: 'lifetime-orders',
      label: 'Lifetime Orders',
      value: user.lifetimeOrderCount.toString(),
    },
    {
      key: 'cashback-rate',
      label: 'Current Cashback Rate',
      value: tierConfig.cashback,
    },
    {
      key: 'longest-streak',
      label: 'Longest Streak',
      value: `${user.currentStreak} day${user.currentStreak !== 1 ? 's' : ''}`,
    },
    {
      key: 'member-since',
      label: 'Member Since',
      value: memberSince,
    },
    {
      key: 'referral-code',
      label: 'Your Referral Link',
      value: `https://www.ohbeef.com/order?ref=${user.referralCode}`,
      dataDetectorTypes: ['PKDataDetectorTypeLink'],
    },
    {
      key: 'website',
      label: 'Oh! Website',
      value: 'https://www.ohbeef.com',
      dataDetectorTypes: ['PKDataDetectorTypeLink'],
    },
    {
      key: 'support',
      label: 'Support',
      value: 'support@ohbeef.com',
      dataDetectorTypes: ['PKDataDetectorTypeLink'],
    }
  );

  // QR code with user ID for scanning at restaurant
  pass.setBarcodes({
    message: user.id,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText: user.referralCode,
  });

  // Generate the .pkpass file
  const buffer = pass.getAsBuffer();
  return buffer;
}

/**
 * Generate a demo pass for testing (no certificates required)
 * Returns a JSON representation of what the pass would contain
 */
export function generateDemoPassData(user) {
  const tierConfig = TIER_CONFIG[user.membershipTier] || TIER_CONFIG.CHOPSTICK;
  const creditsFormatted = `$${(user.creditsCents / 100).toFixed(2)}`;
  const memberSince = new Date(user.createdAt).getFullYear().toString();

  return {
    _demo: true,
    _message: 'This is demo pass data. Configure Apple certificates to generate real .pkpass files.',
    passTypeIdentifier: 'pass.com.oh.loyalty',
    serialNumber: `oh-member-${user.id}`,
    organizationName: 'Oh!',
    description: 'Oh! Membership Card',
    backgroundColor: tierConfig.color,
    fields: {
      header: {
        tier: tierConfig.name,
      },
      primary: {
        balance: creditsFormatted,
      },
      secondary: {
        orders: user.lifetimeOrderCount.toString(),
        cashback: tierConfig.cashback,
      },
      auxiliary: {
        streak: `${user.currentStreak} day${user.currentStreak !== 1 ? 's' : ''}`,
      },
      back: {
        memberName: user.name || 'Oh! Member',
        memberSince,
        referralCode: user.referralCode,
        website: 'https://oh.restaurant',
        support: 'hello@oh.restaurant',
      },
    },
    barcode: {
      type: 'QR',
      message: user.id,
      altText: user.referralCode,
    },
  };
}

/**
 * Google Wallet Pass Generation
 *
 * Google Wallet uses a different approach - JWT-based passes via Google Pay API.
 *
 * SETUP REQUIRED:
 * 1. Create a Google Cloud project
 * 2. Enable Google Wallet API
 * 3. Create a service account with Wallet permissions
 * 4. Create a Loyalty Class in Google Pay & Wallet Console
 * 5. Set environment variables:
 *    - GOOGLE_WALLET_ISSUER_ID
 *    - GOOGLE_WALLET_SERVICE_ACCOUNT_KEY (path to JSON key file)
 *    - GOOGLE_WALLET_LOYALTY_CLASS_ID
 */

export function isGoogleWalletConfigured() {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY &&
    existsSync(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY)
  );
}

/**
 * Generate a Google Wallet "Add to Wallet" URL
 * This creates a JWT that can be used with the Google Wallet save link
 */
export async function generateGoogleWalletLink(user) {
  if (!isGoogleWalletConfigured()) {
    // Return demo link for testing
    return generateDemoGoogleWalletData(user);
  }

  // Full implementation would use @google-cloud/wallet or googleapis
  // For now, return the structure needed
  const tierConfig = TIER_CONFIG[user.membershipTier] || TIER_CONFIG.CHOPSTICK;

  const loyaltyObject = {
    id: `${process.env.GOOGLE_WALLET_ISSUER_ID}.oh-member-${user.id}`,
    classId: `${process.env.GOOGLE_WALLET_ISSUER_ID}.${process.env.GOOGLE_WALLET_LOYALTY_CLASS_ID}`,
    state: 'ACTIVE',
    accountId: user.id,
    accountName: user.name || 'Oh! Member',
    loyaltyPoints: {
      label: 'Credits',
      balance: {
        money: {
          currencyCode: 'USD',
          micros: user.creditsCents * 10000, // Convert cents to micros
        },
      },
    },
    secondaryLoyaltyPoints: {
      label: 'Orders',
      balance: {
        int: user.lifetimeOrderCount,
      },
    },
    barcode: {
      type: 'QR_CODE',
      value: user.id,
      alternateText: user.referralCode,
    },
    heroImage: {
      sourceUri: {
        uri: 'https://oh.restaurant/wallet-hero.png',
      },
    },
    textModulesData: [
      {
        header: 'Tier',
        body: tierConfig.name,
      },
      {
        header: 'Cashback Rate',
        body: tierConfig.cashback,
      },
      {
        header: 'Referral Code',
        body: user.referralCode,
      },
    ],
  };

  // In production, you would sign this as a JWT and return the save link
  // return `https://pay.google.com/gp/v/save/${signedJwt}`;

  return {
    loyaltyObject,
    _message: 'Configure Google Wallet credentials to generate save links',
  };
}

function generateDemoGoogleWalletData(user) {
  const tierConfig = TIER_CONFIG[user.membershipTier] || TIER_CONFIG.CHOPSTICK;

  return {
    _demo: true,
    _message: 'This is demo Google Wallet data. Configure Google Cloud credentials for real passes.',
    platform: 'google',
    loyaltyObject: {
      accountId: user.id,
      accountName: user.name || 'Oh! Member',
      tier: tierConfig.name,
      credits: `$${(user.creditsCents / 100).toFixed(2)}`,
      orders: user.lifetimeOrderCount,
      cashback: tierConfig.cashback,
      referralCode: user.referralCode,
    },
  };
}
