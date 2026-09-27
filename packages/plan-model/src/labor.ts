/**
 * Kitchen coverage (2026-09-26 re-baseline, finding L1).
 *
 * The spec staffed 7 FTE, which is one day's schedule, not the hours a
 * 10-hour service actually consumes across a week. The plan's own
 * Operations page shows the day: here it is as a schedule, summed to hours
 * per operating day, then converted to FTE with a coverage uplift for PTO,
 * sick time and training. Presets derive kitchenFTE from this at build
 * time so the labor line is traceable to a roster, not a guess.
 */
export interface CoverageShift {
  key: string;
  role: string;
  /** People on the shift. */
  count: number;
  /** Paid hours each, per operating day. */
  hours: number;
}

export interface CoverageSchedule {
  key: "base" | "conservative" | "aggressive";
  shifts: readonly CoverageShift[];
  /** Hours saved per day by cross-training (a runner covers the dish pit at close, etc.). */
  crossTrainingHours: number;
}

const BASE_SHIFTS: readonly CoverageShift[] = Object.freeze([
  { key: "broth", role: "Broth and protein lead", count: 1, hours: 9 },
  { key: "noodle", role: "Noodle and assembly lead", count: 1, hours: 11 },
  { key: "assembly", role: "Assembly", count: 2, hours: 11 },
  { key: "runner", role: "Pod runner", count: 2, hours: 11 },
  { key: "peak", role: "Peak runner", count: 2, hours: 6 },
  { key: "close", role: "Close and dish", count: 1, hours: 4 },
]);

/** 75 paid hours per operating day; the base case. */
export const COVERAGE_SCHEDULE: CoverageSchedule = Object.freeze({ key: "base", shifts: BASE_SHIFTS, crossTrainingHours: 5 });

/** 70 hours: one peak runner shift dropped to 4 hours and the close shift folded into assembly. */
export const CONSERVATIVE_COVERAGE: CoverageSchedule = Object.freeze({
  key: "conservative",
  shifts: Object.freeze([
    { key: "broth", role: "Broth and protein lead", count: 1, hours: 9 },
    { key: "noodle", role: "Noodle and assembly lead", count: 1, hours: 11 },
    { key: "assembly", role: "Assembly", count: 2, hours: 11 },
    { key: "runner", role: "Pod runner", count: 2, hours: 11 },
    { key: "peak", role: "Peak runner", count: 2, hours: 4 },
    { key: "close", role: "Close and dish", count: 1, hours: 3 },
  ]),
  crossTrainingHours: 5,
});

/** 85 hours: a third runner through the peak and a longer close, for 600 covers a day. */
export const AGGRESSIVE_COVERAGE: CoverageSchedule = Object.freeze({
  key: "aggressive",
  shifts: Object.freeze([
    { key: "broth", role: "Broth and protein lead", count: 1, hours: 10 },
    { key: "noodle", role: "Noodle and assembly lead", count: 1, hours: 11 },
    { key: "assembly", role: "Assembly", count: 2, hours: 11 },
    { key: "runner", role: "Pod runner", count: 2, hours: 11 },
    { key: "peak", role: "Peak runner", count: 3, hours: 7 },
    { key: "close", role: "Close and dish", count: 1, hours: 4 },
  ]),
  crossTrainingHours: 5,
});

/** Paid hours per operating day after cross-training. */
export function coverageHoursPerDay(s: CoverageSchedule): number {
  return s.shifts.reduce((sum, x) => sum + x.count * x.hours, 0) - s.crossTrainingHours;
}

/** Default coverage uplift for PTO, sick time and training. */
export const COVERAGE_FACTOR = 0.04;

/**
 * Hours per operating day to annual FTE: hours × days × (1 + coverage) ÷ hours per FTE.
 * 75 × 313 × 1.04 ÷ 2,080 = 11.7 FTE.
 */
export function coverageToFTE(hoursPerDay: number, operatingDays: number, coverageFactor: number, annualHoursPerFTE: number): number {
  if (annualHoursPerFTE <= 0) throw new RangeError("annualHoursPerFTE must be positive");
  return (hoursPerDay * operatingDays * (1 + coverageFactor)) / annualHoursPerFTE;
}

/** FTE rounded to the kitchenFTE lever's 0.1 step. */
export function coverageFTE(hoursPerDay: number, operatingDays: number, coverageFactor: number, annualHoursPerFTE: number): number {
  return Math.round(coverageToFTE(hoursPerDay, operatingDays, coverageFactor, annualHoursPerFTE) * 10) / 10;
}
