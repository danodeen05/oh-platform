import { OPENING_SCHEDULE } from "@oh/plan-model";

export type Workstream = "realEstate" | "buildout" | "legal" | "technology" | "capital" | "hiring";
export const WORKSTREAMS: readonly Workstream[] = ["realEstate", "buildout", "legal", "technology", "capital", "hiring"];

export interface RoadmapItem {
  key: string;
  workstream: Workstream;
  /** Months relative to T0 (flagship opening). */
  start: number;
  end: number;
  done?: boolean;
  /** Milestone (single point) rather than a bar. */
  milestone?: boolean;
  /** Location key when the item belongs to an opening. */
  location?: string;
}

const openings = OPENING_SCHEDULE.map((o) => o.openMonth);

/**
 * Roadmap (spec 6.11). Everything hangs off T0 so it never goes stale.
 * Pre-formation items completed to date come from the post-formation
 * checklist: EIN and Articles are done; the rest are pending and shown so.
 */
export const ROADMAP: readonly RoadmapItem[] = [
  { key: "articles", workstream: "legal", start: -12, end: -12, done: true, milestone: true },
  { key: "ein", workstream: "legal", start: -11.5, end: -11.5, done: true, milestone: true },
  { key: "operatingAgreement", workstream: "legal", start: -9, end: -9, milestone: true },
  { key: "tap", workstream: "legal", start: -9, end: -8 },
  { key: "round1", workstream: "capital", start: -10, end: -8 },
  { key: "flagshipLease", workstream: "realEstate", start: -10, end: -9, location: "lehi" },
  { key: "design", workstream: "buildout", start: -9, end: -6 },
  { key: "podFabrication", workstream: "buildout", start: -7, end: -1 },
  { key: "flagshipBuildout", workstream: "buildout", start: -6, end: -0.5, location: "lehi" },
  { key: "planReview", workstream: "legal", start: -7, end: -5 },
  { key: "businessLicense", workstream: "legal", start: -3, end: -2.5 },
  { key: "foodServiceLicense", workstream: "legal", start: -2, end: -1 },
  { key: "fireMarshal", workstream: "legal", start: -1, end: -0.6 },
  { key: "certificateOfOccupancy", workstream: "legal", start: -0.5, end: -0.5, milestone: true },
  { key: "ohOsV1", workstream: "technology", start: -9, end: 0 },
  { key: "kdsPodOrchestration", workstream: "technology", start: -6, end: -1 },
  // 2026-09-26 (finding C2): the member program as designed needs app work before it can be promised.
  { key: "memberPerks", workstream: "technology", start: -2, end: 4 },
  { key: "coreHires", workstream: "hiring", start: -3, end: 0 },
  { key: "training", workstream: "hiring", start: -1.5, end: 0 },
  { key: "flagshipOpen", workstream: "realEstate", start: 0, end: 0, milestone: true, location: "lehi" },
  { key: "round2", workstream: "capital", start: 11, end: 13 },
  { key: "directorOps", workstream: "hiring", start: 9, end: 11 },
  { key: "commissary", workstream: "buildout", start: 8, end: 14 },
  ...OPENING_SCHEDULE.slice(1).flatMap((o): RoadmapItem[] => [
    { key: `${o.key}-lease`, workstream: "realEstate", start: o.openMonth - 9, end: o.openMonth - 8, location: o.key },
    { key: `${o.key}-buildout`, workstream: "buildout", start: o.openMonth - 5, end: o.openMonth - 0.5, location: o.key },
    { key: `${o.key}-open`, workstream: "realEstate", start: o.openMonth, end: o.openMonth, milestone: true, location: o.key },
  ]),
  { key: "ohOsV2", workstream: "technology", start: 6, end: 18 },
  // Franchise path (owner decision 2026-09-26, finding F1): counsel at month 12, the FDD drafted months 12 to 18,
  // effective around month 24 with the registration states, first area developers in year 3, first units open in year 4.
  { key: "franchiseCounsel", workstream: "legal", start: 12, end: 14 },
  { key: "fdd", workstream: "legal", start: 12, end: 18 },
  { key: "fddEffective", workstream: "legal", start: 24, end: 24, milestone: true },
  { key: "franchiseTeam", workstream: "hiring", start: 24, end: 30 },
  { key: "franchiseLicensing", workstream: "technology", start: 24, end: 34 },
  { key: "firstAreaDevelopers", workstream: "capital", start: 30, end: 30, milestone: true },
  { key: "firstFranchise", workstream: "realEstate", start: 42, end: 42, milestone: true },
];

export const ROADMAP_START = -12;
export const ROADMAP_END = Math.max(60, ...openings) + 0;
