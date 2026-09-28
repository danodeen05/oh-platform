/**
 * Chappy per-identity rate and token limits, plus the guest per-IP cap and
 * the case-spam limit (Task B3).
 *
 * Identity keys (auth/customer.js's identity shapes):
 *   member -> "user:<id>"    guest -> "guest:<key>"    sms -> "sms:<e164>"
 *
 * Limits (defaults, overridable with CHAPPY_LIMITS_JSON below):
 *   - 20 messages per 10 minutes per identity, 200 per day.
 *   - 300,000 output tokens per identity per day, recorded from each turn's
 *     terminal event (`done`, or `error` on a refusal/failed request: those
 *     still spent tokens on whatever rounds completed). routes.js calls
 *     recordUsage after streaming ends, Task B3 fix round 1.
 *   - 300 messages per day per IP, for guests only (so rotating guest tokens
 *     cannot get around the per-identity cap).
 *   - report_issue / request_refund / escalate_to_human SHARE one cap: 3
 *     SupportCases per identity per day IN TOTAL (controller ruling, Task B3
 *     fix round 1 -- NOT 3 per tool), checked by tools.js around case
 *     creation. Like the message/token checks above, checkCaseLimit-then-
 *     recordCase is a check-then-act: two concurrent calls from the same
 *     identity could both pass the check and both record, occasionally
 *     allowing one case over the cap. Left as-is (controller ruling): it's a
 *     soft limit, not a security boundary, and every case it creates is
 *     visible to staff regardless.
 *
 * Storage is a plain in-memory Map, following the plan-routes.js failed-login
 * limiter pattern: fixed windows that start on first use, not calendar days.
 * This is per-process. A multi-replica deploy would need a shared store
 * (Redis or similar); the API currently runs one replica.
 *
 * CHAPPY_LIMITS_JSON is a partial override, deep-merged over DEFAULT_LIMITS,
 * e.g. {"dailyMessages":{"max":500}}. A malformed value is ignored (defaults
 * apply) and a warning is logged.
 */
import { toE164 } from "./phone.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_LIMITS = Object.freeze({
  messages: Object.freeze({ max: 20, windowMs: 10 * MINUTE_MS }),
  dailyMessages: Object.freeze({ max: 200, windowMs: DAY_MS }),
  dailyOutputTokens: Object.freeze({ max: 300_000, windowMs: DAY_MS }),
  guestIpDaily: Object.freeze({ max: 300, windowMs: DAY_MS }),
  caseSpam: Object.freeze({ max: 3, windowMs: DAY_MS }),
});

const RATE_MESSAGES = {
  messages: "You're sending messages a little fast. Please wait a bit and try again.",
  dailyMessages: "You've reached today's message limit with Chappy. Please try again tomorrow.",
  guestIpDaily: "Too many chats have started from this connection today. Please try again tomorrow.",
};
const BUDGET_MESSAGE = "Chappy has reached today's chat limit. Please try again tomorrow, or visit ohbeef.com.";

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Deep-merge a partial override onto the defaults; unknown/malformed keys are dropped. */
function mergeLimits(base, override) {
  const out = {};
  for (const [key, value] of Object.entries(base)) {
    const candidate = isPlainObject(override) ? override[key] : undefined;
    if (isPlainObject(candidate)) {
      out[key] = {
        max: Number.isFinite(candidate.max) && candidate.max >= 0 ? candidate.max : value.max,
        windowMs: Number.isFinite(candidate.windowMs) && candidate.windowMs > 0 ? candidate.windowMs : value.windowMs,
      };
    } else {
      out[key] = { ...value };
    }
  }
  return out;
}

/** CHAPPY_LIMITS_JSON, parsed and merged over the defaults. Never throws. */
export function loadLimitsConfig(env = process.env) {
  const raw = env.CHAPPY_LIMITS_JSON;
  if (!raw) return mergeLimits(DEFAULT_LIMITS, null);
  try {
    const parsed = JSON.parse(raw);
    return mergeLimits(DEFAULT_LIMITS, parsed);
  } catch (err) {
    console.warn("[Chappy] CHAPPY_LIMITS_JSON is not valid JSON, using defaults:", err?.message);
    return mergeLimits(DEFAULT_LIMITS, null);
  }
}

/** The rate/budget identity key for a Chappy identity. Unrecognised shapes have no key (fail-open: no limit is applied). */
export function identityKeyFor(identity) {
  if (!identity || typeof identity !== "object") return null;
  if (identity.kind === "member") return identity.userId ? `user:${identity.userId}` : null;
  if (identity.kind === "guest") return identity.guestKey ? `guest:${identity.guestKey}` : null;
  if (identity.kind === "sms") {
    const e164 = toE164(identity.phone) || (typeof identity.phone === "string" && identity.phone ? `+${identity.phone}` : null);
    return e164 ? `sms:${e164}` : null;
  }
  return null;
}

function now(nowArg) {
  return nowArg instanceof Date ? nowArg.getTime() : Date.now();
}

/**
 * One in-memory fixed-window counter store: check(key) tells you whether the
 * next increment would exceed `max`, without mutating; commit(key) records
 * one use. Windows start on first use and expire after `windowMs`.
 */
