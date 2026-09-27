import {
  LEVER_BOUNDS,
  MODEL_CHANGELOG,
  MODEL_SNAPSHOTS,
  SCENARIO_KEYS,
  computeScorecard,
  headlineDeltas,
  isLeverKey,
  latestSnapshot,
  registryContext,
  registryRows,
  runInvariants,
  scorecardContext,
  type ChangeEntry,
  type Confidence,
  type HeadlineDelta,
  type InvariantResult,
  type ModelSnapshot,
  type RegistryGroup,
  type RegistryUnit,
  type RegistryValue,
  type Scorecard,
  type SourceKind,
} from "@oh/plan-model";
import { TEST_MANIFEST, type TestManifest } from "../../../../../../packages/plan-model/src/generated/test-manifest";
import { MODEL_LEVERS } from "../model/levers";
import type { PlanAudience } from "@/lib/plan/session";
import { registryGroupsFor } from "@/lib/plan/integrity";
import { floorPlanAreaCheck } from "./areaCheck";
import { OPEN_ITEMS, type OpenItem } from "./openItems";
import { REVIEWS } from "./reviews";

/** A register row with everything the client table needs and nothing it cannot serialize (no `read`). */
export interface RegisterRowData {
  key: string;
  anchor: string;
  group: RegistryGroup;
  label: string;
  unit: RegistryUnit;
  value: RegistryValue;
  source: { kind: SourceKind; detail: string; asOf: string; confidence: Confidence };
  lever: boolean;
  /** Slider bounds when the row is a lever the engine bounds. */
  leverBounds: { min: number; max: number } | null;
  /** True when the row is one of the sliders on the Model page. */
  onModel: boolean;
  /** Value differs across the three presets. */
  variesByScenario: boolean;
  /** Change-log dates that touched this key, newest first. */
  changedIn: readonly string[];
  /** Open items that would validate this row. */
  awaiting: readonly string[];
}

export interface IntegrityData {
  rows: readonly RegisterRowData[];
  totalRows: number;
  groups: readonly RegistryGroup[];
  changeDates: readonly string[];
  scorecard: Scorecard;
  invariants: readonly InvariantResult[];
  manifest: TestManifest;
  changelog: readonly ChangeEntry[];
  snapshots: readonly ModelSnapshot[];
  /** Headline movement from the first snapshot (before the re-baseline) to the live engine. */
  deltas: readonly HeadlineDelta[];
  /** One step per later version: what that version alone moved. */
  steps: readonly VersionStep[];
  openItems: readonly OpenItem[];
  reviews: typeof REVIEWS;
}

export interface VersionStep {
  from: ModelSnapshot;
  to: ModelSnapshot;
  deltas: readonly HeadlineDelta[];
}

const MODEL_LEVER_KEYS = new Set(MODEL_LEVERS.map((l) => l.key as string));

/** Everything the integrity section renders, computed once per request for one audience. */
export function integrityData(audience: PlanAudience): IntegrityData {
  const allowed = registryGroupsFor(audience);
  const base = registryRows(registryContext("base"));
  const others = SCENARIO_KEYS.filter((k) => k !== "base").map((k) => new Map(registryRows(registryContext(k)).map((r) => [r.key, r.value])));
  const awaitingByKey = new Map<string, string[]>();
  for (const item of OPEN_ITEMS) {
    if (item.status === "validated") continue;
    for (const k of item.validates) awaitingByKey.set(k, [...(awaitingByKey.get(k) ?? []), item.key]);
  }
  const rows: RegisterRowData[] = base
    .filter((r) => allowed(r.group))
    .map((r) => {
      const field = r.key.startsWith("unit.") ? r.key.slice(5) : "";
      const bounded = field && isLeverKey(field) ? LEVER_BOUNDS[field] : null;
      return {
        key: r.key,
        anchor: r.anchor,
        group: r.group,
        label: r.label,
        unit: r.unit,
        value: r.value,
        source: { ...r.source },
        lever: r.lever,
        leverBounds: r.lever && bounded ? { min: bounded.min, max: bounded.max } : null,
        onModel: r.lever && MODEL_LEVER_KEYS.has(field),
        variesByScenario: others.some((m) => m.has(r.key) && m.get(r.key) !== r.value),
        changedIn: r.changedIn,
        awaiting: awaitingByKey.get(r.key) ?? [],
      };
    });
  const groups = [...new Set(rows.map((r) => r.group))];
  const changeDates = [...new Set(MODEL_CHANGELOG.map((c) => c.date))].sort().reverse();
  const scorecard = computeScorecard(scorecardContext());
  const invariants = [...runInvariants(), floorPlanAreaCheck()];
  const snapshots = MODEL_SNAPSHOTS;
  // Headline cards compare the first snapshot to the live engine, so a later, smaller change (the 2026-09-27
  // pledge) never hides the re-baseline; each version's own movement is listed step by step underneath.
  const first = (snapshots[0] as ModelSnapshot | undefined) ?? latestSnapshot();
  const steps: VersionStep[] = snapshots.slice(1).map((to, i) => ({ from: snapshots[i] as ModelSnapshot, to, deltas: headlineDeltas(snapshots[i] as ModelSnapshot, to) }));
  return {
    rows,
    totalRows: base.length,
    groups,
    changeDates,
    scorecard,
    invariants,
    manifest: TEST_MANIFEST,
    changelog: MODEL_CHANGELOG,
    snapshots,
    deltas: headlineDeltas(first, latestSnapshot()),
    steps,
    openItems: OPEN_ITEMS,
    reviews: REVIEWS,
  };
}

/** Which test suite belongs to which part of the model, for the checks block. */
export type CheckArea = "unit" | "corporate" | "integrity" | "tooling";
const AREA_OF: Readonly<Record<string, CheckArea>> = {
  "location.test.ts": "unit",
  "unit.test.ts": "unit",
  "ramp.test.ts": "unit",
  "menu.test.ts": "unit",
  "labor.test.ts": "unit",
  "capital.test.ts": "unit",
  "levers.test.ts": "unit",
  "overhead.test.ts": "corporate",
  "portfolio.test.ts": "corporate",
  "platform.test.ts": "corporate",
  "company.test.ts": "corporate",
  "partnership.test.ts": "corporate",
  "registry.test.ts": "integrity",
  "benchmarks.test.ts": "integrity",
  "checks.test.ts": "integrity",
  "changelog.test.ts": "integrity",
  "manifest.test.ts": "integrity",
  "rebase-2026-09-26.test.ts": "integrity",
  "spec-anchors.test.ts": "integrity",
  "assumptions.test.ts": "integrity",
  "format.test.ts": "tooling",
  "share.test.ts": "tooling",
  "sensitivity.test.ts": "tooling",
  "timeline.test.ts": "tooling",
};
export const CHECK_AREAS: readonly CheckArea[] = ["unit", "corporate", "integrity", "tooling"];

export function areaOf(file: string): CheckArea {
  return AREA_OF[file] ?? "tooling";
}

export function suitesByArea(manifest: TestManifest): Readonly<Record<CheckArea, { files: number; tests: number; passed: number }>> {
  const out: Record<CheckArea, { files: number; tests: number; passed: number }> = { unit: { files: 0, tests: 0, passed: 0 }, corporate: { files: 0, tests: 0, passed: 0 }, integrity: { files: 0, tests: 0, passed: 0 }, tooling: { files: 0, tests: 0, passed: 0 } };
  for (const f of manifest.files) {
    const a = out[areaOf(f.file)];
    a.files += 1;
    a.tests += f.tests;
    a.passed += f.passed;
  }
  return out;
}
