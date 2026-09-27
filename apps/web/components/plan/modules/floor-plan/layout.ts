/**
 * The business plan's floor-plan module now sources its geometry from
 * `@oh/floor-plan` (spec: the same comb layout also serves the customer
 * site's City Creek and University Place floor plans, at 75 and 70 pods,
 * unmirrored and mirrored). This file is a compatibility shim: it re-exports
 * every pure name from the package unchanged, then resolves the plan's
 * default layout (`BASE_ASSUMPTIONS.pods`, unmirrored) and re-exports its
 * fields under their original names so every existing import here keeps
 * working, byte for byte.
 */
export * from "@oh/floor-plan";
import { buildLayout, type Rect } from "@oh/floor-plan";

const DEFAULT_LAYOUT = buildLayout();

export const ZONES = DEFAULT_LAYOUT.zones;
export const FINGERS = DEFAULT_LAYOUT.fingers;
export const STAFF_CORRIDORS = DEFAULT_LAYOUT.staffCorridors;
export const GUEST_AISLES = DEFAULT_LAYOUT.guestAisles;
export const CROSS_AISLE = DEFAULT_LAYOUT.crossAisle;
export const PASS = DEFAULT_LAYOUT.pass;
export const KIOSKS = DEFAULT_LAYOUT.kiosks;
export const WALLS = DEFAULT_LAYOUT.walls;
export const DOORS = DEFAULT_LAYOUT.doors;
export const OPENINGS = DEFAULT_LAYOUT.openings;
export const ROWS = DEFAULT_LAYOUT.rows;
export const PODS = DEFAULT_LAYOUT.pods;
export const DUO_PAIRS = DEFAULT_LAYOUT.duoPairs;
export const AREAS = DEFAULT_LAYOUT.areas;
export const TOTAL_SQFT = DEFAULT_LAYOUT.totalSqft;
export const TERRITORY_TOTALS = DEFAULT_LAYOUT.territoryTotals;
export const DINING_SQFT_PER_POD = DEFAULT_LAYOUT.diningSqftPerPod;
export const SHELL_FACTS = DEFAULT_LAYOUT.shellFacts;
export const JOURNEY_TARGET = DEFAULT_LAYOUT.journeyTarget;
export const GUEST_PATH = DEFAULT_LAYOUT.guestPath;
export const GUEST_EXIT_PATH = DEFAULT_LAYOUT.guestExitPath;
export const BOWL_PATH = DEFAULT_LAYOUT.bowlPath;
export const DIRTY_PATH = DEFAULT_LAYOUT.dirtyPath;
export const territory = DEFAULT_LAYOUT.territory;
export const journeyMarkers = DEFAULT_LAYOUT.journeyMarkers;

/** Guest territory: aisles, cross-aisle, the right column, and the pod rows (the guest sits in them). */
export const GUEST_RECTS: readonly Rect[] = [...GUEST_AISLES, CROSS_AISLE, ...ZONES.filter((z) => z.territory === "guest"), ...ROWS];
/** Staff territory: kitchen strip and the corridors. */
export const STAFF_RECTS: readonly Rect[] = [...ZONES.filter((z) => z.territory === "staff"), ...STAFF_CORRIDORS];
