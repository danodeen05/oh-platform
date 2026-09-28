#!/usr/bin/env node
/**
 * Task G3: texts the owner that release 2 is live. LAST runbook step, once.
 * Dry run unless --send. Uses the API's sendSMS (Twilio) and
 * ADMIN_PHONE_NUMBER; honors SUPPORT_NOTIFY (off | log | live).
 *
 *   railway run --service "@oh/api" node scripts/notify-owner-release.mjs          # dry run
 *   railway run --service "@oh/api" node scripts/notify-owner-release.mjs --send   # sends
 */
import { sendSMS } from "../src/notifications.js";
import { sendOwnerReleaseNotice, OWNER_RELEASE_TEXT } from "../src/cutover/owner-notice.js";

const dryRun = !process.argv.includes("--send");
try {
  const result = await sendOwnerReleaseNotice({ env: process.env, send: sendSMS, dryRun });
  console.log(`[owner-notice] ${result.action} to ${result.to}${result.detail ? ` (${result.detail})` : ""}: "${OWNER_RELEASE_TEXT}"`);
  process.exit(result.action === "failed" ? 1 : 0);
} catch (err) {
  console.error(`[owner-notice] ${err?.message ?? err}`);
  process.exit(1);
}
