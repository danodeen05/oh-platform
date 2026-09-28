/**
 * Task G3: the prod smoke checks and the owner release text.
 * A fake fetch answers like a healthy release-2 deploy; a broken answer
 * must turn exactly that check red. The owner notice sends nothing in a dry
 * run and honors SUPPORT_NOTIFY.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecks, runChecks, EXPECTED_ACTIVE_PODS } from "../smoke.js";
import { sendOwnerReleaseNotice, OWNER_RELEASE_TEXT } from "../owner-notice.js";

const API = "https://api.test";
const WEB = "https://www.test";

function response(status, { json, text, headers = {} } = {}) {
  return {
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => json,
    text: async () => text ?? JSON.stringify(json ?? null),
  };
}

function healthyFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (overrides[url]) return overrides[url](init);
    const u = new URL(url);
    if (u.origin === API) {
      if (u.pathname === "/health") return response(200, { json: { ok: true } });
      if (u.pathname === "/membership/program")
        return response(200, { json: { tiers: [{ key: "CHOPSTICK", need: { orders: 10, referrals: 2 } }, { key: "NOODLE_MASTER", need: { orders: 25, referrals: 5 } }, { key: "BEEF_BOSS", need: null }] } });
      if (u.pathname === "/locations") return response(200, { json: [{ id: "cc", slug: "city-creek" }, { id: "up", slug: "university-place" }, { id: "soho", slug: null }] });
      if (u.pathname === "/locations/cc/seats") return response(200, { json: { seats: Array(EXPECTED_ACTIVE_PODS["city-creek"]).fill({}) } });
      if (u.pathname === "/locations/up/seats") return response(200, { json: { seats: Array(EXPECTED_ACTIVE_PODS["university-place"]).fill({}) } });
      if (u.pathname === "/orders/status") return response(200, { json: { status: "PREPPING" } });
      if (u.pathname === "/chappy/guest-token") return response(200, { json: { token: "gt_secret" } });
      if (u.pathname === "/chappy/chat") return response(200, { text: ": chappy\n\nevent: text\ndata: {}\n\nevent: done\ndata: {}\n\n" });
      if (u.pathname === "/chappy/sms") return response(403);
    }
    if (u.pathname === "/en/loyalty") return response(308, { headers: { location: `${WEB}/en/rewards` } });
    if (u.pathname === "/en/tenants") return response(404);
    if (u.pathname === "/api/webhooks/stripe") return response(400);
    return response(200, { text: "<html></html>" });
  };
  return { fetchImpl, calls };
}

const silent = () => {};

test("a healthy release passes every check, and the list covers the runbook's smoke items", async () => {
  const { fetchImpl, calls } = healthyFetch();
  const checks = buildChecks({ api: API, web: WEB });
  const names = checks.map((c) => c.name).join("\n");
  for (const must of ["/health", "/membership/program", "75", "/en home", "/zh-TW home", "/zh-TW/rewards", "/en/menu", "/zh-TW/privacy", "embed", "/en/member", "loyalty", "tenants", "chappy guest"]) {
    assert.ok(names.includes(must), `missing check for ${must}`);
  }
  const out = [];
  const res = await runChecks(checks, fetchImpl, (l) => out.push(l));
  assert.equal(res.failed, 0, out.join("\n"));
  assert.ok(!out.join("\n").includes("gt_secret"), "the guest token is never printed");
  assert.ok(calls.every((c) => c.init.redirect === "manual"), "redirects are observed, not followed");
  assert.ok(calls.every((c) => !c.init.method || c.init.method === "GET" || /\/chappy\/|\/api\/webhooks\/stripe/.test(c.url)), "only Chappy and the webhook probe use POST");
});

test("each broken answer fails its own check only", async () => {
  const cases = {
    [`${API}/locations/up/seats`]: () => response(200, { json: { seats: Array(82).fill({}) } }),
    [`${WEB}/en/loyalty`]: () => response(307, { headers: { location: "/en/rewards" } }),
    [`${WEB}/en/tenants`]: () => response(200),
    [`${API}/chappy/chat`]: () => response(200, { text: "event: text\ndata: {}\n\nevent: error\ndata: {}\n\n" }),
    [`${WEB}/api/webhooks/stripe`]: () => response(500),
    [`${API}/chappy/sms`]: () => response(500),
  };
  for (const [url, answer] of Object.entries(cases)) {
    const { fetchImpl } = healthyFetch({ [url]: answer });
    // eslint-disable-next-line no-await-in-loop
    const res = await runChecks(buildChecks({ api: API, web: WEB }), fetchImpl, silent);
    assert.equal(res.failed, 1, `exactly one failure for ${url}`);
  }
});

test("a check that throws is a failure, and the run continues", async () => {
  const { fetchImpl } = healthyFetch({ [`${API}/health`]: () => { throw new Error("ECONNREFUSED"); } });
  const res = await runChecks(buildChecks({ api: API, web: WEB, chappy: false }), fetchImpl, silent);
  assert.equal(res.failed, 1);
  assert.ok(res.results.length > 10);
});

test("owner notice: dry run and SUPPORT_NOTIFY off/log never send; live sends the exact text once", async () => {
  const sent = [];
  const send = async (m) => { sent.push(m); return { success: true, sid: "SM1" }; };
  const env = { ADMIN_PHONE_NUMBER: "+18015551234" };
  assert.deepEqual(await sendOwnerReleaseNotice({ env: { ...env, SUPPORT_NOTIFY: "live" }, send, dryRun: true }), { action: "dry-run", to: "...1234" });
  assert.equal((await sendOwnerReleaseNotice({ env: { ...env, SUPPORT_NOTIFY: "off" }, send, dryRun: false })).action, "off");
  const orig = console.log;
  console.log = () => {};
  try {
    assert.equal((await sendOwnerReleaseNotice({ env: { ...env, SUPPORT_NOTIFY: "log" }, send, dryRun: false })).action, "logged");
  } finally {
    console.log = orig;
  }
  assert.equal(sent.length, 0);
  const live = await sendOwnerReleaseNotice({ env, send, dryRun: false });
  assert.equal(live.action, "sent");
  assert.deepEqual(sent, [{ to: "+18015551234", body: OWNER_RELEASE_TEXT }]);
  assert.equal(OWNER_RELEASE_TEXT, "Oh! site release is live in prod and ready for your review.");
  await assert.rejects(sendOwnerReleaseNotice({ env: {}, send, dryRun: true }), /ADMIN_PHONE_NUMBER/);
});
