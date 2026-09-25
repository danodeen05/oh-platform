/**
 * Section registry for the interactive business plan.
 *
 * Single source of truth. The nav, progress rail, print route, analytics
 * beacon, and the admin allowlist UI all derive from this. Metadata only:
 * a `component` field here would pull every heavy client module into every
 * page, so each page imports its own module and the print route imports all.
 *
 * Keys are stable identifiers stored in PlanSectionView.sectionKey and in
 * PlanAccessCode.allowedSections, so never rename one casually.
 */

import type { PlanAudience, PlanClaims } from "./session";

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

export type SectionIcon =
  | "summary"
  | "sliders"
  | "bowl"
  | "map"
  | "grid"
  | "cpu"
  | "route"
  | "scale"
  | "ledger"
  | "tornado"
  | "people"
  | "coins"
  | "flag";

export interface PlanSection {
  key: SectionKey;
  /** Reading order; also the print order. */
  order: number;
  /** next-intl key under `plan.sections`. */
  titleKey: SectionKey;
  icon: SectionIcon;
  /** Audiences that see this section when a code has no explicit allowlist. */
  audiences: readonly PlanAudience[];
  /** Path under /[locale]/plan; "" is the plan home. */
  slug: string;
}

const ALL: readonly PlanAudience[] = ["INVESTOR", "LENDER", "LANDLORD", "PARTNER", "ADVISOR", "INTERNAL"];
/** Landlords get the concept, the market and the footprint, not the capital stack. */
const NO_LANDLORD: readonly PlanAudience[] = ["INVESTOR", "LENDER", "PARTNER", "ADVISOR", "INTERNAL"];

export const SECTIONS: readonly PlanSection[] = [
  { key: "summary", order: 1, titleKey: "summary", icon: "summary", audiences: ALL, slug: "" },
  { key: "model", order: 2, titleKey: "model", icon: "sliders", audiences: NO_LANDLORD, slug: "model" },
  { key: "experience", order: 3, titleKey: "experience", icon: "bowl", audiences: ALL, slug: "experience" },
  { key: "market", order: 4, titleKey: "market", icon: "map", audiences: ALL, slug: "market" },
  { key: "floor-plan", order: 5, titleKey: "floor-plan", icon: "grid", audiences: ALL, slug: "floor-plan" },
  { key: "operations", order: 6, titleKey: "operations", icon: "cpu", audiences: ALL, slug: "operations" },
  { key: "expansion", order: 7, titleKey: "expansion", icon: "route", audiences: ALL, slug: "expansion" },
  { key: "unit-economics", order: 8, titleKey: "unit-economics", icon: "scale", audiences: ALL, slug: "unit-economics" },
  { key: "financials", order: 9, titleKey: "financials", icon: "ledger", audiences: NO_LANDLORD, slug: "financials" },
  { key: "sensitivity", order: 10, titleKey: "sensitivity", icon: "tornado", audiences: NO_LANDLORD, slug: "sensitivity" },
  { key: "team", order: 11, titleKey: "team", icon: "people", audiences: ALL, slug: "team" },
  { key: "funding", order: 12, titleKey: "funding", icon: "coins", audiences: NO_LANDLORD, slug: "funding" },
  { key: "roadmap", order: 13, titleKey: "roadmap", icon: "flag", audiences: ALL, slug: "roadmap" },
];

export function getSection(key: SectionKey): PlanSection {
  const found = SECTIONS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown plan section: ${key}`);
  return found;
}

export function sectionHref(locale: string, section: Pick<PlanSection, "slug">): string {
  return section.slug ? `/${locale}/plan/${section.slug}` : `/${locale}/plan`;
}

/** Map a pathname back to its section key, or null for the gate, print and unknown paths. */
export function sectionFromPath(pathname: string): SectionKey | null {
  const m = pathname.match(/^\/(?:en|zh-TW|zh-CN|es)\/plan(?:\/([^/?#]+))?\/?$/);
  if (!m) return null;
  const slug = m[1] ?? "";
  const found = SECTIONS.find((s) => s.slug === slug);
  return found ? found.key : null;
}

/**
 * Visibility rule, enforced server-side by requireSection and used by the
 * nav and print route: an explicit allowlist on the code wins; otherwise the
 * section's audience defaults apply.
 */
export function isSectionVisible(claims: Pick<PlanClaims, "sec" | "aud">, key: SectionKey): boolean {
  if (claims.sec.length > 0) return claims.sec.includes(key);
  return getSection(key).audiences.includes(claims.aud);
}

export function visibleSections(claims: Pick<PlanClaims, "sec" | "aud">): readonly PlanSection[] {
  return SECTIONS.filter((s) => isSectionVisible(claims, s.key));
}
