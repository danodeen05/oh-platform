import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BENCHMARKS, computeScorecard, registryRows, scorecardContext, type Scorecard } from "@oh/plan-model";
import { SECTIONS, SECTION_KEYS } from "../sections";
import { EDGES, LANDLORD_HIDDEN_GROUPS, edgeContext, edgePointStatus, formatBand, registryRowsFor, resolveEdge } from "../integrity";
import { OPEN_ITEMS } from "../../../components/plan/modules/integrity/openItems";
import { floorPlanAreaCheck } from "../../../components/plan/modules/integrity/areaCheck";

const messages = (locale: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../messages/${locale}.json`), "utf8")) as { plan: Record<string, any> };
const ctx = edgeContext({ minutesToBowl: 7, franchiseUnitsY7: 27 });

describe("edge callouts", () => {
  it("declares two to four points for every registered section", () => {
    expect(Object.keys(EDGES).sort()).toEqual([...SECTION_KEYS].sort());
    for (const s of SECTIONS) {
      const n = EDGES[s.key].points.length;
      expect(n, s.key).toBeGreaterThanOrEqual(2);
      expect(n, s.key).toBeLessThanOrEqual(4);
    }
  });

  it("has copy for every point in English and Traditional Chinese, with no em dashes", () => {
    for (const locale of ["en", "zh-TW"]) {
      const edge = messages(locale).plan.edge;
      expect(typeof edge.title).toBe("string");
      expect(typeof edge.labels.oh).toBe("string");
      expect(typeof edge.labels.benchmark).toBe("string");
      for (const s of SECTIONS) {
        const points = edge[s.key]?.points ?? {};
        const declared = EDGES[s.key].points.length;
        expect(Object.keys(points), `${locale} ${s.key}`).toHaveLength(declared);
        for (let i = 0; i < declared; i++) {
          const text = points[String(i)]?.text;
          expect(typeof text, `${locale} ${s.key} ${i}`).toBe("string");
          expect(text).not.toMatch(/—/);
        }
      }
    }
  });

  it("references only benchmark rows the scorecard has", () => {
    const keys = new Set(BENCHMARKS.map((b) => b.key));
    for (const s of SECTIONS) for (const p of EDGES[s.key].points) if (p.benchmark) expect(keys.has(p.benchmark), `${s.key} ${p.benchmark}`).toBe(true);
  });

  it("drops a point whose scorecard row is watch, fail or pending", () => {
    const base = computeScorecard(scorecardContext());
    for (const status of ["watch", "fail", "pending"] as const) {
      const card: Scorecard = { ...base, rows: base.rows.map((r) => (r.key === "laborPct" ? { ...r, status } : r)) };
      expect(edgePointStatus({ benchmark: "laborPct" }, card)).toBe(status);
      const shown = resolveEdge("summary", { ...ctx, scorecard: card });
      expect(shown.map((p) => p.index)).not.toContain(0);
    }
    expect(edgePointStatus({}, base)).toBe("pass");
    expect(edgePointStatus({ benchmark: "nope" }, base)).toBe("pending");
  });

  it("never claims an edge the live scorecard does not pass", () => {
    for (const s of SECTIONS) {
      const spec = EDGES[s.key].points;
      for (const p of resolveEdge(s.key, ctx)) {
        const b = spec[p.index]?.benchmark;
        if (b) expect(ctx.scorecard.rows.find((r) => r.key === b)?.status, `${s.key} ${b}`).toBe("pass");
      }
      // Every section still has at least two points at base.
      expect(resolveEdge(s.key, ctx).length, s.key).toBeGreaterThanOrEqual(2);
    }
    // The rows on watch or fail at base are never the benchmark of any point.
    const notPass = new Set(ctx.scorecard.rows.filter((r) => r.status !== "pass").map((r) => r.key));
    for (const s of SECTIONS) for (const p of EDGES[s.key].points) if (p.benchmark) expect(notPass.has(p.benchmark), `${s.key} ${p.benchmark}`).toBe(false);
  });

  it("formats bands the way a reader says them", () => {
    expect(formatBand({ min: 0.25, max: 0.32 }, "pct", "en-US")).toBe("25 to 32%");
    expect(formatBand({ min: 450, max: 600 }, "usd0", "en-US")).toBe("$450 to $600");
  });
});

describe("integrity data", () => {
  it("hides the capital stack from landlords only", () => {
    const all = registryRows();
    const landlord = registryRowsFor("LANDLORD", all);
    expect(landlord.some((r) => LANDLORD_HIDDEN_GROUPS.includes(r.group))).toBe(false);
    expect(landlord.length).toBeLessThan(all.length);
    expect(registryRowsFor("INVESTOR", all)).toHaveLength(all.length);
  });

  it("points every open item at live register rows", () => {
    const keys = new Set(registryRows().map((r) => r.key));
    for (const item of OPEN_ITEMS) for (const k of item.validates) expect(keys.has(k), `${item.key} -> ${k}`).toBe(true);
  });

  it("keeps the drawn floor plan equal to the modeled square footage", () => {
    expect(floorPlanAreaCheck().pass).toBe(true);
  });

  it("has copy for every open item, group and section title in both locales", () => {
    for (const locale of ["en", "zh-TW"]) {
      const plan = messages(locale).plan;
      expect(typeof plan.sections.integrity.title).toBe("string");
      for (const item of OPEN_ITEMS) expect(typeof plan.integrity.openItems.items[item.key]?.title, `${locale} ${item.key}`).toBe("string");
      for (const g of new Set(registryRows().map((r) => r.group))) expect(typeof plan.integrity.register.groups[g], `${locale} ${g}`).toBe("string");
    }
  });
});
