import { describe, expect, it } from "vitest";
import { homeScenario, resolveScenario } from "../scenario";

describe("resolveScenario", () => {
  it("falls back to base when there is no session", () => {
    expect(resolveScenario(null)).toBe("base");
    expect(resolveScenario(undefined, undefined, undefined)).toBe("base");
  });
  it("uses the code's default scenario", () => {
    expect(resolveScenario({ scn: "CONSERVATIVE" })).toBe("conservative");
    expect(resolveScenario({ scn: "AGGRESSIVE" })).toBe("aggressive");
  });
  it("lets the reader's cookie override the code default", () => {
    expect(resolveScenario({ scn: "CONSERVATIVE" }, "aggressive")).toBe("aggressive");
  });
  it("lets an explicit share link override the cookie", () => {
    expect(resolveScenario({ scn: "BASE" }, "aggressive", "conservative")).toBe("conservative");
  });
  it("ignores garbage in the cookie and the override", () => {
    expect(resolveScenario({ scn: "AGGRESSIVE" }, "nope", "<script>")).toBe("aggressive");
  });
  it("homeScenario never reads the cookie", () => {
    expect(homeScenario({ scn: "CONSERVATIVE" })).toBe("conservative");
  });
});
