import { describe, expect, it } from "vitest";
import { joinDob, phoneDigits, splitDob, validateGuest } from "../event-guest";

const ok = { name: "Kristy Lee", phone: "(801) 555-0155", month: "", day: "", year: "" };
const NOW = new Date("2026-10-01T12:00:00Z");

describe("phoneDigits", () => {
  it("strips punctuation and a leading country code", () => {
    expect(phoneDigits("(801) 555-0155")).toBe("8015550155");
    expect(phoneDigits("+1 801 555 0155")).toBe("8015550155");
    expect(phoneDigits("555-0155")).toBe("5550155");
  });
});

describe("validateGuest", () => {
  it("accepts a name and a 10 digit phone with no birthday", () => {
    expect(validateGuest(ok, NOW)).toEqual({});
  });
  it("needs a name and a 10 digit phone", () => {
    expect(validateGuest({ ...ok, name: "  ", phone: "555-0155" }, NOW)).toEqual({ name: "errorName", phone: "errorPhone" });
  });
  it("takes the birthday all or nothing, in range", () => {
    expect(validateGuest({ ...ok, month: "3", day: "", year: "" }, NOW)).toEqual({ birthday: "errorBirthday" });
    expect(validateGuest({ ...ok, month: "13", day: "1", year: "1990" }, NOW)).toEqual({ birthday: "errorBirthday" });
    expect(validateGuest({ ...ok, month: "2", day: "32", year: "1990" }, NOW)).toEqual({ birthday: "errorBirthday" });
    expect(validateGuest({ ...ok, month: "2", day: "3", year: "1899" }, NOW)).toEqual({ birthday: "errorBirthday" });
    expect(validateGuest({ ...ok, month: "2", day: "3", year: "2027" }, NOW)).toEqual({ birthday: "errorBirthday" });
    expect(validateGuest({ ...ok, month: "2", day: "3", year: "1990" }, NOW)).toEqual({});
  });
  it("rejects days the calendar does not have", () => {
    expect(validateGuest({ ...ok, month: "02", day: "31", year: "1990" }, NOW)).toEqual({ birthday: "errorBirthday" });
    expect(validateGuest({ ...ok, month: "02", day: "29", year: "1990" }, NOW)).toEqual({ birthday: "errorBirthday" });
    expect(validateGuest({ ...ok, month: "02", day: "29", year: "2000" }, NOW)).toEqual({});
  });
});

describe("joinDob / splitDob", () => {
  it("writes MM/DD/YYYY and reads it back", () => {
    expect(joinDob("2", "3", "1990")).toBe("02/03/1990");
    expect(joinDob("", "", "")).toBeNull();
    expect(splitDob("02/03/1990")).toEqual({ month: "02", day: "03", year: "1990" });
  });
  it("reads an ISO date too, and nothing from junk", () => {
    expect(splitDob("1990-02-03")).toEqual({ month: "02", day: "03", year: "1990" });
    expect(splitDob("1990-02-03T00:00:00.000Z")).toEqual({ month: "02", day: "03", year: "1990" });
    expect(splitDob(null)).toEqual({ month: "", day: "", year: "" });
    expect(splitDob("soon")).toEqual({ month: "", day: "", year: "" });
  });
});
