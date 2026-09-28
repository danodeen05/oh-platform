/**
 * Which challenges the engine can actually complete, and the time rules it
 * uses (Task D9 fix round 1).
 *
 * Ruling: the site never shows a challenge the engine can't complete. A
 * challenge is trackable when its `requirements.type` is one that
 * updateChallengeProgress (index.js) or the meal-gift flow advances. The
 * allowlist is by type, not by slug, so a challenge an owner creates later
 * (any slug) is judged by what it asks for. Untracked types today:
 *   - try_all_noodles: no noodle-variety tracking exists (a TODO in the engine).
 *   - referrals: nothing advances a referrals challenge (referral rewards are
 *     the REFERRAL credit lots, a separate program).
 * Untracked challenges are left out of GET /challenges, GET
 * /users/:id/challenges and the profile, and can't be enrolled in.
 *
 * Early Bird (`early_order`, `beforeHour`) is judged on the program clock
 * (America/Denver) at the time the order was placed, never the server's
 * clock (UTC on Railway, where 11am Denver is 5pm).
 */
import { PROGRAM } from "./program.js";

export const TRACKED_CHALLENGE_TYPES = Object.freeze([
  "order_count",
  "spend_amount",
  "order_streak",
  "specific_item",
  "category_orders",
  "early_order",
  "meal_gift",
]);

export function challengeType(challenge) {
  let req = challenge?.requirements;
  if (typeof req === "string") {
    try {
      req = JSON.parse(req);
    } catch {
      return null;
    }
  }
  return req && typeof req === "object" && typeof req.type === "string" ? req.type : null;
}

export function isTrackableChallenge(challenge) {
  return TRACKED_CHALLENGE_TYPES.includes(challengeType(challenge));
}

/** 0-23: the hour at `date` on the `timeZone` clock (America/Denver by default). */
export function localHour(date, timeZone = PROGRAM.timezone) {
  const d = date instanceof Date ? date : new Date(date);
  const h = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || PROGRAM.timezone, hourCycle: "h23", hour: "2-digit" }).format(d);
  return Number(h) % 24;
}

/** Early Bird: placed before `beforeHour` (default 11) on the Denver clock. */
export function earlyOrderMet(placedAt, beforeHour = 11, timeZone = PROGRAM.timezone) {
  const at = placedAt ? new Date(placedAt) : new Date();
  if (Number.isNaN(at.getTime())) return false;
  return localHour(at, timeZone) < (Number.isFinite(beforeHour) ? beforeHour : 11);
}
