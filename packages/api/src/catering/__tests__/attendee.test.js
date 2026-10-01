import { test } from "node:test";
import assert from "node:assert/strict";
import { isAttendeePath, normalizeGuestPhone, denverDateKey, isEventDay, filterMenuSteps, rsvpUpdateData, slugDateKey } from "../attendee.js";

test("attendee paths pass the gate; booking paths do not", () => {
  for (const p of ["/catering/events/x", "/catering/events/x/rsvp", "/catering/events/x/menu-steps", "/catering/orders/CAT-1/arrive", "/catering/menu", "/catering/site-config/order-now", "/catering/kitchen-locations"]) assert.equal(isAttendeePath(p), true, p);
  for (const p of ["/catering/bookings", "/catering/bookings/1/confirm", "/catering/availability", "/catering/dashboard/tok"]) assert.equal(isAttendeePath(p), false, p);
});

test("phones normalize to 10 digits", () => {
  assert.equal(normalizeGuestPhone("(801) 555-0100"), "8015550100");
  assert.equal(normalizeGuestPhone("+1 801 555 0100"), "8015550100");
  assert.equal(normalizeGuestPhone("8015550100"), "8015550100");
});

test("event day follows the Denver calendar, not UTC", () => {
  const eventDate = new Date("2026-10-05T00:00:00.000Z"); // 2026-10-04 18:00 MDT
  assert.equal(denverDateKey(eventDate), "2026-10-04");
  assert.equal(isEventDay(eventDate, new Date("2026-10-04T15:00:00.000Z")), true);  // 9am MDT same day
  assert.equal(isEventDay(eventDate, new Date("2026-10-05T03:00:00.000Z")), true);  // 9pm MDT same day
  assert.equal(isEventDay(eventDate, new Date("2026-10-05T07:00:00.000Z")), false); // 1am MDT next day
});

test("menu steps keep every soup, noodle and slider; no extras or drinks", () => {
  const steps = [
    { id: "bowl", title: "Bowl", sections: [
      { id: "soup", selectionMode: "SINGLE", items: [{ id: "s1", name: "Classic Beef Noodle Soup" }, { id: "s2", name: "American Wagyu Beef Noodle Soup" }] },
      { id: "noodles", selectionMode: "SINGLE", items: [{ id: "n1", name: "Ramen Noodles" }, { id: "n2", name: "Shaved Noodles" }] },
    ] },
    { id: "customize", title: "Customize", sections: [{ id: "sl1", selectionMode: "SLIDER", item: { id: "sl1", name: "Spice Level" } }] },
    { id: "extras", title: "Extras", sections: [] },
    { id: "drinks-desserts", title: "Drinks", sections: [] },
  ];
  const out = filterMenuSteps(steps);
  assert.deepEqual(out.map((s) => s.id), ["bowl", "customize"]);
  assert.deepEqual(out[0].sections[0].items.map((i) => i.id), ["s1", "s2"]);
  assert.deepEqual(out[0].sections[1].items.map((i) => i.id), ["n1", "n2"]);
  assert.equal(out[1].sections.length, 1);
});

test("menu prefix is exact; other catering paths stay closed", () => {
  assert.equal(isAttendeePath("/catering/menu-x"), false);
  assert.equal(isAttendeePath("/catering/bookings"), false);
  assert.equal(isAttendeePath("/catering/menu/x"), true);
  assert.equal(isAttendeePath("/catering/events/x/menu-steps"), true);
});

test("rsvpUpdateData keeps omitted dob and notes, clears only on empty string", () => {
  const z = () => "Horse";
  assert.deepEqual(rsvpUpdateData({ name: "A", phone: "1" }, z), { name: "A", phone: "1" });
  assert.deepEqual(rsvpUpdateData({ name: "A", phone: "1", dob: "03/14/1990", notes: " hi " }, z), { name: "A", phone: "1", dob: "03/14/1990", zodiac: "Horse", notes: "hi" });
  assert.deepEqual(rsvpUpdateData({ name: "A", phone: "1", dob: "", notes: "" }, z), { name: "A", phone: "1", dob: null, zodiac: null, notes: null });
});

test("slugDateKey keeps date-only strings and converts timestamps to Denver", () => {
  assert.equal(slugDateKey("2026-06-05"), "2026-06-05");
  assert.equal(slugDateKey("2026-10-05T00:00:00.000Z"), "2026-10-04");
  assert.equal(slugDateKey(new Date("2026-10-05T00:00:00.000Z")), "2026-10-04");
});
