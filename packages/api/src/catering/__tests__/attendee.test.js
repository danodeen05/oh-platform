import { test } from "node:test";
import assert from "node:assert/strict";
import { isAttendeePath, normalizeGuestPhone, denverDateKey, isEventDay, filterMenuSteps, rsvpUpdateData, slugDateKey, resolveGuestZodiac } from "../attendee.js";

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

test("menu steps keep every soup and slider; no extras or drinks", () => {
  const steps = [
    { id: "bowl", title: "Bowl", sections: [
      { id: "soup", selectionMode: "SINGLE", items: [{ id: "s1", name: "Classic Beef Noodle Soup" }, { id: "s2", name: "American Wagyu Beef Noodle Soup" }] },
    ] },
    { id: "customize", title: "Customize", sections: [{ id: "sl1", selectionMode: "SLIDER", item: { id: "sl1", name: "Spice Level" } }] },
    { id: "extras", title: "Extras", sections: [] },
    { id: "drinks-desserts", title: "Drinks", sections: [] },
  ];
  const out = filterMenuSteps(steps);
  assert.deepEqual(out.map((s) => s.id), ["bowl", "customize"]);
  assert.deepEqual(out[0].sections[0].items.map((i) => i.id), ["s1", "s2"]);
  assert.equal(out[0].sections.length, 1);
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

test("guest zodiac: the order's own, else the RSVP with the same phone, else null", () => {
  const rsvps = [{ phone: "8015550199", zodiac: "Ox" }, { phone: "8015550155", zodiac: "Horse" }];
  assert.equal(resolveGuestZodiac({ guestZodiac: "Dragon", guestPhone: "8015550155" }, rsvps), "Dragon");
  assert.equal(resolveGuestZodiac({ guestZodiac: null, guestPhone: "+1 (801) 555-0155" }, rsvps), "Horse");
  assert.equal(resolveGuestZodiac({ guestZodiac: null, guestPhone: "8015550100" }, rsvps), null);
  assert.equal(resolveGuestZodiac({ guestZodiac: null, guestPhone: null }, rsvps), null);
  assert.equal(resolveGuestZodiac({ guestZodiac: null, guestPhone: "8015550155" }, [{ phone: "8015550155", zodiac: null }]), null);
  assert.equal(resolveGuestZodiac(null), null);
});

test("guestPhoneOrNull accepts only phones that normalize to 10 digits", async () => {
  const { guestPhoneOrNull } = await import("../attendee.js");
  assert.equal(guestPhoneOrNull("-"), null);
  assert.equal(guestPhoneOrNull("0"), null);
  assert.equal(guestPhoneOrNull(""), null);
  assert.equal(guestPhoneOrNull(undefined), null);
  assert.equal(guestPhoneOrNull("801555010"), null);
  assert.equal(guestPhoneOrNull("(801) 555-0100"), "8015550100");
  assert.equal(guestPhoneOrNull("+18015550100"), "8015550100");
});

test("withGuestNotes attaches the RSVP's notes by normalized phone", async () => {
  const { withGuestNotes } = await import("../attendee.js");
  const orders = [
    { id: "a", guestPhone: "8015550100" },
    { id: "b", guestPhone: "+1 (801) 555-0101" },
    { id: "c", guestPhone: null },
    { id: "d", guestPhone: "8015550102" },
  ];
  const rsvps = [
    { phone: "18015550100", notes: " peanut allergy " },
    { phone: "8015550101", notes: "no cilantro" },
    { phone: "8015550102", notes: "   " },
    { phone: "", notes: "orphan" },
  ];
  assert.deepEqual(withGuestNotes(orders, rsvps).map((o) => [o.id, o.guestNotes]), [["a", "peanut allergy"], ["b", "no cilantro"], ["c", null], ["d", null]]);
  assert.equal(withGuestNotes(orders, rsvps)[0].guestPhone, "8015550100");
});
