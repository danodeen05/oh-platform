import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAM, tierRule, evaluateProgress, publicProgram } from "../program.js";

test("thresholds match the owner decision", () => {
  assert.deepEqual(tierRule("CHOPSTICK").need, { orders: 10, referrals: 2 });
  assert.deepEqual(tierRule("NOODLE_MASTER").need, { orders: 25, referrals: 5 });
  assert.equal(tierRule("BEEF_BOSS").next, null);
});
test("progress needs both counts", () => {
  assert.equal(evaluateProgress({ membershipTier: "CHOPSTICK", tierProgressOrders: 12, tierProgressReferrals: 1 }).ready, false);
  assert.equal(evaluateProgress({ membershipTier: "CHOPSTICK", tierProgressOrders: 10, tierProgressReferrals: 2 }).ready, true);
  assert.equal(evaluateProgress({ membershipTier: "BEEF_BOSS", tierProgressOrders: 99, tierProgressReferrals: 99 }).ready, false);
});
test("public program never exposes goodwill caps", () => {
  assert.equal("goodwill" in publicProgram(), false);
  assert.equal(publicProgram().tiers.length, 3);
});
test("unknown tier throws", () => assert.throws(() => tierRule("GOLD")));
