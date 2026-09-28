#!/usr/bin/env node
/**
 * Task G3 fix round 1: ensures the LIVE Stripe webhook
 * https://www.ohbeef.com/api/webhooks/stripe exists and puts its signing
 * secret on the Vercel webapp as STRIPE_WEBHOOK_SECRET (validated whsec_,
 * never printed). The live key is read from Railway @oh/api (STRIPE_SECRET_KEY)
 * and must be sk_live_/rk_live_.
 *
 *   node scripts/cutover-stripe-webhook.mjs --dry-run      # says exists / would-create / would-recreate
 *   node scripts/cutover-stripe-webhook.mjs                # creates it if missing (secret -> Vercel)
 *   node scripts/cutover-stripe-webhook.mjs --recreate     # an endpoint exists but its secret is not on Vercel:
 *                                                          # new endpoint, secret -> Vercel, THEN old endpoint deleted
 * Needs VERCEL_TOKEN in the environment and a working `railway` CLI.
 */
import { execFileSync } from "node:child_process";
import { upsertVercelEnv } from "../src/cutover/env-values.js";
import { railwayVars } from "../src/cutover/railway-env.js";
import { ensureStripeWebhook } from "../src/cutover/stripe-webhook.js";

const TEAM = "team_lcuKROVnRGMXAYN6Q3x44DKh";
const WEB_PROJECT = "prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const recreate = process.argv.includes("--recreate");
  if (!process.env.VERCEL_TOKEN) throw new Error("VERCEL_TOKEN is not set");
  const run = (args) => execFileSync("railway", args, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
  const stripeKey = railwayVars(run).STRIPE_SECRET_KEY;
  const res = await ensureStripeWebhook({
    stripeKey,
    dryRun,
    recreate,
    saveSecret: (secret) => upsertVercelEnv({ key: "STRIPE_WEBHOOK_SECRET", value: secret, projectId: WEB_PROJECT, teamId: TEAM, token: process.env.VERCEL_TOKEN, dryRun: false }),
  });
  console.log(`[stripe-webhook] ${res.action}${res.endpointId ? ` ${res.endpointId}` : ""}${res.action === "created" || res.action === "recreated" ? "; STRIPE_WEBHOOK_SECRET written to Vercel webapp (production)" : ""}`);
}

main().catch((err) => {
  console.error(`[stripe-webhook] STOP: ${err?.message ?? err}`);
  process.exit(1);
});
