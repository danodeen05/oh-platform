/**
 * Section registry for the interactive business plan.
 *
 * Single source of truth for section keys. The nav, progress rail, print
 * route, analytics beacon, and the admin allowlist UI all derive from this.
 * Phase 3 adds titles, icons, and audience defaults; Phase 1 only needs keys.
 *
 * Keys are stable identifiers stored in PlanSectionView.sectionKey and in
 * PlanAccessCode.allowedSections, so never rename one casually.
 */

export const SECTION_KEYS = [
  "summary",
  "model",
  "experience",
  "market",
  "floor-plan",
  "operations",
  "expansion",
  "unit-economics",
  "financials",
  "sensitivity",
  "team",
  "funding",
  "roadmap",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}
