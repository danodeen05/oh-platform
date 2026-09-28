#!/usr/bin/env node
/**
 * Task G3: texts the owner that release 2 is live. LAST runbook step, once.
 * Dry run unless --send. Uses the API's sendSMS (Twilio) and
 * ADMIN_PHONE_NUMBER; honors SUPPORT_NOTIFY (off | log | live).
 *
 * The Twilio variables come from the environment, or with --from-railway
 * from Railway @oh/api (read with the railway CLI into this process only:
 * never printed, never in argv). Only TWILIO_*, ADMIN_PHONE_NUMBER and
 * SUPPORT_NOTIFY are taken.
 *
 *   node scripts/notify-owner-release.mjs --from-railway          # dry run: masked number and the text
 *   node scripts/notify-owner-release.mjs --from-railway --send   # sends once
 */
import { execFileSync } from "node:child_process";
import { railwayVars } from "../src/cutover/railway-env.js";

const dryRun = !process.argv.includes("--send");
try {
  if (process.argv.includes("--from-railway")) {
    const vars = railwayVars((args) => execFileSync("railway", args, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] }));
    for (const [k, v] of Object.entries(vars)) {
      if (/^(TWILIO_[A-Z_]+|ADMIN_PHONE_NUMBER|SUPPORT_NOTIFY)$/.test(k) && typeof v === "string") process.env[k] = v;
    }
  }
  // Imported after the env is filled: notifications.js builds its Twilio client at import.
  const { sendSMS } = await import("../src/notifications.js");
  const { sendOwnerReleaseNotice, OWNER_RELEASE_TEXT } = await import("../src/cutover/owner-notice.js");
  const result = await sendOwnerReleaseNotice({ env: process.env, send: sendSMS, dryRun });
  console.log(`[owner-notice] ${result.action} to ${result.to}${result.detail ? ` (${result.detail})` : ""}: "${OWNER_RELEASE_TEXT}"`);
  process.exit(result.action === "failed" ? 1 : 0);
} catch (err) {
  console.error(`[owner-notice] ${err?.message ?? err}`);
  process.exit(1);
}
