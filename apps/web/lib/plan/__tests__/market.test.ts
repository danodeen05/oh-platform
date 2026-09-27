import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import zhTW from "../../../messages/zh-TW.json";
import { COMPETITORS } from "../../../components/plan/modules/market/marketData";

describe("market: Din Tai Fung", () => {
  it("adds the dinTaiFung competitor before oh, without moving other data points", () => {
    const keys = COMPETITORS.map((c) => c.key);
    const dtfIndex = keys.indexOf("dinTaiFung");
    const ohIndex = keys.indexOf("oh");
    expect(dtfIndex).toBeGreaterThan(-1);
    expect(dtfIndex).toBeLessThan(ohIndex);

    const dtf = COMPETITORS.find((c) => c.key === "dinTaiFung");
    expect(dtf).toMatchObject({ efficiency: 0.42, experience: 0.9 });

    const others = COMPETITORS.filter((c) => c.key !== "dinTaiFung");
    expect(others).toEqual([
      { key: "fullServiceAsian", efficiency: 0.3, experience: 0.6 },
      { key: "nationalChineseFastFood", efficiency: 0.82, experience: 0.28 },
      { key: "noodleChain", efficiency: 0.62, experience: 0.45 },
      { key: "ramenShop", efficiency: 0.38, experience: 0.72 },
      { key: "ichiran", efficiency: 0.7, experience: 0.82 },
      { key: "oh", efficiency: 0.9, experience: 0.86, oh: true },
    ]);
  });

  it("has plan.market.dtf and matrix.players.dinTaiFung in English and Traditional Chinese, with no em dashes", () => {
    for (const [locale, messages] of [
      ["en", en],
      ["zh-TW", zhTW],
    ] as const) {
      const market = (messages as { plan: { market: Record<string, any> } }).plan.market;
      expect(market.dtf, `${locale}: plan.market.dtf`).toBeTruthy();
      expect(market.dtf.eyebrow, `${locale}: dtf.eyebrow`).toBeTruthy();
      expect(market.dtf.claim, `${locale}: dtf.claim`).toBeTruthy();
      expect(market.dtf.text, `${locale}: dtf.text`).toBeTruthy();
      expect(market.dtf.text).toContain("{pods}");
      expect(market.dtf.text).toContain("{people}");

      expect(market.matrix.players.dinTaiFung, `${locale}: matrix.players.dinTaiFung`).toBeTruthy();

      expect(JSON.stringify(market)).not.toMatch(/—/);
    }
  });

  it("mentions Din Tai Fung in the references paragraph for both locales", () => {
    expect(en.plan.market.references).toMatch(/Din Tai Fung/);
    expect(zhTW.plan.market.references).toMatch(/鼎泰豐/);
  });
});
