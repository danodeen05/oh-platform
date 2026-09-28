/**
 * Site follow-up 2026-09-28 (spec 3f): the One Red Step paragraph in the
 * frozen system prompt. Facts only, pointing to /giving, and the prompt stays
 * one constant string (the cached prefix) with no per-user data.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FROZEN_SYSTEM } from "../prompts.js";

test("the frozen prompt carries the giving facts and points to /giving", () => {
  assert.match(FROZEN_SYSTEM, /One Red Step \(how Oh! gives back\):/);
  assert.ok(FROZEN_SYSTEM.includes("1% of revenue from every company restaurant to ONE RED STEP AT A TIME"));
  assert.ok(FROZEN_SYSTEM.includes("EIN 33-7041706"));
  assert.ok(FROZEN_SYSTEM.includes("oneredstepatatime.org/donate"));
  assert.ok(FROZEN_SYSTEM.includes("ohbeef.com/giving"));
});

test("the frozen prompt has no em dash and no dollar projection for the pledge", () => {
  assert.ok(!FROZEN_SYSTEM.includes("—"));
  const giving = FROZEN_SYSTEM.slice(FROZEN_SYSTEM.indexOf("One Red Step (how Oh! gives back):"));
  const paragraph = giving.slice(0, giving.indexOf("\n\n"));
  assert.ok(!/\$\d/.test(paragraph), "no dollar figures in the giving paragraph");
});

test("a fresh import builds byte-identical prompt text", async () => {
  const again = await import(`../prompts.js?fresh=${Date.now()}`);
  assert.equal(again.FROZEN_SYSTEM, FROZEN_SYSTEM);
});
