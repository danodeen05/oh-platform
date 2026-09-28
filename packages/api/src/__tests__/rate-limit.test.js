/**
 * Task G3b: the global rate limit is configurable (RATE_LIMIT_MAX /
 * RATE_LIMIT_WINDOW, default 600 per minute per IP), and only a request
 * carrying the non-empty ADMIN_API_KEY in x-oh-server-key skips it.
 * Uses a real Fastify app with @fastify/rate-limit, the same options the
 * API registers (globalRateLimitOptions).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import {
  DEFAULT_RATE_LIMIT_MAX,
  SERVER_KEY_HEADER,
  globalRateLimitOptions,
  globalRateLimitSettings,
  isTrustedServerCall,
} from "../http-config.js";

const KEY = "k".repeat(64);
const silent = () => {};

async function app(env) {
  const a = Fastify({ trustProxy: 1 });
  await a.register(rateLimit, globalRateLimitOptions(env, silent));
  a.get("/ping", async () => ({ ok: true }));
  a.get("/health", async () => ({ ok: true }));
  await a.ready();
  return a;
}

async function hit(a, n, headers = {}) {
  const codes = [];
  for (let i = 0; i < n; i++) {
    // eslint-disable-next-line no-await-in-loop
    const res = await a.inject({ method: "GET", url: "/ping", headers, remoteAddress: "203.0.113.7" });
    codes.push(res.statusCode);
  }
  return codes;
}

test("defaults are 600 per 1 minute; env overrides take effect; bad values fall back", () => {
  assert.deepEqual(globalRateLimitSettings({}, silent), { max: 600, timeWindow: "1 minute" });
  assert.equal(DEFAULT_RATE_LIMIT_MAX, 600);
  assert.deepEqual(globalRateLimitSettings({ RATE_LIMIT_MAX: "900", RATE_LIMIT_WINDOW: "30000" }, silent), { max: 900, timeWindow: 30000 });
  assert.deepEqual(globalRateLimitSettings({ RATE_LIMIT_WINDOW: "2 minutes" }, silent), { max: 600, timeWindow: "2 minutes" });
  const warnings = [];
  assert.deepEqual(globalRateLimitSettings({ RATE_LIMIT_MAX: "0", RATE_LIMIT_WINDOW: "soon" }, (w) => warnings.push(w)), { max: 600, timeWindow: "1 minute" });
  assert.equal(warnings.length, 2);
  assert.equal(globalRateLimitSettings({ RATE_LIMIT_MAX: "abc" }, silent).max, 600);
});

test("the env override is what the server enforces (RATE_LIMIT_MAX=3: the 4th request is 429)", async () => {
  const a = await app({ RATE_LIMIT_MAX: "3" });
  assert.deepEqual(await hit(a, 4), [200, 200, 200, 429]);
  await a.close();
});

test("the trusted server key skips the limit", async () => {
  const a = await app({ RATE_LIMIT_MAX: "2", ADMIN_API_KEY: KEY });
  assert.deepEqual(await hit(a, 5, { [SERVER_KEY_HEADER]: KEY }), [200, 200, 200, 200, 200]);
  await a.close();
});

test("a spoofed or wrong header does not bypass, and neither does x-admin-api-key", async () => {
  const a = await app({ RATE_LIMIT_MAX: "2", ADMIN_API_KEY: KEY });
  assert.deepEqual(await hit(a, 3, { [SERVER_KEY_HEADER]: "guess" }), [200, 200, 429]);
  const b = await app({ RATE_LIMIT_MAX: "2", ADMIN_API_KEY: KEY });
  assert.deepEqual(await hit(b, 3, { [SERVER_KEY_HEADER]: `${KEY}x` }), [200, 200, 429]);
  const c = await app({ RATE_LIMIT_MAX: "2", ADMIN_API_KEY: KEY });
  assert.deepEqual(await hit(c, 3, { "x-admin-api-key": KEY }), [200, 200, 429], "only the dedicated header counts");
  await Promise.all([a.close(), b.close(), c.close()]);
});

test("with ADMIN_API_KEY unset or empty, nothing bypasses (not even an empty header)", async () => {
  const a = await app({ RATE_LIMIT_MAX: "2", ADMIN_API_KEY: "" });
  assert.deepEqual(await hit(a, 3, { [SERVER_KEY_HEADER]: "" }), [200, 200, 429]);
  const b = await app({ RATE_LIMIT_MAX: "2" });
  assert.deepEqual(await hit(b, 3, { [SERVER_KEY_HEADER]: "undefined" }), [200, 200, 429]);
  assert.equal(isTrustedServerCall({ headers: { [SERVER_KEY_HEADER]: "" } }, { ADMIN_API_KEY: "" }), false);
  assert.equal(isTrustedServerCall({ headers: {} }, { ADMIN_API_KEY: KEY }), false);
  assert.equal(isTrustedServerCall({ headers: { [SERVER_KEY_HEADER]: [KEY, KEY] } }, { ADMIN_API_KEY: KEY }), false);
  await Promise.all([a.close(), b.close()]);
});

test("/health is never limited", async () => {
  const a = await app({ RATE_LIMIT_MAX: "1" });
  for (let i = 0; i < 3; i++) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await a.inject({ method: "GET", url: "/health", remoteAddress: "203.0.113.7" })).statusCode, 200);
  }
  await a.close();
});
