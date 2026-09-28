/**
 * Wallet Notification Cron Jobs
 *
 * This script runs scheduled wallet notification jobs.
 * Can be run as a standalone service or triggered via HTTP endpoints.
 *
 * CRON SCHEDULE:
 * - Streak at Risk: Daily at 5pm local time
 * - Challenge Deadlines: Daily at 10am local time
 * - Credits Reminder: Weekly on Monday at 10am
 * - Tier Progress: After order completion (triggered via API)
 * - Expire Credits: Daily at 3am (membership/credits.js expireLots, then
 *   sendExpiryWarnings for lots about to expire - Task F2)
 * - Membership Sweep: Daily at 3:10am (membership/engine.js sweepUnprocessedCompletedOrders)
 * - Quarterly Perk: Daily at 3:05am, idempotent per quarter
 *   (membership/engine.js issueQuarterlyPerks)
 * - Expire Meal Gifts: every 15 minutes, idempotent (orders/meal-gift-expire.js):
 *   funded gifts not taken by 9pm go back to the giver as MEAL_GIFT credit
 *
 * USAGE:
 * - As a service: node src/cron/wallet-cron.js
 * - Via Railway cron: Configure cron jobs to call the HTTP endpoints
 * - Via external cron (e.g., cron-job.org): POST to endpoints with x-cron-secret header
 */

import { PrismaClient } from '@oh/db';
import {
  sendBatchStreakAtRiskNotifications,
  sendBatchCreditsReminder,
  checkAndSendChallengeDeadlineNotifications,
} from '../wallet/wallet-notification-service.js';
import { expireLots, sendExpiryWarnings } from '../membership/credits.js';
import { issueQuarterlyPerks, sweepUnprocessedCompletedOrders } from '../membership/engine.js';
import { expireMealGifts } from '../orders/meal-gift-expire.js';

const prisma = new PrismaClient();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('CRON_SECRET must be set in production'); })() : 'dev-cron-secret-DO-NOT-USE-IN-PROD');

/**
 * Run a cron job directly (for standalone service mode)
 */
async function runJob(jobName) {
  console.log(`[CRON] Running ${jobName} at ${new Date().toISOString()}`);

  try {
    let result;

    switch (jobName) {
      case 'streak':
        result = await sendBatchStreakAtRiskNotifications();
        console.log(`[CRON] Streak notifications: ${result.sent} sent, ${result.skipped} skipped`);
        break;

      case 'challenge':
        result = await checkAndSendChallengeDeadlineNotifications();
        const sent = result.filter((r) => r.sent).length;
        console.log(`[CRON] Challenge notifications: ${sent} sent`);
        break;

      case 'credits':
        result = await sendBatchCreditsReminder();
        console.log(`[CRON] Credits notifications: ${result.sent} sent, ${result.skipped} skipped`);
        break;

      case 'expire-credits':
        result = await expireLots(prisma);
        console.log(`[CRON] Expired ${result} credit lot(s)`);
        // Task F2: warn members whose credit is about to expire (once per lot,
        // ever - see membership/credits.js sendExpiryWarnings/markExpiryWarned).
        // Honors SUPPORT_NOTIFY the same way every other customer-SMS path does.
        {
          const warned = await sendExpiryWarnings(prisma);
          console.log(`[CRON] Credit-expiry warnings: ${warned.sent} sent, ${warned.warned} lot(s) considered`);
        }
        break;

      case 'quarterly-perk':
        result = await issueQuarterlyPerks(prisma);
        console.log(`[CRON] Issued ${result} quarterly perk reward(s)`);
        break;

      case 'membership-sweep':
        result = await sweepUnprocessedCompletedOrders(prisma);
        console.log(`[CRON] Membership sweep processed ${result} completed order(s)`);
        break;

      case 'expire-meal-gifts':
        // Final review I2: claim + MEAL_GIFT return in one transaction per gift.
        result = await expireMealGifts(prisma);
        console.log(
          `[CRON] Expired ${result.length} meal gift(s), returned ${result.filter((g) => g.refunded).length} to their givers`,
        );
        break;

      default:
        console.error(`[CRON] Unknown job: ${jobName}`);
        return false;
    }

    console.log(`[CRON] ${jobName} completed successfully`);
    return true;
  } catch (error) {
    console.error(`[CRON] ${jobName} failed:`, error);
    // `run` mode exits non-zero on this (Task G3 fix round 1), so a Railway cron shows the failure.
    return false;
  }
}

/**
 * Schedule calculator - determines if a job should run based on current time
 */
