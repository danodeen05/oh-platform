import type { CorporateOverheadAssumptions, OverheadLine, OverheadRole, OverheadYear } from "./types";

/**
 * Corporate overhead (2026-09-26 re-baseline, finding K1). The spec had no
 * layer above the unit P&L: no founder salary, no finance, no engineering
 * after the build, no franchise team, no audit, no FDD. This is the role
 * schedule the plan actually needs, month-dated against the flagship
 * opening (T0 = month 0; negative months are pre-opening hires and are
 * booked in plan year 1). Salaries carry an 18% burden; fees and other
 * lines do not. The pre-T0 platform build is funded from round 1's
 * platform-development line, so engineering here starts at T0.
 *
 * Full: about $1.0M / $1.5M / $2.2M / $2.7M / $2.9M in years 1 to 5.
 * Lean: hires staged behind signed deals, about $0.8M / $1.1M / $1.4M / $1.9M / $2.3M.
 * The base case uses the full schedule; lean is shown as a case.
 */

const one = (): number => 1;

const FULL_ROLES: readonly OverheadRole[] = Object.freeze([
  // Owner decision 2026-09-26: founder compensation $180,000, from nine months before opening.
  { key: "founder", title: "Founder and CEO", annual: 180_000, startMonth: -9, kind: "salary" },
  { key: "cfo", title: "Fractional CFO", annual: 60_000, startMonth: -3, endMonth: 24, kind: "salary" },
  { key: "controller", title: "Controller", annual: 115_000, startMonth: 24, kind: "salary" },
  { key: "marketing", title: "Marketing lead", annual: 95_000, startMonth: -2, kind: "salary" },
  { key: "engineering", title: "Oh! OS engineering", annual: 140_000, startMonth: 0, kind: "salary", count: (year) => (year <= 1 ? 1 : year <= 3 ? 2 : year <= 4 ? 3 : 4) },
  { key: "support", title: "Support and IT", annual: 70_000, startMonth: 24, kind: "salary" },
  { key: "operations", title: "Director of Operations", annual: 130_000, startMonth: 10, kind: "salary" },
  { key: "people", title: "HR and people", annual: 85_000, startMonth: 24, kind: "salary" },
  { key: "supply", title: "Supply chain and commissary lead", annual: 95_000, startMonth: 12, kind: "salary" },
  { key: "ea", title: "Executive assistant and office", annual: 60_000, startMonth: 24, kind: "salary" },
  { key: "analytics", title: "Analytics", annual: 110_000, startMonth: 24, kind: "salary" },
  { key: "training", title: "Training lead", annual: 85_000, startMonth: 12, kind: "salary" },
  { key: "franchiseDev", title: "Franchise development director", annual: 140_000, startMonth: 24, kind: "salary" },
  { key: "franchiseSupport", title: "Franchise support managers (1 per 10 units)", annual: 90_000, startMonth: 36, kind: "salary", count: (_y, _c, f) => Math.ceil(f / 10) },
  { key: "international", title: "International development", annual: 150_000, startMonth: 36, kind: "salary" },
  { key: "legal", title: "Legal", annual: 50_000, startMonth: 0, kind: "fees", count: (year) => (year >= 2 ? 1.5 : 1) },
  { key: "accounting", title: "Accounting and audit (audit from year 2)", annual: 30_000, startMonth: 0, kind: "fees", count: (year) => (year >= 2 ? 2 : 1) },
  { key: "fdd", title: "FDD build", annual: 80_000, startMonth: 12, kind: "fees", onlyYear: 2 },
  { key: "registrations", title: "FDD renewals and state registrations", annual: 55_000, startMonth: 24, kind: "fees" },
  { key: "intlFilings", title: "International trademarks and franchise-law filings", annual: 50_000, startMonth: 36, kind: "fees" },
  { key: "do", title: "D&O insurance", annual: 20_000, startMonth: 0, kind: "fees" },
  { key: "keyPerson", title: "Key-person insurance", annual: 10_000, startMonth: 0, kind: "fees" },
  { key: "travel", title: "Travel", annual: 30_000, startMonth: 0, kind: "other", count: (_y, c, f) => 1 + 0.5 * Math.max(0, c - 1) + 0.15 * f },
  { key: "office", title: "Office", annual: 48_000, startMonth: -2, kind: "other", count: (year) => (year >= 3 ? 2 : 1) },
  { key: "tools", title: "Software and tools", annual: 25_000, startMonth: 0, kind: "other", count: (_y, c, f) => 1 + 0.15 * (c + f) },
]);

export const CORPORATE_OVERHEAD: CorporateOverheadAssumptions = Object.freeze({ key: "full", roles: FULL_ROLES, payrollBurdenPct: 0.18 });

