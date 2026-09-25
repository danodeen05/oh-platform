import { describe, expect, it } from "vitest";
import { SHARE_VERSION, decodeScenario, encodeScenario, type SharedScenario } from "../index";

function raw(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

describe("share links", () => {
  it("round-trips a scenario", () => {
    const s: SharedScenario = { base: "conservative", overrides: { utilizationRate: 0.25, avgBowlPrice: 21 } };
    const text = encodeScenario(s);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeScenario(text)).toEqual(s);
  });
  it("round-trips payloads of every padding length", () => {
    for (const key of ["a", "ab", "abc", "abcd", "abcde"]) {
      const s: SharedScenario = { base: "base", overrides: { pods: 20 + key.length } };
      expect(decodeScenario(encodeScenario(s))).toEqual(s);
    }
    expect(decodeScenario(encodeScenario({ base: "aggressive", overrides: {} }))).toEqual({ base: "aggressive", overrides: {} });
  });
  it("drops non-numeric override values on encode", () => {
    const dirty = { base: "base", overrides: { pods: 80, avgBowlPrice: "x" } } as unknown as SharedScenario;
    expect(decodeScenario(encodeScenario(dirty))).toEqual({ base: "base", overrides: { pods: 80 } });
  });
  it("rejects anything that is not a valid current-version payload", () => {
    expect(decodeScenario(null)).toBeNull();
    expect(decodeScenario(undefined)).toBeNull();
    expect(decodeScenario("")).toBeNull();
    expect(decodeScenario("!!!")).toBeNull();
    expect(decodeScenario(raw(1))).toBeNull();
    expect(decodeScenario(raw(null))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION + 1, b: "base", o: {} }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: "wild", o: {} }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: 3, o: {} }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: "base", o: null }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: "base", o: [] }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: "base" }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: "base", o: { rampCurve: 1 } }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: "base", o: { pods: "80" } }))).toBeNull();
    expect(decodeScenario(raw({ v: SHARE_VERSION, b: "base", o: { pods: 9999 } }))).toBeNull();
  });
});