function windowCounter(max, windowMs) {
  const store = new Map();
  function prune(t) {
    if (store.size <= 20_000) return;
    for (const [k, e] of store) if (e.resetAt <= t) store.delete(k);
  }
  function peek(key, t) {
    const entry = store.get(key);
    if (!entry || entry.resetAt <= t) return { count: 0, resetAt: t + windowMs };
    return entry;
  }
  return {
    /** Would the next use be over the limit? Does not record anything. */
    check(key, t) {
      const entry = peek(key, t);
      return { blocked: entry.count >= max, resetAt: entry.resetAt };
    },
    /** Record one use (assumes `check` was already clear). */
    commit(key, t) {
      prune(t);
      const entry = peek(key, t);
      entry.count += 1;
      store.set(key, entry);
    },
    /** Current sum for a summed (token) counter; see `add`. */
    sum(key, t) {
      const entry = store.get(key);
      return entry && entry.resetAt > t ? entry.count : 0;
    },
    /** Add `n` to a summed counter (tokens), creating/renewing the window as needed. */
    add(key, t, n) {
      prune(t);
      const entry = peek(key, t);
      entry.count += n;
      store.set(key, entry);
    },
  };
}

/**
 * Creates one Chappy limiter: per-identity message/day/token limits, the
 * guest per-IP daily cap, and the case-spam cap. Call once per process (the
 * API wires one instance in index.js) and pass its methods as chappy route
 * deps.
 */
export function createChappyLimits({ env = process.env } = {}) {
  const config = loadLimitsConfig(env);
  const shortWindow = windowCounter(config.messages.max, config.messages.windowMs);
  const dailyMessages = windowCounter(config.dailyMessages.max, config.dailyMessages.windowMs);
  const dailyTokens = windowCounter(config.dailyOutputTokens.max, config.dailyOutputTokens.windowMs);
  const guestIp = windowCounter(config.guestIpDaily.max, config.guestIpDaily.windowMs);
  const caseWindows = windowCounter(config.caseSpam.max, config.caseSpam.windowMs);

  function retryAfterSecondsFor(resetAt, t) {
    return Math.max(1, Math.ceil((resetAt - t) / 1000));
  }

  /**
   * Gate a turn before any model call. Accepts what routes.js already has on
   * hand: { identity, channel, req, now }. Returns null (go ahead) or
   * { status, code, body, message } for the RATE / BUDGET responses (see
   * routes.js's `limited()` and the SMS handler).
   */
  function checkLimits({ identity, channel = "web", req, now: nowArg } = {}) {
    const identityKey = identityKeyFor(identity);
    if (!identityKey) return null; // no identity to key on: identity is required upstream already

    const t = now(nowArg);

    const short = shortWindow.check(identityKey, t);
    if (short.blocked) return rateResult(short.resetAt, t, channel, "messages");

    const daily = dailyMessages.check(identityKey, t);
    if (daily.blocked) return rateResult(daily.resetAt, t, channel, "dailyMessages");

    let ipKey = null;
    if (identity?.kind === "guest" && req) {
      ipKey = clientIp(req);
      const ip = guestIp.check(ipKey, t);
      if (ip.blocked) return rateResult(ip.resetAt, t, channel, "guestIpDaily");
    }

    if (dailyTokens.sum(identityKey, t) >= config.dailyOutputTokens.max) {
      return budgetResult(channel);
    }

    // All clear: commit the message-count increments (tokens are recorded
    // separately, from actual usage, by recordUsage below).
    shortWindow.commit(identityKey, t);
    dailyMessages.commit(identityKey, t);
    if (ipKey) guestIp.commit(ipKey, t);
    return null;
  }

  function rateResult(resetAt, t, channel, reason) {
    const retryAfterSeconds = retryAfterSecondsFor(resetAt, t);
    return {
      status: 429,
      code: "RATE",
      body: { retryAfterSeconds },
      message: channel === "sms" ? RATE_MESSAGES[reason] || RATE_MESSAGES.messages : undefined,
    };
  }

  function budgetResult(channel) {
    return { status: 429, code: "BUDGET", body: {}, message: channel === "sms" ? BUDGET_MESSAGE : undefined };
  }

  /** Records one turn's output tokens against its identity's daily budget. Call after the `done` event. */
  function recordUsage({ identity, tokens, now: nowArg } = {}) {
    const identityKey = identityKeyFor(identity);
    if (!identityKey || !Number.isFinite(tokens) || tokens <= 0) return;
    dailyTokens.add(identityKey, now(nowArg), tokens);
  }

  /**
   * May this identity open one more support case today? The cap is SHARED
   * across report_issue/request_refund/escalate_to_human (controller
   * ruling, Task B3 fix round 1): 3 total per identity per day, not 3 per
   * tool. `tool` is accepted (tools.js passes the calling tool's name) but
   * no longer part of the key.
   */
  function checkCaseLimit({ identity, tool, now: nowArg } = {}) {
    const identityKey = identityKeyFor(identity);
    if (!identityKey || !tool) return { ok: true };
    const { blocked } = caseWindows.check(identityKey, now(nowArg));
    return blocked ? { ok: false, code: "CASE_LIMIT" } : { ok: true };
  }

  /** Records that this identity opened one support case (call only after a successful create). */
  function recordCase({ identity, tool, now: nowArg } = {}) {
    const identityKey = identityKeyFor(identity);
    if (!identityKey || !tool) return;
    caseWindows.commit(identityKey, now(nowArg));
  }

  return { checkLimits, recordUsage, checkCaseLimit, recordCase, config };
}

/** The real client IP behind the trusted proxy hop (see http-config.js). */
function clientIp(req) {
  return req?.ip || "unknown";
}
