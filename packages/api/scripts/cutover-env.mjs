#!/usr/bin/env node
/**
 * Task G3 fix round 1: the ONLY way the cutover writes a production variable.
 * The value is validated (non-empty, and the known format for the key, e.g.
 * whsec_ for STRIPE_WEBHOOK_SECRET) and the script exits non-zero BEFORE
 * writing when it is not. Values are never printed or put in argv.
 *
 * Value source (exactly one):
 *   (stdin)                    paste after `read -rs V` and pipe: printf %s "$V" | node ...
 *   --from-railway=<KEY>       copy the current value of <KEY> on Railway @oh/api
 *   --generate                 32 random bytes as hex (ADMIN_API_KEY, CRON_SECRET)
 *
 * Targets:
 *   --target=railway           Railway @oh/api (railway CLI, value on stdin, --skip-deploys, read back)
 *   --target=vercel-web        Vercel webapp project, production, encrypted (needs VERCEL_TOKEN)
 *
 *   node scripts/cutover-env.mjs --target=railway --key=API_PUBLIC_URL --dry-run < <(printf %s https://api.ohbeef.com)
 *   node scripts/cutover-env.mjs --target=vercel-web --key=ADMIN_API_KEY --from-railway=ADMIN_API_KEY
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describeValue, upsertVercelEnv, validateEnvValue } from "../src/cutover/env-values.js";
import { railwaySet, railwayVars } from "../src/cutover/railway-env.js";

const TEAM = "team_lcuKROVnRGMXAYN6Q3x44DKh";
const WEB_PROJECT = "prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0";

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const run = (args, input) => execFileSync("railway", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] });

async function main() {
  const target = arg("target");
  const key = arg("key");
  const dryRun = process.argv.includes("--dry-run");
  const fromRailway = arg("from-railway");
  const generate = process.argv.includes("--generate");
  if (!["railway", "vercel-web"].includes(target)) throw new Error("--target must be railway or vercel-web");
  if (!key) throw new Error("--key is required");
  if ([fromRailway, generate].filter(Boolean).length > 1) throw new Error("pick one value source");

  let value;
  if (fromRailway) value = railwayVars(run)[fromRailway];
  else if (generate) value = randomBytes(32).toString("hex");
  else {
    if (process.stdin.isTTY) throw new Error("no value: pipe it on stdin, or use --from-railway / --generate");
    value = readFileSync(0, "utf8").replace(/\r?\n$/, "");
  }
  validateEnvValue(key, value); // exits non-zero below, before any write

  const res =
    target === "railway"
      ? railwaySet(run, { key, value, dryRun })
      : await upsertVercelEnv({ key, value, projectId: WEB_PROJECT, teamId: TEAM, token: process.env.VERCEL_TOKEN, dryRun });
  console.log(`[cutover-env] ${target} ${key} = ${describeValue(value)}: ${res.written ? "WRITTEN" : "valid (dry run, not written)"}`);
}

main().catch((err) => {
  console.error(`[cutover-env] STOP, nothing written: ${err?.message ?? err}`);
  process.exit(1);
});
