import { describe, expect, it } from "vitest";
import { isEventDayClient } from "../events";

const TZ = "America/Denver";
// 2026-10-05 18:00 MDT = 2026-10-06 00:00 UTC: an evening event lands on the next UTC day.
const STARTS = "2026-10-06T00:00:00.000Z";

describe("isEventDayClient", () => {
  it("is true all through the event's day in its zone", () => {
    expect(isEventDayClient(STARTS, TZ, new Date("2026-10-05T06:00:00Z"))).toBe(true); // 00:00 MDT
    expect(isEventDayClient(STARTS, TZ, new Date("2026-10-05T15:00:00Z"))).toBe(true); // 09:00 MDT
    expect(isEventDayClient(STARTS, TZ, new Date("2026-10-06T05:59:00Z"))).toBe(true); // 23:59 MDT
  });

  it("is false the day before and the day after, even when UTC agrees", () => {
    expect(isEventDayClient(STARTS, TZ, new Date("2026-10-05T05:59:00Z"))).toBe(false); // 23:59 MDT on the 4th
    expect(isEventDayClient(STARTS, TZ, new Date("2026-10-06T06:00:00Z"))).toBe(false); // 00:00 MDT on the 6th
  });

  it("is false for a bad date or zone", () => {
    expect(isEventDayClient("nope", TZ, new Date())).toBe(false);
    expect(isEventDayClient(STARTS, "Not/AZone", new Date("2026-10-05T15:00:00Z"))).toBe(false);
  });
});
