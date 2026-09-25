import { describe, expect, it } from "vitest";
import { FX_RATES, convert, fmtCompact, fmtCurrency, fmtInteger, fmtMultiple, fmtPercent, fmtYears } from "../index";

describe("format", () => {
  it("formats whole-dollar currency by default", () => {
    expect(fmtCurrency(4_201_425)).toBe("$4,201,425");
    expect(fmtCurrency(26.3, { fractionDigits: 2 })).toBe("$26.30");
  });
  it("converts with the fixed table", () => {
    expect(convert(100, "TWD", FX_RATES)).toBeCloseTo(3220, 6);
    expect(convert(100, "USD", FX_RATES)).toBe(100);
    expect(fmtCurrency(1000, { currency: "JPY", fx: FX_RATES, locale: "ja-JP" })).toMatch(/148,500/);
    expect(fmtCurrency(1000, { currency: "GBP" })).toBe("£1,000");
  });
  it("compacts headlines", () => {
    expect(fmtCompact(4_201_425)).toBe("$4.2M");
    expect(fmtCompact(864_000, { fractionDigits: 0 })).toBe("$864K");
    expect(fmtCompact(1_000_000, { currency: "EUR", fx: FX_RATES })).toBe("€910K");
  });
  it("formats percents, multiples, integers and years", () => {
    expect(fmtPercent(0.308)).toBe("30.8%");
    expect(fmtPercent(0.25, "en-US", 0)).toBe("25%");
    expect(fmtMultiple(6.476)).toBe("6.5x");
    expect(fmtMultiple(null)).toBe("n/a");
    expect(fmtMultiple(Number.POSITIVE_INFINITY)).toBe("n/a");
    expect(fmtInteger(1500.4)).toBe("1,500");
    expect(fmtYears(1.5627)).toBe("1.6");
    expect(fmtYears(null)).toBe("n/a");
  });
});
