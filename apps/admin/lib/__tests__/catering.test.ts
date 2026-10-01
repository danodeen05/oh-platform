import { expect, test } from "vitest";
import {
  areaTone, combineDateTime, emptyEventForm, dobToInput, formatBirthday, formatPhone, formFromEvent, inputToDob, splitDateTime, eventBody, isSpecialDiet, SLOT_PRICE, statusLabel, statusTone, surveyTone, validateEvent,
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

test("formatBirthday returns the raw string for an impossible month", () => {
  expect(formatBirthday("13/01/1990")).toBe("13/01/1990");
});
test("formatPhone formats 10 digits and leaves anything else alone", () => {
  expect(formatPhone("8015550100")).toBe("(801) 555-0100");
  expect(formatPhone("(801) 555-0100")).toBe("(801) 555-0100");
  expect(formatPhone("18015550100")).toBe("(801) 555-0100");
  expect(formatPhone("555-0100")).toBe("555-0100");
  expect(formatPhone("")).toBe("");
  expect(formatPhone(null)).toBe("");
});
test("dobToInput and inputToDob convert and reject bad input", () => {
  expect(dobToInput("03/14/1990")).toBe("1990-03-14");
  expect(dobToInput("")).toBe("");
  expect(dobToInput(null)).toBe("");
  expect(dobToInput("1990-03-14")).toBe("");
  expect(inputToDob("1990-03-14")).toBe("03/14/1990");
  expect(inputToDob("")).toBe("");
  expect(inputToDob("03/14/1990")).toBe("");
});
test("formFromEvent keeps a listed start time and the Denver date", () => {
  const f = formFromEvent({ eventDate: "2026-10-05T00:00:00.000Z", slot: "DINNER", pricePerBowlCents: 0 } as never);
  expect(f).toMatchObject({ eventDate: "2026-10-04", startTime: "18:00", complimentary: true });
});
test("formFromEvent snaps an unlisted stored time to the slot default, keeping the Denver date", () => {
  const f = formFromEvent({ eventDate: "2026-12-20T07:00:00.000Z", slot: "LUNCH", pricePerBowlCents: 2499 } as never);
  expect(f.eventDate).toBe("2026-12-20"); // 00:00 MST, not a Select option
  expect(f.startTime).toBe("12:00");
});
test("formFromEvent: a legacy midnight-UTC date shows the previous Denver day at 17:00 MST (listed, kept)", () => {
  const f = formFromEvent({ eventDate: "2026-12-20T00:00:00.000Z", slot: "LUNCH", pricePerBowlCents: 2499 } as never);
  expect(f.eventDate).toBe("2026-12-19");
  expect(f.startTime).toBe("17:00");
});
test("eventBody sends null for an emptied host and welcome note on edit only", () => {
  const f = validForm({ hostName: " ", welcomeNote: "" });
  expect(eventBody(f, true)).toMatchObject({ hostName: null, welcomeNote: null });
  expect(eventBody(f, false).hostName).toBeUndefined();
});
