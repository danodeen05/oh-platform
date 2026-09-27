import { test } from "node:test";
import assert from "node:assert/strict";
import { startOfDenverDay } from "../time.js";

test("winter (MST, UTC-7): local midnight is 07:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-01-15T20:00:00Z")).toISOString(), "2026-01-15T07:00:00.000Z");
});
test("summer (MDT, UTC-6): local midnight is 06:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-07-15T20:00:00Z")).toISOString(), "2026-07-15T06:00:00.000Z");
});
test("11:30 pm local still belongs to that local day", () => {
  // 2026-07-15 23:30 MDT = 2026-07-16T05:30Z
  assert.equal(startOfDenverDay(new Date("2026-07-16T05:30:00Z")).toISOString(), "2026-07-15T06:00:00.000Z");
});
test("DST start day (2026-03-08) starts at 07:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-03-08T18:00:00Z")).toISOString(), "2026-03-08T07:00:00.000Z");
});
test("DST end day (2026-11-01) starts at 06:00Z", () => {
  assert.equal(startOfDenverDay(new Date("2026-11-01T18:00:00Z")).toISOString(), "2026-11-01T06:00:00.000Z");
});
