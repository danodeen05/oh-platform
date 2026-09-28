/**
 * Task D9 fix round 1: only engine-tracked challenges are shown, and Early
 * Bird is judged on the Denver clock at order time.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { challengeType, earlyOrderMet, isTrackableChallenge, localHour, TRACKED_CHALLENGE_TYPES } from "../challenge-rules.js";

test("trackable by requirements.type: Noodle Explorer and Party Host are not", () => {
  assert.equal(isTrackableChallenge({ slug: "try-all-bases", requirements: { type: "try_all_noodles", count: 4 } }), false);
  assert.equal(isTrackableChallenge({ slug: "bring-5-friends", requirements: { type: "referrals", count: 5 } }), false);
  assert.equal(isTrackableChallenge({ slug: "early-bird", requirements: { type: "early_order", beforeHour: 11 } }), true);
  assert.equal(isTrackableChallenge({ slug: "meal-for-stranger", requirements: { type: "meal_gift" } }), true);
  // Stored as a JSON string, missing, or malformed: judged on the parsed type, else not trackable.
  assert.equal(isTrackableChallenge({ requirements: JSON.stringify({ type: "order_count", count: 3 }) }), true);
  assert.equal(isTrackableChallenge({ requirements: "{nope" }), false);
  assert.equal(isTrackableChallenge({}), false);
  assert.equal(challengeType(null), null);
  assert.ok(!TRACKED_CHALLENGE_TYPES.includes("try_all_noodles"));
});

test("localHour reads the Denver clock, not UTC", () => {
  // 17:30 UTC in summer is 11:30 MDT.
  assert.equal(localHour(new Date("2026-07-10T17:30:00Z")), 11);
  // 17:30 UTC in winter is 10:30 MST.
  assert.equal(localHour(new Date("2026-12-10T17:30:00Z")), 10);
});

test("Early Bird boundary: 10:59 Denver counts, 11:00 doesn't", () => {
  assert.equal(earlyOrderMet(new Date("2026-10-01T10:59:59-06:00"), 11), true);
  assert.equal(earlyOrderMet(new Date("2026-10-01T11:00:00-06:00"), 11), false);
  // A 10:30 Denver order is 16:30 UTC: the old server-clock check (UTC) said "not early".
  assert.equal(earlyOrderMet(new Date("2026-10-01T16:30:00Z"), 11), true);
  // 06:00 UTC is midnight Denver the day before: early.
  assert.equal(earlyOrderMet(new Date("2026-10-01T06:00:00Z"), 11), true);
  // Winter (MST): 10:59 MST is early, 11:00 MST is not.
  assert.equal(earlyOrderMet(new Date("2026-12-31T10:59:00-07:00"), 11), true);
  assert.equal(earlyOrderMet(new Date("2026-12-31T11:00:00-07:00"), 11), false);
  assert.equal(earlyOrderMet("not a date", 11), false);
});
