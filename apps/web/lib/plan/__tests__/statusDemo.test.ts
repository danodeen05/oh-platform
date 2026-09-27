import { describe, expect, it } from "vitest";
import { statusDemoSrc } from "../statusDemo";

describe("statusDemoSrc", () => {
  it("embeds the demo order by default and can follow the parent", () => {
    expect(statusDemoSrc("en")).toBe("/en/order/status?orderQrCode=DEMO-PLAN&embed=1");
    expect(statusDemoSrc("zh-TW", { sync: true, stage: "PAID" })).toBe("/zh-TW/order/status?orderQrCode=DEMO-PLAN&embed=1&demoSync=parent&demoStage=PAID");
    expect(statusDemoSrc("en", { embed: false })).toBe("/en/order/status?orderQrCode=DEMO-PLAN");
  });
});
