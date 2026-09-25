import { describe, expect, it } from "vitest";
import { SECTIONS, SECTION_KEYS, getSection, isSectionVisible, sectionFromPath, sectionHref, visibleSections } from "../sections";
import { swapLocale } from "../locales";

describe("section registry", () => {
  it("registers every key exactly once in reading order", () => {
    expect(SECTIONS.map((s) => s.key)).toEqual([...SECTION_KEYS]);
    expect(SECTIONS.map((s) => s.order)).toEqual(SECTIONS.map((_, i) => i + 1));
    expect(new Set(SECTIONS.map((s) => s.slug)).size).toBe(SECTIONS.length);
  });
  it("builds hrefs and maps paths back", () => {
    expect(sectionHref("en", getSection("summary"))).toBe("/en/plan");
    expect(sectionHref("zh-TW", getSection("floor-plan"))).toBe("/zh-TW/plan/floor-plan");
    expect(sectionFromPath("/en/plan")).toBe("summary");
    expect(sectionFromPath("/zh-TW/plan/model/")).toBe("model");
    expect(sectionFromPath("/en/plan/print")).toBeNull();
    expect(sectionFromPath("/en/plan/gate")).toBeNull();
    expect(sectionFromPath("/en/menu")).toBeNull();
  });
  it("lets an explicit allowlist win, else audience defaults", () => {
    expect(isSectionVisible({ sec: ["model"], aud: "LANDLORD" }, "model")).toBe(true);
    expect(isSectionVisible({ sec: ["model"], aud: "INVESTOR" }, "team")).toBe(false);
    expect(isSectionVisible({ sec: [], aud: "LANDLORD" }, "funding")).toBe(false);
    expect(isSectionVisible({ sec: [], aud: "LANDLORD" }, "floor-plan")).toBe(true);
    expect(visibleSections({ sec: [], aud: "INVESTOR" })).toHaveLength(SECTIONS.length);
    expect(visibleSections({ sec: [], aud: "LANDLORD" }).map((s) => s.key)).not.toContain("financials");
  });
  it("swaps locales in a path", () => {
    expect(swapLocale("/en/plan/model", "zh-TW")).toBe("/zh-TW/plan/model");
    expect(swapLocale("/zh-TW/plan", "en")).toBe("/en/plan");
    expect(swapLocale("/plan", "en")).toBe("/en/plan");
  });
});
