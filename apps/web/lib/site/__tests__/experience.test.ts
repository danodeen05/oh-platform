/**
 * Task D2: the experience page's steps land the journey dots where the copy
 * says they are, on the real comb layout.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLayout, JOURNEY_POD, LOCATION_LAYOUTS, statusStageAt } from "@oh/floor-plan";
import { easeInOut, EXPERIENCE_LAYOUT, EXPERIENCE_STEPS, tweenMs } from "../experience";
import { kioskProgress, podDoorProgress, stepProgress } from "../experience-progress";

const layout = buildLayout(LOCATION_LAYOUTS[EXPERIENCE_LAYOUT]);
const P = stepProgress(layout);
const near = (a: readonly number[] | null, b: readonly number[], tol = 0.01) => !!a && Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!) < tol;

describe("experience steps on the comb-75 layout", () => {
  it("use City Creek's layout, which exists in the floor-plan package", () => {
    expect(EXPERIENCE_LAYOUT).toBe("comb-75");
    expect(LOCATION_LAYOUTS[EXPERIENCE_LAYOUT]).toEqual({ pods: 75, mirror: false });
  });

  it("are the plan's eight steps, in order, with rising progress", () => {
    expect(EXPERIENCE_STEPS).toEqual(["arrive", "order", "walk", "settle", "status", "panel", "taste", "leave"]);
    const values = EXPERIENCE_STEPS.map((s) => P[s]);
    for (let i = 1; i < values.length; i += 1) expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(1);
  });

  it("arrive: the guest stands at the entry door", () => {
    expect(near(layout.journeyMarkers(P.arrive).guest, layout.guestPath[0] as readonly number[])).toBe(true);
  });

  it("order: the guest stands at the middle kiosk", () => {
    const kiosk = layout.guestPath[1] as readonly number[];
    expect(near(layout.journeyMarkers(P.order).guest, kiosk)).toBe(true);
    expect(P.order).toBeCloseTo(kioskProgress(layout), 10);
  });

  it("walk: the guest is in the aisle at the journey pod's door", () => {
    const door = layout.guestPath[layout.guestPath.length - 2] as readonly number[];
    expect(near(layout.journeyMarkers(P.walk).guest, door)).toBe(true);
    expect(P.walk).toBeCloseTo(podDoorProgress(layout), 10);
    expect(layout.journeyTarget.number).toBe(JOURNEY_POD);
    expect(JOURNEY_POD).toBe(32);
  });

  it("settle: the guest is seated, before the bowl is drawn (the map shows it from status)", () => {
    const m = layout.journeyMarkers(P.settle);
    const seat = layout.guestPath[layout.guestPath.length - 1] as readonly number[];
    expect(near(m.guest, seat)).toBe(true);
    expect(P.settle).toBeLessThan(P.status);
    const src = readFileSync(path.resolve(__dirname, "../../../components/site/experience/JourneyMap.tsx"), "utf8");
    expect(src).toContain("bowlFrom={progress.status}");
  });

  it("status: seated, the bowl in the kitchen, and the phone says PREPPING", () => {
    const m = layout.journeyMarkers(P.status);
    const seat = layout.guestPath[layout.guestPath.length - 1] as readonly number[];
    expect(near(m.guest, seat)).toBe(true);
    expect(near(m.bowl, layout.bowlPath[0] as readonly number[])).toBe(true);
    expect(statusStageAt(P.status)).toBe("PREPPING");
  });

  it("panel: the bowl has come down the staff corridor to the hatch", () => {
    const m = layout.journeyMarkers(P.panel);
    const hatch = layout.bowlPath[layout.bowlPath.length - 1] as readonly number[];
    expect(near(m.bowl, hatch)).toBe(true);
    // The bowl moved between status and panel (the page's e2e check).
    const before = layout.journeyMarkers(P.status).bowl!;
    expect(Math.hypot(before[0] - m.bowl![0], before[1] - m.bowl![1])).toBeGreaterThan(5);
  });

  it("taste: the bowl is at the hatch and the guest is still seated", () => {
    const m = layout.journeyMarkers(P.taste);
    const hatch = layout.bowlPath[layout.bowlPath.length - 1] as readonly number[];
    const seat = layout.guestPath[layout.guestPath.length - 1] as readonly number[];
    expect(near(m.bowl, hatch)).toBe(true);
    expect(near(m.guest, seat)).toBe(true);
  });

  it("leave: the guest is at the exit and the bowl has been cleared", () => {
    const m = layout.journeyMarkers(P.leave);
    const exit = layout.guestExitPath[layout.guestExitPath.length - 1] as readonly number[];
    expect(near(m.guest, exit)).toBe(true);
    expect(m.bowl).toBeNull();
  });

  it("the guest dot moves between order and settle (the page's e2e check)", () => {
    const a = layout.journeyMarkers(P.order).guest!;
    const b = layout.journeyMarkers(P.settle).guest!;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(5);
  });

  it("works on the mirrored University Place layout too", () => {
    const up = buildLayout(LOCATION_LAYOUTS["comb-70-mirrored"]);
    const q = stepProgress(up);
    expect(near(up.journeyMarkers(q.order).guest, up.guestPath[1] as readonly number[])).toBe(true);
  });
});

describe("first-load budget", () => {
  // CombMap plus @oh/floor-plan (and the plan model behind it) are about 30 KB of gzipped JS:
  // the map island must load them lazily, and its client helpers must not pull them in.
  const read = (rel: string) => readFileSync(path.resolve(__dirname, "../../..", rel), "utf8");
  const staticSpecs = (src: string) =>
    [...src.matchAll(/(?:^|\n)\s*import\s+(?!type\s)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g)].map((m) => m[1]);

  it("JourneyMap imports CombMap only lazily (import()) or as a type", () => {
    const src = read("components/site/experience/JourneyMap.tsx");
    expect(staticSpecs(src).filter((s) => s.includes("floor-plan"))).toEqual([]);
    expect(src).toMatch(/import\(\s*["']@\/components\/site\/floor-plan\/CombMap["']\s*\)/);
  });

  it("lib/site/experience.ts (client-side) has no static imports at all", () => {
    expect(staticSpecs(read("lib/site/experience.ts"))).toEqual([]);
  });
});

describe("tween timing", () => {
  it("is longer for longer trips, and bounded", () => {
    expect(tweenMs(0, 0.1)).toBeLessThan(tweenMs(0, 0.8));
    expect(tweenMs(0, 1)).toBeLessThanOrEqual(1800);
    expect(tweenMs(0.5, 0.5)).toBeGreaterThanOrEqual(650);
  });
  it("eases from 0 to 1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOut(-1)).toBe(0);
  });
});
