import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import zh from "../../../messages/zh-TW.json";
import { SECTION_KEYS } from "../sections";
import { SECTION_NAMESPACES, collectText, countCjk, countWords, readingMinutes, sectionReadingMinutes } from "../readingTime";

describe("readingTime", () => {
  it("maps every section to an existing plan namespace", () => {
    const plan = (en as { plan: Record<string, unknown> }).plan;
    for (const key of SECTION_KEYS) {
      for (const ns of SECTION_NAMESPACES[key]) expect(plan[ns], `${key} -> ${ns}`).toBeDefined();
    }
  });
  it("counts words and CJK characters, ignoring placeholders and tags", () => {
    expect(countWords("One {value} two <b>three</b>")).toBe(3);
    expect(countCjk("座艙 38 和 hatch")).toBe(3);
    expect(collectText({ a: "x", b: { c: ["y", "z"] } })).toBe("x y z");
  });
  it("never reports less than a minute and scales with length", () => {
    expect(readingMinutes("short", "en")).toBe(1);
    expect(readingMinutes(Array(1000).fill("word").join(" "), "en")).toBe(5);
    expect(readingMinutes("字".repeat(700), "zh-TW")).toBe(2);
  });
  it("estimates every section in both shipped locales", () => {
    for (const key of SECTION_KEYS) {
      expect(sectionReadingMinutes((en as { plan: Record<string, unknown> }).plan, key, "en")).toBeGreaterThanOrEqual(1);
      expect(sectionReadingMinutes((zh as { plan: Record<string, unknown> }).plan, key, "zh-TW")).toBeGreaterThanOrEqual(1);
    }
  });
});
