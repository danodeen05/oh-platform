/**
 * Task G3 fix round 1: env writes validate before writing; the Stripe webhook
 * secret goes to Vercel before any old endpoint is deleted, and a failed save
 * removes the new endpoint again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeValue, upsertVercelEnv, validateEnvValue } from "../env-values.js";
import { railwaySet, railwayVars } from "../railway-env.js";
import { ensureStripeWebhook } from "../stripe-webhook.js";

const WHSEC = "whsec_abcdefghijklmnopqrstuvwxyz012345";

test("validateEnvValue refuses empty, whitespace and wrong formats", () => {
  assert.throws(() => validateEnvValue("STRIPE_WEBHOOK_SECRET", ""), /empty/);
  assert.throws(() => validateEnvValue("STRIPE_WEBHOOK_SECRET", undefined), /empty/);
  assert.throws(() => validateEnvValue("STRIPE_WEBHOOK_SECRET", "sk_live_abc"), /whsec_/);
  assert.throws(() => validateEnvValue("STRIPE_WEBHOOK_SECRET", `${WHSEC}\n`), /whitespace/);
  assert.ok(validateEnvValue("STRIPE_WEBHOOK_SECRET", WHSEC));
  assert.throws(() => validateEnvValue("ADMIN_API_KEY", "short"), /32\+/);
  assert.ok(validateEnvValue("ADMIN_API_KEY", "a".repeat(64)));
  assert.throws(() => validateEnvValue("API_PUBLIC_URL", "https://api.ohbeef.com/"), /trailing slash/);
  assert.ok(validateEnvValue("API_PUBLIC_URL", "https://api.ohbeef.com"));
  assert.throws(() => validateEnvValue("SUPPORT_NOTIFY", "yes"), /live, log or off/);
  assert.throws(() => validateEnvValue("TWILIO_AUTH_TOKEN", "abc"), /32-hex/);
  assert.throws(() => validateEnvValue("CHAPPY_LIMITS_JSON", "[1]"), /object/);
  assert.ok(validateEnvValue("CHAPPY_LIMITS_JSON", '{"messages":{"max":30}}'));
  assert.ok(validateEnvValue("SOME_OTHER_VAR", "x"));
  assert.ok(validateEnvValue("RATE_LIMIT_MAX", "1500"));
  assert.throws(() => validateEnvValue("RATE_LIMIT_MAX", "0"), /positive integer/);
  assert.throws(() => validateEnvValue("RATE_LIMIT_MAX", "lots"), /positive integer/);
  assert.ok(validateEnvValue("RATE_LIMIT_WINDOW", "1 minute"));
  assert.equal(describeValue(WHSEC), `whsec_... (${WHSEC.length} chars)`);
  assert.ok(!describeValue("a".repeat(64)).includes("aaaa"));
});

test("upsertVercelEnv makes no request for a bad value or a dry run", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 201, json: async () => ({}) };
  };
  const base = { projectId: "prj", teamId: "team", token: "t", fetchImpl };
  await assert.rejects(upsertVercelEnv({ ...base, key: "STRIPE_WEBHOOK_SECRET", value: "", dryRun: false }), /empty/);
  await assert.rejects(upsertVercelEnv({ ...base, token: "", key: "STRIPE_WEBHOOK_SECRET", value: WHSEC, dryRun: false }), /VERCEL_TOKEN/);
  assert.deepEqual(await upsertVercelEnv({ ...base, key: "STRIPE_WEBHOOK_SECRET", value: WHSEC, dryRun: true }), { written: false, dryRun: true });
  assert.equal(calls.length, 0);
  await upsertVercelEnv({ ...base, key: "STRIPE_WEBHOOK_SECRET", value: WHSEC, dryRun: false });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { key: "STRIPE_WEBHOOK_SECRET", value: WHSEC, type: "encrypted", target: ["production"] });
  assert.match(calls[0].url, /upsert=true/);
});

test("railwaySet validates, writes on stdin (not argv), and reads back", () => {
  const vars = { STRIPE_SECRET_KEY: "sk_live_x" };
  const calls = [];
  const run = (args, input) => {
    calls.push({ args, input });
    if (args[1] === "set") vars[args[2]] = input;
    return JSON.stringify(vars);
  };
  assert.throws(() => railwaySet(run, { key: "API_PUBLIC_URL", value: "", dryRun: false }), /empty/);
  assert.equal(calls.length, 0);
  railwaySet(run, { key: "API_PUBLIC_URL", value: "https://api.ohbeef.com", dryRun: false });
  assert.ok(calls[0].args.includes("--stdin") && calls[0].args.includes("--skip-deploys"));
  assert.ok(!calls[0].args.join(" ").includes("https://api.ohbeef.com"), "value never in argv");
  assert.equal(railwayVars(run).API_PUBLIC_URL, "https://api.ohbeef.com");
  const broken = (args, input) => (args[1] === "set" ? "" : JSON.stringify({}));
  assert.throws(() => railwaySet(broken, { key: "SUPPORT_NOTIFY", value: "live", dryRun: false }), /read back/);
});

function fakeStripe({ existing = [], secret = WHSEC } = {}) {
  const log = [];
  let endpoints = [...existing];
  const fetchImpl = async (url, init) => {
    const path = url.replace("https://api.stripe.com/v1", "");
    log.push(`${init.method} ${path.split("?")[0]}`);
    if (init.method === "GET") return { ok: true, status: 200, json: async () => ({ data: endpoints }) };
    if (init.method === "POST") {
      const ep = { id: `we_new${log.length}`, url: new URLSearchParams(init.body).get("url"), secret };
      endpoints.push(ep);
      return { ok: true, status: 200, json: async () => ep };
    }
    if (init.method === "DELETE") {
      endpoints = endpoints.filter((e) => !path.endsWith(e.id));
      return { ok: true, status: 200, json: async () => ({ deleted: true }) };
    }
    throw new Error("unexpected");
  };
  return { fetchImpl, log, get endpoints() { return endpoints; } };
}

test("webhook: refuses a test key; exists means no change; dry run never writes", async () => {
  await assert.rejects(ensureStripeWebhook({ stripeKey: "sk_test_x", dryRun: true }), /live key/);
  const s = fakeStripe({ existing: [{ id: "we_old", url: "https://www.ohbeef.com/api/webhooks/stripe" }] });
  assert.deepEqual(await ensureStripeWebhook({ stripeKey: "sk_live_x", dryRun: true, fetchImpl: s.fetchImpl }), { action: "exists", endpointId: "we_old" });
  assert.deepEqual(await ensureStripeWebhook({ stripeKey: "sk_live_x", dryRun: true, recreate: true, fetchImpl: s.fetchImpl }), { action: "would-recreate" });
  assert.ok(s.log.every((l) => l.startsWith("GET")));
});

test("webhook recreate: new endpoint, secret saved, THEN the old one deleted", async () => {
  const s = fakeStripe({ existing: [{ id: "we_old", url: "https://www.ohbeef.com/api/webhooks/stripe" }] });
  const saved = [];
  const res = await ensureStripeWebhook({ stripeKey: "sk_live_x", dryRun: false, recreate: true, fetchImpl: s.fetchImpl, saveSecret: async (v) => { saved.push([v, s.log.length]); } });
  assert.equal(res.action, "recreated");
  assert.deepEqual(saved.map((x) => x[0]), [WHSEC]);
  assert.deepEqual(s.log, ["GET /webhook_endpoints", "POST /webhook_endpoints", "DELETE /webhook_endpoints/we_old"]);
  assert.deepEqual(s.endpoints.map((e) => e.id), [res.endpointId]);
});

test("webhook: a failed save deletes the NEW endpoint and keeps the old one", async () => {
  const s = fakeStripe({ existing: [{ id: "we_old", url: "https://www.ohbeef.com/api/webhooks/stripe" }] });
  await assert.rejects(
    ensureStripeWebhook({ stripeKey: "sk_live_x", dryRun: false, recreate: true, fetchImpl: s.fetchImpl, saveSecret: async () => { throw new Error("Vercel 500"); } }),
    /Vercel 500/,
  );
  assert.deepEqual(s.endpoints.map((e) => e.id), ["we_old"]);
  const noSecret = fakeStripe({ secret: "" });
  await assert.rejects(ensureStripeWebhook({ stripeKey: "sk_live_x", dryRun: false, fetchImpl: noSecret.fetchImpl, saveSecret: async () => {} }), /whsec_/);
  assert.deepEqual(noSecret.endpoints, []);
});
