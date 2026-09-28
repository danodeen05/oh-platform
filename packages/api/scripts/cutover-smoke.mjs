#!/usr/bin/env node
/**
 * Task G3: release-2 smoke test (the checks live in src/cutover/smoke.js).
 * Read-only except one Chappy guest question. Exit code 1 if any check fails.
 *
 *   node packages/api/scripts/cutover-smoke.mjs --api=https://api.ohbeef.com --web=https://www.ohbeef.com
 *   node packages/api/scripts/cutover-smoke.mjs --api=http://localhost:4100 --web=http://localhost:3100 --no-chappy
 */
import { buildChecks, runChecks } from "../src/cutover/smoke.js";

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const api = arg("api");
const web = arg("web");
if (!api || !web) {
  console.error("usage: cutover-smoke.mjs --api=<api base> --web=<web base> [--no-chappy]");
  process.exit(2);
}
const checks = buildChecks({ api, web, chappy: !process.argv.includes("--no-chappy") });
const { passed, failed } = await runChecks(checks);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
