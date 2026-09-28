/**
 * Task D9: a meal gift lapses at 9pm on the location's clock (America/Denver),
 * not the server's. Pinned across DST and the 9pm boundary.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mealGiftExpiresAt } from "../meal-gift-routes.js";

test("an afternoon gift in summer lapses at 9pm MDT the same day", () => {
  assert.equal(mealGiftExpiresAt(new Date("2026-07-10T15:30:00-06:00")).toISOString(), "2026-07-11T03:00:00.000Z");
});

test("a gift given after 9pm lapses at 9pm the next day", () => {
  assert.equal(mealGiftExpiresAt(new Date("2026-07-10T21:05:00-06:00")).toISOString(), "2026-07-12T03:00:00.000Z");
});

test("winter uses MST", () => {
  assert.equal(mealGiftExpiresAt(new Date("2026-12-31T11:00:00-07:00")).toISOString(), "2027-01-01T04:00:00.000Z");
});

test("the DST fall-back day (2026-11-01) lands on 9pm MST", () => {
  assert.equal(mealGiftExpiresAt(new Date("2026-11-01T00:30:00-06:00")).toISOString(), "2026-11-02T04:00:00.000Z");
});

test("after 9pm the night before spring-forward lands on 9pm MDT", () => {
  assert.equal(mealGiftExpiresAt(new Date("2026-03-07T22:00:00-07:00")).toISOString(), "2026-03-09T03:00:00.000Z");
});

test("a missing timezone falls back to Denver", () => {
  assert.equal(mealGiftExpiresAt(new Date("2026-07-10T15:30:00-06:00"), null).toISOString(), "2026-07-11T03:00:00.000Z");
});
