import { expect, test } from "vitest";
import {
  areaTone, combineDateTime, emptyEventForm, formatBirthday, splitDateTime, eventBody, isSpecialDiet, SLOT_PRICE, statusLabel, statusTone, surveyTone, validateEvent,
  type EventForm,
} from "../catering";

const validForm = (over: Partial<EventForm> = {}): EventForm => ({
  ...emptyEventForm(),
  clientCompany: "Acme Corp",
  eventDate: "2026-10-01",
  pricePerBowlCents: "24.99",
  minimumBowls: "10",
  ...over,
});

test("validateEvent requires company and date", () => {
  const errs = validateEvent(validForm({ clientCompany: "  ", eventDate: "" }));
  expect(errs.clientCompany).toBeTruthy();
  expect(errs.eventDate).toBeTruthy();
  expect(validateEvent(validForm())).toEqual({});
});

test("validateEvent requires an integer-cents price above 0, entered in dollars", () => {
  expect(validateEvent(validForm({ pricePerBowlCents: "0" })).pricePerBowlCents).toBeTruthy();
  expect(validateEvent(validForm({ pricePerBowlCents: "" })).pricePerBowlCents).toBeTruthy();
  expect(validateEvent(validForm({ pricePerBowlCents: "abc" })).pricePerBowlCents).toBeTruthy();
  expect(validateEvent(validForm({ pricePerBowlCents: "24.99" })).pricePerBowlCents).toBeUndefined();
});

test("validateEvent requires a whole minimum bowls above 0", () => {
  expect(validateEvent(validForm({ minimumBowls: "0" })).minimumBowls).toBeTruthy();
  expect(validateEvent(validForm({ minimumBowls: "1.5" })).minimumBowls).toBeTruthy();
  expect(validateEvent(validForm({ minimumBowls: "10" })).minimumBowls).toBeUndefined();
});

test("validateEvent requires lat/lng to be floats only when present", () => {
  expect(validateEvent(validForm({ eventLat: "", eventLng: "" }))).toEqual({});
  expect(validateEvent(validForm({ eventLat: "40.76", eventLng: "-111.89" }))).toEqual({});
  expect(validateEvent(validForm({ eventLat: "not-a-number" })).eventLat).toBeTruthy();
  expect(validateEvent(validForm({ eventLng: "not-a-number" })).eventLng).toBeTruthy();
});

test("SLOT_PRICE gives the default per-bowl price for each slot", () => {
  expect(SLOT_PRICE).toEqual({ LUNCH: 2499, DINNER: 2999 });
});

test("eventBody sends empty optional strings as undefined and filters brand colours", () => {
  const body = eventBody(validForm({ contactName: "  ", brandColors: ["#111111", "", "#222222"] }), false);
  expect(body.contactName).toBeUndefined();
  expect(body.clientWebsite).toBeUndefined();
  expect(body.brandColors).toEqual(["#111111", "#222222"]);
});

test("eventBody sends expectedGuests as an int above 0 or null", () => {
  expect(eventBody(validForm({ expectedGuests: "40" }), false).expectedGuests).toBe(40);
  expect(eventBody(validForm({ expectedGuests: "0" }), false).expectedGuests).toBeNull();
  expect(eventBody(validForm({ expectedGuests: "" }), false).expectedGuests).toBeNull();
  expect(eventBody(validForm({ expectedGuests: "-5" }), false).expectedGuests).toBeNull();
});

test("eventBody adds status and bookedBowls only when editing", () => {
  const created = eventBody(validForm({ status: "LIVE", bookedBowls: "12" }), false);
  expect(created).not.toHaveProperty("status");
  expect(created).not.toHaveProperty("bookedBowls");

  const edited = eventBody(validForm({ status: "LIVE", bookedBowls: "12" }), true);
  expect(edited.status).toBe("LIVE");
  expect(edited.bookedBowls).toBe(12);
});

test("statusLabel and statusTone cover every status", () => {
  expect(statusLabel("PLANNING")).toBe("Planning");
  expect(statusLabel("NEEDS_REVIEW")).toBe("Needs review");
  expect(statusTone("LIVE")).toBe("good");
  expect(statusTone("NEEDS_REVIEW")).toBe("alert");
});

test("isSpecialDiet matches the unchanged regex against item name or selected value", () => {
  const item = (name: string, selectedValue?: string) => ({ menuItem: { name }, selectedValue, quantity: 1 });
  expect(isSpecialDiet({ items: [item("Classic Bowl", "No beef")] } as never)).toBe(true);
  expect(isSpecialDiet({ items: [item("Vegetarian Bowl")] } as never)).toBe(true);
  expect(isSpecialDiet({ items: [item("Classic Bowl")] } as never)).toBe(false);
});

test("surveyTone and areaTone follow the scoring thresholds", () => {
  expect(surveyTone(4.2)).toBe("good");
  expect(surveyTone(3.1)).toBe("pending");
  expect(surveyTone(2.9)).toBe("alert");
  expect(areaTone(3.5, true)).toBe("alert");
  expect(areaTone(4.5, true)).toBe("neutral");
  expect(areaTone(3.5, false)).toBe("neutral");
});

test("combineDateTime builds the Denver wall clock", () => {
  expect(combineDateTime("2026-10-04", "18:00")).toBe("2026-10-05T00:00:00.000Z"); // MDT
  expect(combineDateTime("2026-12-20", "18:00")).toBe("2026-12-21T01:00:00.000Z"); // MST
});
test("combineDateTime handles the DST change days", () => {
  expect(combineDateTime("2026-03-08", "12:00")).toBe("2026-03-08T18:00:00.000Z"); // MDT after spring forward
  expect(combineDateTime("2026-11-01", "12:00")).toBe("2026-11-01T19:00:00.000Z"); // MST after fall back
});
test("splitDateTime inverts it", () => {
  expect(splitDateTime("2026-10-05T00:00:00.000Z")).toEqual({ date: "2026-10-04", time: "18:00" });
  expect(splitDateTime("2026-12-21T01:00:00.000Z")).toEqual({ date: "2026-12-20", time: "18:00" });
});
test("formatBirthday", () => {
  expect(formatBirthday("03/14/1990")).toBe("Mar 14, 1990");
  expect(formatBirthday(null)).toBe("");
});