const LEAN_ROLES: readonly OverheadRole[] = Object.freeze([
  { key: "founder", title: "Founder and CEO", annual: 180_000, startMonth: -3, kind: "salary" },
  { key: "cfo", title: "Fractional CFO", annual: 60_000, startMonth: 0, endMonth: 36, kind: "salary" },
  { key: "controller", title: "Controller", annual: 115_000, startMonth: 36, kind: "salary" },
  { key: "marketing", title: "Marketing lead", annual: 95_000, startMonth: 0, kind: "salary" },
  { key: "engineering", title: "Oh! OS engineering", annual: 140_000, startMonth: 0, kind: "salary", count: (year) => (year <= 3 ? 1 : 2) },
  { key: "support", title: "Support and IT", annual: 70_000, startMonth: 36, kind: "salary" },
  { key: "operations", title: "Director of Operations", annual: 130_000, startMonth: 10, kind: "salary" },
  { key: "people", title: "HR and people", annual: 85_000, startMonth: 36, kind: "salary" },
  { key: "supply", title: "Supply chain and commissary lead", annual: 95_000, startMonth: 12, kind: "salary" },
  { key: "ea", title: "Executive assistant and office", annual: 60_000, startMonth: 48, kind: "salary" },
  { key: "analytics", title: "Analytics", annual: 110_000, startMonth: 48, kind: "salary" },
  { key: "training", title: "Training lead", annual: 85_000, startMonth: 24, kind: "salary" },
  { key: "franchiseDev", title: "Franchise development director", annual: 140_000, startMonth: 30, kind: "salary" },
  { key: "franchiseSupport", title: "Franchise support managers (1 per 12 units)", annual: 90_000, startMonth: 48, kind: "salary", count: (_y, _c, f) => Math.ceil(f / 12) },
  { key: "international", title: "International development", annual: 150_000, startMonth: 48, kind: "salary" },
  { key: "legal", title: "Legal", annual: 40_000, startMonth: 0, kind: "fees", count: (year) => (year >= 2 ? 1.5 : 1) },
  { key: "accounting", title: "Accounting and audit (audit from year 2)", annual: 30_000, startMonth: 0, kind: "fees", count: (year) => (year >= 2 ? 1.67 : 1) },
  { key: "fdd", title: "FDD build", annual: 80_000, startMonth: 24, kind: "fees", onlyYear: 3 },
  { key: "registrations", title: "FDD renewals and state registrations", annual: 55_000, startMonth: 48, kind: "fees" },
  { key: "intlFilings", title: "International trademarks and franchise-law filings", annual: 50_000, startMonth: 60, kind: "fees" },
  { key: "do", title: "D&O insurance", annual: 20_000, startMonth: 0, kind: "fees" },
  { key: "keyPerson", title: "Key-person insurance", annual: 10_000, startMonth: 0, kind: "fees" },
  { key: "travel", title: "Travel", annual: 20_000, startMonth: 0, kind: "other", count: (_y, c, f) => 1 + 0.5 * Math.max(0, c - 1) + 0.15 * f },
  { key: "office", title: "Office", annual: 36_000, startMonth: 0, kind: "other", count: (year) => (year >= 4 ? 2 : 1) },
  { key: "tools", title: "Software and tools", annual: 20_000, startMonth: 0, kind: "other", count: (_y, c, f) => 1 + 0.15 * (c + f) },
]);

/** Hires staged behind signed deals; a case, not the base. */
export const LEAN_OVERHEAD: CorporateOverheadAssumptions = Object.freeze({ key: "lean", roles: LEAN_ROLES, payrollBurdenPct: 0.18 });

/**
 * Months of a role that fall in a plan year. Year 1 also absorbs every
 * month before T0 (pre-opening hires), which is why year 1 can carry more
 * than twelve months of a role.
 */
export function roleMonthsInYear(role: Pick<OverheadRole, "startMonth" | "endMonth" | "onlyYear">, year: number): number {
  if (role.onlyYear !== undefined) return role.onlyYear === year ? 12 : 0;
  const lo = year === 1 ? Number.NEGATIVE_INFINITY : (year - 1) * 12;
  const hi = year * 12;
  const start = Math.max(role.startMonth, lo);
  const end = Math.min(role.endMonth ?? Number.POSITIVE_INFINITY, hi);
  if (year === 1 && end <= start) return 0;
  return Math.max(0, end - start);
}

export function computeOverhead(year: number, corporateUnits: number, franchiseUnits: number, schedule: CorporateOverheadAssumptions = CORPORATE_OVERHEAD): OverheadYear {
  if (year < 1) throw new RangeError("year must be 1 or later");
  const lines: OverheadLine[] = [];
  let salaries = 0;
  let fees = 0;
  let other = 0;
  let headcount = 0;
  for (const role of schedule.roles) {
    const months = roleMonthsInYear(role, year);
    const count = (role.count ?? one)(year, corporateUnits, franchiseUnits);
    const amount = (role.annual * months * count) / 12;
    if (amount <= 0) continue;
    lines.push({ key: role.key, title: role.title, kind: role.kind, headcount: role.kind === "salary" ? count : 0, amount });
    if (role.kind === "salary") {
      salaries += amount;
      headcount += count;
    } else if (role.kind === "fees") fees += amount;
    else other += amount;
  }
  const burden = salaries * schedule.payrollBurdenPct;
  return { year, lines, salaries, burden, fees, other, total: salaries + burden + fees + other, headcount };
}



