import { test } from "node:test";
import assert from "node:assert/strict";
import { slotsFor } from "../operating-hours.js";

const DENVER = { id: "L1", timezone: "America/Denver", isClosed: false };
const QUARTER_MS = 15 * 60 * 1000;

function denverClock(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

test("Review Focus 4: slots on the DST fall-back day (2026-11-01) have no duplicates, no gaps, none after close minus 15", () => {
  const location = { ...DENVER, operatingHours: { sun: { open: "00:00", close: "21:00" } } };
  // Early that morning, before the 02:00 MDT -> 01:00 MST change.
  const now = new Date("2026-11-01T00:05:00-06:00");
  const slots = slotsFor(location, "2026-11-01", now);

  const times = slots.map((s) => s.getTime());
  assert.equal(new Set(times).size, times.length, "no duplicate instants");
  for (let i = 1; i < times.length; i++) {
    assert.equal(times[i] - times[i - 1], QUARTER_MS, `gap or overlap after ${slots[i - 1].toISOString()}`);
  }
  const labels = slots.map(denverClock);
  assert.equal(labels[0], "00:15", "first slot is the next quarter after now");
  assert.equal(labels.at(-1), "20:45", "last slot is close minus 15");
  assert.ok(!labels.includes("20:50") && !labels.includes("21:00"));
  // 00:15 .. 20:45 local is 20.5 wall hours, and the repeated 01:00 hour adds 4 real quarters.
  assert.equal(slots.length, 83 + 4);
  // 01:15 local happens twice that night (MDT then MST): both real instants are offered once each.
  assert.equal(labels.filter((l) => l === "01:15").length, 2);
});

test("an ordinary day: slots start at open and stop at close minus 15, in Denver time", () => {
  const location = { ...DENVER };
  const now = new Date("2026-10-01T08:00:00-06:00"); // before the 11:00 open
  const slots = slotsFor(location, "2026-10-01", now);
  const labels = slots.map(denverClock);
  assert.equal(labels[0], "11:00");
  assert.equal(labels.at(-1), "20:45");
  assert.equal(slots.length, 40);
});

test("a closed day or a closed location has no slots", () => {
  assert.deepEqual(slotsFor({ ...DENVER }, "2026-10-04", new Date("2026-10-04T08:00:00-06:00")), []); // Sunday, default hours closed
  assert.deepEqual(slotsFor({ ...DENVER, isClosed: true }, "2026-10-01", new Date("2026-10-01T08:00:00-06:00")), []);
});

test("past slots are dropped", () => {
  const slots = slotsFor({ ...DENVER }, "2026-10-01", new Date("2026-10-01T20:40:00-06:00"));
  assert.deepEqual(slots.map(denverClock), ["20:45"]);
});