function shouldRunJob(jobName) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday

  switch (jobName) {
    case 'streak':
      // Run at 5pm (17:00)
      return hour === 17 && minute < 5;

    case 'challenge':
      // Run at 10am
      return hour === 10 && minute < 5;

    case 'credits':
      // Run on Monday at 10am
      return dayOfWeek === 1 && hour === 10 && minute < 5;

    case 'expire-credits':
      // Run daily at 3am (credit lots are keyed on real calendar days, not local rush hours)
      return hour === 3 && minute < 5;

    case 'quarterly-perk':
      // Run daily at 3:05am; issueQuarterlyPerks is idempotent per quarter,
      // so running it every day just costs a no-op after the first success.
      return hour === 3 && minute >= 5 && minute < 10;

    case 'membership-sweep':
      // Daily at 3:10am, after expire-credits; idempotent via onOrderCompleted's claim.
      return hour === 3 && minute >= 10 && minute < 15;

    case 'expire-meal-gifts':
      // Every 15 minutes: gifts lapse at 9pm Denver, which is a different server
      // hour across DST, so poll instead of pinning an hour. Idempotent (the claim).
      return minute % 15 === 0;

    default:
      return false;
  }
}

/**
 * Main loop for standalone service mode
 * Checks every minute and runs jobs at scheduled times
 */
async function startCronService() {
  console.log('[CRON] Starting wallet notification cron service...');
  console.log('[CRON] Schedule:');
  console.log('  - Streak at Risk: Daily at 5pm');
  console.log('  - Challenge Deadlines: Daily at 10am');
  console.log('  - Credits Reminder: Monday at 10am');
  console.log('  - Expire Credits: Daily at 3am');
  console.log('  - Quarterly Perk: Daily at 3:05am (idempotent per quarter)');
  console.log('  - Membership Sweep: Daily at 3:10am (idempotent)');
  console.log('  - Expire Meal Gifts: every 15 minutes (idempotent)');

  // Run immediately on startup for testing
  if (process.env.RUN_ON_STARTUP === 'true') {
    console.log('[CRON] Running all jobs on startup (RUN_ON_STARTUP=true)');
    await runJob('streak');
    await runJob('challenge');
    await runJob('credits');
    await runJob('expire-credits');
    await runJob('quarterly-perk');
    await runJob('expire-meal-gifts');
  }

  // Check every minute
  setInterval(async () => {
    if (shouldRunJob('streak')) {
      await runJob('streak');
    }
    if (shouldRunJob('challenge')) {
      await runJob('challenge');
    }
    if (shouldRunJob('credits')) {
      await runJob('credits');
    }
    if (shouldRunJob('expire-credits')) {
      await runJob('expire-credits');
    }
    if (shouldRunJob('quarterly-perk')) {
      await runJob('quarterly-perk');
    }
    if (shouldRunJob('membership-sweep')) {
      await runJob('membership-sweep');
    }
    if (shouldRunJob('expire-meal-gifts')) {
      await runJob('expire-meal-gifts');
    }
  }, 60000); // Check every minute
}

/**
 * HTTP trigger mode - call API endpoints
 * Use this for external cron services
 */
async function triggerViaHttp(endpoint) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-cron-secret': CRON_SECRET,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log(`[CRON] ${endpoint} result:`, result);
    return result;
  } catch (error) {
    console.error(`[CRON] ${endpoint} failed:`, error);
    throw error;
  }
}

// Export for programmatic use
export { runJob, startCronService, triggerViaHttp };

// Run as standalone service if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];

  if (mode === 'service') {
    // Run as continuous service
    startCronService();
  } else if (mode === 'run') {
    // Run specific job immediately
    const job = process.argv[3];
    if (!job) {
      console.log('Usage: node wallet-cron.js run <streak|challenge|credits|expire-credits|quarterly-perk|membership-sweep|expire-meal-gifts>');
      process.exit(1);
    }
    runJob(job).then(async (ok) => {
      await prisma.$disconnect();
      process.exit(ok ? 0 : 1);
    });
  } else if (mode === 'trigger') {
    // Trigger via HTTP
    const endpoint = process.argv[3];
    if (!endpoint) {
      console.log('Usage: node wallet-cron.js trigger <endpoint>');
      console.log('Example: node wallet-cron.js trigger /cron/wallet-streak-notifications');
      process.exit(1);
    }
    triggerViaHttp(endpoint).then(() => {
      process.exit(0);
    }).catch(() => {
      process.exit(1);
    });
  } else {
    console.log('Wallet Notification Cron Service');
    console.log('');
    console.log('Usage:');
    console.log('  node wallet-cron.js service              Start as continuous service');
    console.log('  node wallet-cron.js run <job>            Run a specific job immediately');
    console.log('  node wallet-cron.js trigger <endpoint>   Trigger job via HTTP');
    console.log('');
    console.log('Jobs: streak, challenge, credits, expire-credits, quarterly-perk, membership-sweep, expire-meal-gifts');
    console.log('');
    console.log('Environment variables:');
    console.log('  API_URL          API base URL (default: http://localhost:3001)');
    console.log('  CRON_SECRET      Secret for HTTP authentication');
    console.log('  RUN_ON_STARTUP   Run all jobs on startup (default: false)');
  }
}
