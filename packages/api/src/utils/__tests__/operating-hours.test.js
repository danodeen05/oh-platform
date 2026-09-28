import { test } from "node:test";
import assert from "node:assert/strict";
import { slotsFor, weeklyHours } from "../operating-hours.js";

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

// Task E1 fix round 1: the hours Chappy tells customers (get_locations).
test("weeklyHours: default hours at the Denver close edge, 20:59 open and 21:00 closed (MDT)", () => {
  // 2026-10-01 is a Thursday. With operatingHours null the defaults apply (Mon-Sat 11:00-21:00).
  const at = (hhmm) => weeklyHours({ ...DENVER, operatingHours: null }, new Date(`2026-10-01T${hhmm}:00-06:00`));
  const before = at("20:59");
  assert.equal(before.openNow, true);
  assert.equal(before.hoursSource, "default");
  assert.equal(before.timezone, "America/Denver");
  assert.deepEqual(before.today, { day: "thu", open: "11:00", close: "21:00" });
  assert.equal(at("21:00").openNow, false);
  assert.equal(at("10:59").openNow, false);
  assert.equal(at("11:00").openNow, true);
  // 21:00 in Denver is already Friday in UTC: "today" follows Denver, not UTC or the server clock.
  assert.equal(at("21:00").today.day, "thu");
  assert.deepEqual(before.week.map((d) => d.day), ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  assert.deepEqual(before.week[6], { day: "sun", closed: true });
});

test("weeklyHours: Sunday is closed by default; a location's own hours win and say so", () => {
  const sunday = new Date("2026-10-04T13:00:00-06:00");
  const d = weeklyHours({ ...DENVER }, sunday);
  assert.equal(d.openNow, false);
  assert.deepEqual(d.today, { day: "sun", closed: true });
  const own = weeklyHours({ ...DENVER, operatingHours: { sun: { open: "12:00", close: "20:00" }, mon: { open: "11:00", close: "21:00" } } }, sunday);
  assert.equal(own.hoursSource, "location");
  assert.equal(own.openNow, true);
  assert.deepEqual(own.today, { day: "sun", open: "12:00", close: "20:00" });
  assert.deepEqual(own.week[1], { day: "tue", closed: true }, "a day missing from operatingHours is closed, as ordering treats it");
});

test("weeklyHours: isClosed closes today and the whole week, whatever the hours say", () => {
  const r = weeklyHours({ ...DENVER, isClosed: true }, new Date("2026-10-01T12:00:00-06:00"));
  assert.equal(r.temporarilyClosed, true);
  assert.equal(r.openNow, false);
  assert.deepEqual(r.today, { day: "thu", closed: true });
  assert.ok(r.week.every((day) => day.closed === true));
});
