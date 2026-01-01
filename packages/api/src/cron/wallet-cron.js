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

const prisma = new PrismaClient();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';

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

      default:
        console.error(`[CRON] Unknown job: ${jobName}`);
        return;
    }

    console.log(`[CRON] ${jobName} completed successfully`);
  } catch (error) {
    console.error(`[CRON] ${jobName} failed:`, error);
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

  // Run immediately on startup for testing
  if (process.env.RUN_ON_STARTUP === 'true') {
    console.log('[CRON] Running all jobs on startup (RUN_ON_STARTUP=true)');
    await runJob('streak');
    await runJob('challenge');
    await runJob('credits');
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
      console.log('Usage: node wallet-cron.js run <streak|challenge|credits>');
      process.exit(1);
    }
    runJob(job).then(() => {
      prisma.$disconnect();
      process.exit(0);
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
    console.log('Jobs: streak, challenge, credits');
    console.log('');
    console.log('Environment variables:');
    console.log('  API_URL          API base URL (default: http://localhost:3001)');
    console.log('  CRON_SECRET      Secret for HTTP authentication');
    console.log('  RUN_ON_STARTUP   Run all jobs on startup (default: false)');
  }
}
