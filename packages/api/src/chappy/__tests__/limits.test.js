/**
 * Task B3: Chappy's per-identity rate/token limiter, the guest per-IP cap,
 * and the case-spam cap. Pure unit tests against createChappyLimits; no
 * server, no database.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createChappyLimits, identityKeyFor, loadLimitsConfig, DEFAULT_LIMITS } from "../limits.js";

const MEMBER = { kind: "member", userId: "u1" };
const GUEST = (key) => ({ kind: "guest", guestKey: key });
const SMS = { kind: "sms", phone: "8015550100", userId: null };
const T0 = new Date("2026-10-01T12:00:00Z");
const req = (ip) => ({ ip });

describe("identityKeyFor", () => {
  test("members, guests and sms map to the ruled key shapes", () => {
    assert.equal(identityKeyFor(MEMBER), "user:u1");
    assert.equal(identityKeyFor(GUEST("g1")), "guest:g1");
    assert.equal(identityKeyFor(SMS), "sms:+18015550100");
  });

  test("an sms identity already carrying a + is used as-is (via toE164)", () => {
    assert.equal(identityKeyFor({ kind: "sms", phone: "+442079460958" }), "sms:+442079460958");
  });

  test("no identity, or an unrecognised shape, has no key", () => {
    assert.equal(identityKeyFor(null), null);
    assert.equal(identityKeyFor({ kind: "member", userId: null }), null);
    assert.equal(identityKeyFor({ kind: "robot" }), null);
  });
});

describe("loadLimitsConfig (CHAPPY_LIMITS_JSON)", () => {
  test("with no override, returns the defaults", () => {
    assert.deepEqual(loadLimitsConfig({}), {
      messages: { ...DEFAULT_LIMITS.messages },
      dailyMessages: { ...DEFAULT_LIMITS.dailyMessages },
      dailyOutputTokens: { ...DEFAULT_LIMITS.dailyOutputTokens },
      guestIpDaily: { ...DEFAULT_LIMITS.guestIpDaily },
      caseSpam: { ...DEFAULT_LIMITS.caseSpam },
    });
  });

  test("a partial override is merged over the defaults; unspecified fields keep their default", () => {
    const cfg = loadLimitsConfig({ CHAPPY_LIMITS_JSON: JSON.stringify({ dailyMessages: { max: 500 } }) });
    assert.equal(cfg.dailyMessages.max, 500);
    assert.equal(cfg.dailyMessages.windowMs, DEFAULT_LIMITS.dailyMessages.windowMs);
    assert.equal(cfg.messages.max, DEFAULT_LIMITS.messages.max);
  });

  test("malformed JSON falls back to the defaults instead of throwing", () => {
    assert.deepEqual(loadLimitsConfig({ CHAPPY_LIMITS_JSON: "{not json" }).messages, { ...DEFAULT_LIMITS.messages });
  });
});

describe("checkLimits: per-identity rate (10 minutes / day)", () => {
  test("the 21st message in 10 minutes gives 429 RATE with retryAfterSeconds", () => {
    const { checkLimits } = createChappyLimits({ env: {} });
    for (let i = 0; i < 20; i++) {
      assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: T0 }), null, `message ${i + 1} should be allowed`);
    }
    const blocked = checkLimits({ identity: MEMBER, channel: "web", now: T0 });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.code, "RATE");
    assert.ok(Number.isInteger(blocked.body.retryAfterSeconds) && blocked.body.retryAfterSeconds > 0);
  });

  test("a different identity has its own bucket", () => {
    const { checkLimits } = createChappyLimits({ env: {} });
    for (let i = 0; i < 20; i++) checkLimits({ identity: MEMBER, channel: "web", now: T0 });
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: T0 }).code, "RATE");
    assert.equal(checkLimits({ identity: GUEST("other"), channel: "web", now: T0 }), null);
  });

  test("the window resets after it elapses", () => {
    const { checkLimits } = createChappyLimits({ env: {} });
    for (let i = 0; i < 20; i++) checkLimits({ identity: MEMBER, channel: "web", now: T0 });
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: T0 }).code, "RATE");
    const later = new Date(T0.getTime() + DEFAULT_LIMITS.messages.windowMs + 1000);
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: later }), null);
  });

  test("the daily cap blocks once exceeded, independent of the 10-minute window", () => {
    const env = { CHAPPY_LIMITS_JSON: JSON.stringify({ messages: { max: 1000, windowMs: 1 }, dailyMessages: { max: 3, windowMs: 100_000 } }) };
    const { checkLimits } = createChappyLimits({ env });
    let t = T0.getTime();
    for (let i = 0; i < 3; i++) {
      assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: new Date(t) }), null);
      t += 10; // past the (overridden) 1ms short window, well inside the 100s daily window
    }
    const blocked = checkLimits({ identity: MEMBER, channel: "web", now: new Date(t) });
    assert.equal(blocked.code, "RATE");
  });
});

describe("checkLimits: guest per-IP daily cap", () => {
  test("rotating guest tokens from the same IP still hits the per-IP cap", () => {
    const env = { CHAPPY_LIMITS_JSON: JSON.stringify({ messages: { max: 1000 }, dailyMessages: { max: 1000 }, guestIpDaily: { max: 2 } }) };
    const { checkLimits } = createChappyLimits({ env });
    const ip = req("203.0.113.5");
    assert.equal(checkLimits({ identity: GUEST("g1"), channel: "web", req: ip, now: T0 }), null);
    assert.equal(checkLimits({ identity: GUEST("g2"), channel: "web", req: ip, now: T0 }), null);
    // A third guest identity, same IP: the per-IP cap catches what per-identity limits would miss.
    const blocked = checkLimits({ identity: GUEST("g3"), channel: "web", req: ip, now: T0 });
    assert.equal(blocked.code, "RATE");
  });

  test("a member is never subject to the guest per-IP cap", () => {
    const env = { CHAPPY_LIMITS_JSON: JSON.stringify({ guestIpDaily: { max: 1 } }) };
    const { checkLimits } = createChappyLimits({ env });
    const ip = req("203.0.113.5");
    assert.equal(checkLimits({ identity: GUEST("g1"), channel: "web", req: ip, now: T0 }), null);
    assert.equal(checkLimits({ identity: GUEST("g2"), channel: "web", req: ip, now: T0 }).code, "RATE");
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", req: ip, now: T0 }), null);
  });

  test("different IPs never share a guest bucket", () => {
    const env = { CHAPPY_LIMITS_JSON: JSON.stringify({ guestIpDaily: { max: 1 } }) };
    const { checkLimits } = createChappyLimits({ env });
    assert.equal(checkLimits({ identity: GUEST("g1"), channel: "web", req: req("203.0.113.5"), now: T0 }), null);
    assert.equal(checkLimits({ identity: GUEST("g2"), channel: "web", req: req("198.51.100.9"), now: T0 }), null);
  });
});

describe("checkLimits + recordUsage: daily output-token budget", () => {
  test("the budget is reached after the recorded usage: BUDGET once the daily sum hits the cap", () => {
    const { checkLimits, recordUsage } = createChappyLimits({ env: {} });
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: T0 }), null);
    recordUsage({ identity: MEMBER, tokens: DEFAULT_LIMITS.dailyOutputTokens.max, now: T0 });
    const blocked = checkLimits({ identity: MEMBER, channel: "web", now: T0 });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.code, "BUDGET");
  });

  test("usage accumulates across multiple turns", () => {
    const env = { CHAPPY_LIMITS_JSON: JSON.stringify({ dailyOutputTokens: { max: 100 } }) };
    const { checkLimits, recordUsage } = createChappyLimits({ env });
    recordUsage({ identity: MEMBER, tokens: 60, now: T0 });
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: T0 }), null, "60 < 100: still under budget");
    recordUsage({ identity: MEMBER, tokens: 45, now: T0 });
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: T0 }).code, "BUDGET", "105 >= 100: over budget");
  });

  test("token usage is scoped per identity", () => {
    const env = { CHAPPY_LIMITS_JSON: JSON.stringify({ dailyOutputTokens: { max: 100 } }) };
    const { checkLimits, recordUsage } = createChappyLimits({ env });
    recordUsage({ identity: MEMBER, tokens: 100, now: T0 });
    assert.equal(checkLimits({ identity: MEMBER, channel: "web", now: T0 }).code, "BUDGET");
    assert.equal(checkLimits({ identity: GUEST("g1"), channel: "web", now: T0 }), null);
  });

  test("SMS gets a short polite message instead of a JSON body's worth of detail", () => {
    const { checkLimits, recordUsage } = createChappyLimits({ env: {} });
    recordUsage({ identity: SMS, tokens: DEFAULT_LIMITS.dailyOutputTokens.max, now: T0 });
    const blocked = checkLimits({ identity: SMS, channel: "sms", now: T0 });
    assert.equal(blocked.code, "BUDGET");
    assert.equal(typeof blocked.message, "string");
    assert.ok(blocked.message.length > 0);
  });

  test("web (not SMS) gets no `message` field; the widget handles the code itself", () => {
    const { checkLimits, recordUsage } = createChappyLimits({ env: {} });
    recordUsage({ identity: MEMBER, tokens: DEFAULT_LIMITS.dailyOutputTokens.max, now: T0 });
    const blocked = checkLimits({ identity: MEMBER, channel: "web", now: T0 });
    assert.equal(blocked.message, undefined);
  });
});

describe("checkCaseLimit / recordCase: case-spam cap (carried from B2; fix round 1: shared, not per tool)", () => {
  test("3 opens of one tool are allowed; the 4th is blocked", () => {
    const { checkCaseLimit, recordCase } = createChappyLimits({ env: {} });
    for (let i = 0; i < 3; i++) {
      assert.equal(checkCaseLimit({ identity: MEMBER, tool: "report_issue", now: T0 }).ok, true);
      recordCase({ identity: MEMBER, tool: "report_issue", now: T0 });
    }
    const blocked = checkCaseLimit({ identity: MEMBER, tool: "report_issue", now: T0 });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "CASE_LIMIT");
  });

  test("the cap is SHARED across tools, not per tool (controller ruling, fix round 1): 2 report_issue + 1 request_refund hits it", () => {
    const { checkCaseLimit, recordCase } = createChappyLimits({ env: {} });
    recordCase({ identity: MEMBER, tool: "report_issue", now: T0 });
    recordCase({ identity: MEMBER, tool: "report_issue", now: T0 });
    recordCase({ identity: MEMBER, tool: "request_refund", now: T0 });
    // 3 total cases opened (2 + 1): a 4th, from any of the three tools, is blocked.
    assert.equal(checkCaseLimit({ identity: MEMBER, tool: "escalate_to_human", now: T0 }).ok, false);
    assert.equal(checkCaseLimit({ identity: MEMBER, tool: "report_issue", now: T0 }).ok, false);
    assert.equal(checkCaseLimit({ identity: MEMBER, tool: "request_refund", now: T0 }).ok, false);
  });

  test("the cap is per identity: a guest's cases don't affect a member's", () => {
    const { checkCaseLimit, recordCase } = createChappyLimits({ env: {} });
    recordCase({ identity: GUEST("g1"), tool: "escalate_to_human", now: T0 });
    recordCase({ identity: GUEST("g1"), tool: "report_issue", now: T0 });
    recordCase({ identity: GUEST("g1"), tool: "request_refund", now: T0 });
    assert.equal(checkCaseLimit({ identity: GUEST("g1"), tool: "escalate_to_human", now: T0 }).ok, false);
    assert.equal(checkCaseLimit({ identity: MEMBER, tool: "escalate_to_human", now: T0 }).ok, true);
  });

  test("resets the next day", () => {
    const { checkCaseLimit, recordCase } = createChappyLimits({ env: {} });
    for (let i = 0; i < 3; i++) recordCase({ identity: MEMBER, tool: "report_issue", now: T0 });
    assert.equal(checkCaseLimit({ identity: MEMBER, tool: "report_issue", now: T0 }).ok, false);
    const nextDay = new Date(T0.getTime() + DEFAULT_LIMITS.caseSpam.windowMs + 1000);
    assert.equal(checkCaseLimit({ identity: MEMBER, tool: "report_issue", now: nextDay }).ok, true);
  });
});
