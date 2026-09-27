import { getLocale, getTranslations } from "next-intl/server";
import { FRANCHISE_MARKETS, scorecardContext, type ScenarioKey } from "@oh/plan-model";
import { EdgeCallout, type EdgePoint } from "@/components/plan/primitives/EdgeCallout";
import { edgeContext, formatBand, formatEdgeValue, resolveEdge } from "@/lib/plan/integrity";
import type { SectionKey } from "@/lib/plan/sections";
import { JOURNEY_STEPS } from "../floor-plan/layout";
import { floorPlanAreaCheck } from "./areaCheck";

/** Minutes from the kiosk to the bowl, from the floor plan's own journey. */
export const MINUTES_TO_BOWL = Math.round(((JOURNEY_STEPS.find((s) => s.key === "delivered")?.realSeconds ?? 0) - (JOURNEY_STEPS.find((s) => s.key === "paid")?.realSeconds ?? 0)) / 60);

/** Checks the integrity page runs beside the engine invariants; the counts in the callouts include them. */
const PAGE_CHECKS = [floorPlanAreaCheck] as const;

/** Franchise units on the phased schedule through year 7. */
export const FRANCHISE_UNITS_Y7 = FRANCHISE_MARKETS.reduce((s, m) => s + Object.entries(m.unitsByYear).filter(([y]) => Number(y) <= 7).reduce((a, [, n]) => a + n, 0), 0);

/**
 * "Where Oh! is different" for one section: the points declared in
 * lib/plan/integrity.ts, formatted here, with the copy from plan.edge. The
 * figures follow the reader's scenario, and the guard scores that same
 * scenario: a point whose row is not a pass in it never reaches the page.
 */
export async function SectionEdge({ sectionKey, scenario = "base", tone = "dark" }: { sectionKey: SectionKey; scenario?: ScenarioKey; tone?: "dark" | "light" }) {
  const [t, locale] = await Promise.all([getTranslations("plan.edge"), getLocale()]);
  const ctx = edgeContext({ minutesToBowl: MINUTES_TO_BOWL, franchiseUnitsY7: FRANCHISE_UNITS_Y7, extraChecks: PAGE_CHECKS.length }, scorecardContext({ scenarioKey: scenario }));
  const points: EdgePoint[] = resolveEdge(sectionKey, ctx).map((p) => {
    const values: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(p.values)) values[k] = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v);
    if (p.figure !== null) values.figure = formatEdgeValue(p.figure, p.unit, locale);
    if (p.band) values.band = formatBand(p.band, p.unit, locale);
    const point: EdgePoint = { text: t(`${sectionKey}.points.${p.index}.text`, values) };
    // The Oh!/benchmark pair only where there is a benchmark; elsewhere the figure is already in the sentence.
    if (p.figure !== null && p.band) {
      point.figure = formatEdgeValue(p.figure, p.unit, locale);
      point.benchmark = formatBand(p.band, p.unit, locale);
    }
    return point;
  });
  if (points.length === 0) return null;
  return <EdgeCallout tone={tone} title={t("title")} labels={{ oh: t("labels.oh"), benchmark: t("labels.benchmark") }} points={points} data-edge={sectionKey} />;
}
