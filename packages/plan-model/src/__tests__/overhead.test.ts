import { describe, expect, it } from "vitest";
import { CORPORATE_OVERHEAD, LEAN_OVERHEAD, computeOverhead, roleMonthsInYear } from "../index";

describe("roleMonthsInYear", () => {
  it("books pre-opening months into year 1 and ends roles on their end month", () => {
    expect(roleMonthsInYear({ startMonth: -9 }, 1)).toBe(21);
    expect(roleMonthsInYear({ startMonth: -9 }, 2)).toBe(12);
    expect(roleMonthsInYear({ startMonth: 10 }, 1)).toBe(2);
    expect(roleMonthsInYear({ startMonth: 24 }, 1)).toBe(0);
    expect(roleMonthsInYear({ startMonth: 24 }, 2)).toBe(0);
    expect(roleMonthsInYear({ startMonth: -3, endMonth: 24 }, 3)).toBe(0);
    expect(roleMonthsInYear({ startMonth: -3, endMonth: 24 }, 2)).toBe(12);
    expect(roleMonthsInYear({ startMonth: 18, endMonth: 20 }, 2)).toBe(2);
  });
  it("one-time lines land in their year only", () => {
    expect(roleMonthsInYear({ startMonth: 12, onlyYear: 2 }, 2)).toBe(12);
    expect(roleMonthsInYear({ startMonth: 12, onlyYear: 2 }, 3)).toBe(0);
  });
});

describe("computeOverhead", () => {
  it("full schedule: about $1.0M / $1.5M / $2.2M / $2.7M / $2.9M with the founder at $180K", () => {
    const totals = [1, 2, 3, 4, 5].map((y, i) => Math.round(computeOverhead(y, [1, 4, 5, 5, 5][i] as number, [0, 0, 0, 2, 7][i] as number).total));
    expect(totals).toEqual([1_006_500, 1_499_500, 2_154_850, 2_669_750, 2_876_200]);
    const y1 = computeOverhead(1, 1, 0);
    expect(y1.lines.find((l) => l.key === "founder")?.amount).toBeCloseTo(180_000 * (21 / 12), 6);
    expect(y1.burden).toBeCloseTo(y1.salaries * 0.18, 6);
    expect(y1.total).toBeCloseTo(y1.salaries + y1.burden + y1.fees + y1.other, 6);
    expect(y1.headcount).toBeCloseTo(5, 9);
    expect(y1.lines.every((l) => l.amount > 0)).toBe(true);
  });
  it("scales franchise support with franchise units and books the FDD once", () => {
    const y4 = computeOverhead(4, 5, 2);
    const y5 = computeOverhead(5, 5, 7);
    const y6 = computeOverhead(6, 5, 15);
    expect(y4.lines.find((l) => l.key === "franchiseSupport")?.headcount).toBe(1);
    expect(y5.lines.find((l) => l.key === "franchiseSupport")?.headcount).toBe(1);
    expect(y6.lines.find((l) => l.key === "franchiseSupport")?.headcount).toBe(2);
    expect(computeOverhead(2, 4, 0).lines.find((l) => l.key === "fdd")?.amount).toBe(80_000);
    expect(computeOverhead(3, 5, 0).lines.find((l) => l.key === "fdd")).toBeUndefined();
    expect(computeOverhead(3, 5, 0).lines.find((l) => l.key === "franchiseSupport")).toBeUndefined();
  });
  it("lean schedule stages hires behind deals", () => {
    const lean = [1, 2, 3, 4, 5].map((y, i) => Math.round(computeOverhead(y, [1, 4, 5, 5, 5][i] as number, [0, 0, 0, 2, 7][i] as number, LEAN_OVERHEAD).total));
    expect(lean).toEqual([818_167, 1_084_100, 1_360_000, 1_823_600, 2_392_400]);
    for (let y = 1; y <= 5; y++) expect(lean[y - 1] as number).toBeLessThan(computeOverhead(y, 5, 7).total);
    expect(LEAN_OVERHEAD.key).toBe("lean");
    expect(CORPORATE_OVERHEAD.key).toBe("full");
  });
  it("classifies fees and other lines without burden", () => {
    const y = computeOverhead(1, 1, 0);
    expect(y.lines.filter((l) => l.kind === "fees").reduce((s, l) => s + l.amount, 0)).toBeCloseTo(y.fees, 6);
    expect(y.lines.filter((l) => l.kind === "other").reduce((s, l) => s + l.amount, 0)).toBeCloseTo(y.other, 6);
    expect(y.lines.filter((l) => l.kind !== "salary").every((l) => l.headcount === 0)).toBe(true);
  });
  it("rejects year 0", () => {
    expect(() => computeOverhead(0, 1, 0)).toThrow(RangeError);
  });
});
