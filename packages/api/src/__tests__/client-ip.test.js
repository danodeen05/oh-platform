/**
 * Release 2 smoke finding: on Railway req.ip was a rotating edge address.
 * createServerFactory makes Railway's X-Real-IP the client IP (Railway only).
 * A real listening server, because inject() bypasses serverFactory.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { FASTIFY_OPTIONS, createServerFactory, isRailway, normalizeClientIpHeaders } from "../http-config.js";

const RAILWAY = { RAILWAY_ENVIRONMENT_NAME: "production" };

async function ipFor(env, headers) {
  const a = Fastify({ ...FASTIFY_OPTIONS, logger: false, serverFactory: createServerFactory(env) });
  a.get("/ip", async (req) => ({ ip: req.ip }));
  await a.listen({ port: 0, host: "127.0.0.1" });
  try {
    const res = await fetch(`http://127.0.0.1:${a.server.address().port}/ip`, { headers });
    return (await res.json()).ip;
  } finally {
    await a.close();
  }
}

test("on Railway, X-Real-IP is the client even when the rightmost XFF hop is an edge proxy", async () => {
  const ip = await ipFor(RAILWAY, { "x-real-ip": "198.51.100.23", "x-forwarded-for": "198.51.100.23, 152.233.47.68" });
  assert.equal(ip, "198.51.100.23");
});

test("off Railway nothing changes: trustProxy 1 takes the rightmost XFF entry", async () => {
  const ip = await ipFor({}, { "x-real-ip": "198.51.100.23", "x-forwarded-for": "203.0.113.9, 192.0.2.1" });
  assert.equal(ip, "192.0.2.1");
});

test("an invalid X-Real-IP is ignored", () => {
  const h = { "x-real-ip": "not-an-ip", "x-forwarded-for": "192.0.2.1" };
  normalizeClientIpHeaders(h, RAILWAY);
  assert.equal(h["x-forwarded-for"], "192.0.2.1");
  const ipv6 = { "x-real-ip": " 2001:db8::1 " };
  normalizeClientIpHeaders(ipv6, RAILWAY);
  assert.equal(ipv6["x-forwarded-for"], "2001:db8::1");
});

test("isRailway reads Railway's own variables", () => {
  assert.equal(isRailway({}), false);
  assert.equal(isRailway({ RAILWAY_ENVIRONMENT_ID: "x" }), true);
  assert.equal(isRailway(RAILWAY), true);
});
