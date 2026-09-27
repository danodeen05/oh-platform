import { describe, expect, it } from "vitest";
import { AGGRESSIVE_COVERAGE, CONSERVATIVE_COVERAGE, COVERAGE_FACTOR, COVERAGE_SCHEDULE, coverageFTE, coverageHoursPerDay, coverageToFTE } from "../index";

describe("coverage schedule", () => {
  it("sums to 75 / 70 / 85 hours a day after cross-training", () => {
    expect(coverageHoursPerDay(COVERAGE_SCHEDULE)).toBe(75);
    expect(coverageHoursPerDay(CONSERVATIVE_COVERAGE)).toBe(70);
    expect(coverageHoursPerDay(AGGRESSIVE_COVERAGE)).toBe(85);
    expect(COVERAGE_SCHEDULE.shifts.reduce((s, x) => s + x.count, 0)).toBe(9);
  });
  it("converts hours to FTE with the coverage uplift", () => {
    expect(coverageToFTE(75, 313, COVERAGE_FACTOR, 2080)).toBeCloseTo(11.7375, 9);
    expect(coverageFTE(75, 313, COVERAGE_FACTOR, 2080)).toBe(11.7);
    expect(coverageFTE(70, 313, COVERAGE_FACTOR, 2080)).toBe(11);
    expect(coverageFTE(85, 313, COVERAGE_FACTOR, 2080)).toBe(13.3);
    // The spec's 7 FTE was 70 hours over 355 days with no coverage at 2,080 hours: 11.9, not 7.
    expect(coverageFTE(70, 355, 0, 2080)).toBe(11.9);
    expect(() => coverageToFTE(75, 313, 0.04, 0)).toThrow(RangeError);
  });
});
