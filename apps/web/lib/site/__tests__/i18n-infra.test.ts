/**
 * Task C5: the next-intl error handlers, the allowlist helpers and the
 * route list the English-leak crawl walks.
 */
import { readFileSync } from "node:fs";
// @ts-expect-error -- apps/web pins @types/node@^20, which lacks fs.globSync (Node 22 has it); same as no-emoji.test.ts.
import { globSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { englishLeaks, stripAllowlisted } from "../i18n-allowlist";
import { createIntlErrorHandlers } from "../i18n-errors";
import { SAMPLE_LOCATION_ID, SITE_ROUTES, routeUrl } from "../routes";

const WEB = path.resolve(__dirname, "../../..");
const missing = (msg = "MISSING_MESSAGE: Could not resolve `site.nav.menu` in messages for locale `es`.") => {
  const e = new Error(msg) as Error & { code: string };
  e.code = "MISSING_MESSAGE";
  return e;
};

describe("createIntlErrorHandlers", () => {
  it("test: throws on any error", () => {
    const { onError } = createIntlErrorHandlers("test", () => {});
    expect(() => onError(missing())).toThrow(/MISSING_MESSAGE/);
  });

  it("development: shows the key path and logs once per key", () => {
    const log = vi.fn();
    const { onError, getMessageFallback } = createIntlErrorHandlers("development", log);
    for (let i = 0; i < 3; i++) {
      onError(missing());
      expect(getMessageFallback({ error: missing(), namespace: "site.nav", key: "menu" })).toBe("site.nav.menu");
    }
    expect(log.mock.calls.map((c) => c[0])).toEqual(["[i18n] MISSING_MESSAGE: site.nav.menu"]);
  });

  it("production: an empty string, logged once per key", () => {
    const log = vi.fn();
    const { onError, getMessageFallback } = createIntlErrorHandlers("production", log);
    for (let i = 0; i < 5; i++) {
      onError(missing());
      expect(getMessageFallback({ error: missing(), namespace: "site.nav", key: "menu" })).toBe("");
    }
    expect(getMessageFallback({ error: missing(), namespace: "site.nav", key: "order" })).toBe("");
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      "[i18n] MISSING_MESSAGE: site.nav.menu",
      "[i18n] MISSING_MESSAGE: site.nav.order",
    ]);
  });

  it("production: plan keys never throw and never log", () => {
    const log = vi.fn();
    const { onError, getMessageFallback } = createIntlErrorHandlers("production", log);
    const planErr = missing("MISSING_MESSAGE: Could not resolve `plan.hero.title` in messages for locale `es`.");
    expect(() => onError(planErr)).not.toThrow();
    expect(getMessageFallback({ error: planErr, namespace: "plan.hero", key: "title" })).toBe("");
    const fmt = Object.assign(new Error("FORMATTING_ERROR: bad arg in plan.hero.title"), { code: "FORMATTING_ERROR" });
    onError(fmt);
    expect(log).not.toHaveBeenCalled();
  });

  it("production: per-message errors are logged by the fallback (with the key), others once per message by onError", () => {
    const log = vi.fn();
    const { onError, getMessageFallback } = createIntlErrorHandlers("production", log);
    const invalid = Object.assign(new Error("INVALID_MESSAGE: bad ICU"), { code: "INVALID_MESSAGE" });
    onError(invalid); // routed to the fallback, which knows the key
    expect(getMessageFallback({ error: invalid, namespace: "site.shell", key: "activeOrder" })).toBe("");
    const env = Object.assign(new Error("ENVIRONMENT_FALLBACK: no timeZone configured"), { code: "ENVIRONMENT_FALLBACK" });
    onError(env);
    onError(env);
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      "[i18n] INVALID_MESSAGE: site.shell.activeOrder",
      "[i18n] ENVIRONMENT_FALLBACK: ENVIRONMENT_FALLBACK: no timeZone configured",
    ]);
  });

  it("the plan check is structural (the fallback's namespace), not a message regex", () => {
    const log = vi.fn();
    const { onError, getMessageFallback } = createIntlErrorHandlers("production", log);
    // A formatting error whose text never mentions "plan" is still silent for a plan key.
    const fmt = Object.assign(new Error("FORMATTING_ERROR: argument missing"), { code: "FORMATTING_ERROR" });
    onError(fmt);
    expect(getMessageFallback({ error: fmt, namespace: "plan.hero", key: "title" })).toBe("");
    expect(log).not.toHaveBeenCalled();
  });

  it("is wired into i18n/request.ts, next to withPlanFallback", () => {
    const src = readFileSync(path.join(WEB, "i18n/request.ts"), "utf8");
    expect(src).toMatch(/withPlanFallback\(messages\)/);
    expect(src).toMatch(/onError: intlErrors\.onError/);
    expect(src).toMatch(/getMessageFallback: intlErrors\.getMessageFallback/);
  });
});

describe("i18n allowlist", () => {
  it("removes brand names, units, pod labels and endonyms as whole words only", () => {
    expect(englishLeaks("Oh! Beef Noodle Soup")).toEqual([]);
    expect(englishLeaks("Chappy 幫您點餐，Apple Pay 或 Google Pay，Stripe")).toEqual([]);
    expect(englishLeaks("座位 B-07，12 oz，3 mi，QR")).toEqual([]);
    expect(englishLeaks("English Español 繁體中文")).toEqual([]);
    expect(englishLeaks("Wagyu 和牛")).toEqual([]);
    expect(englishLeaks("加入 Apple 錢包，新增至 Google 錢包，Apple Wallet")).toEqual([]);
    // "mi" is a unit, not a prefix: "minutes" is still English.
    expect(englishLeaks("5 minutes")).toEqual(["minutes"]);
    expect(stripAllowlisted("Chappyness")).toContain("Chappyness");
  });

  it("drops digits and currency before looking for words", () => {
    expect(englishLeaks("$12.50 NT$300 ¥20")).toEqual([]);
    expect(englishLeaks("訂單 A32 已完成")).toEqual([]);
    expect(englishLeaks("Sign in 登入")).toEqual(["Sign"]);
  });
});

describe("lib/site/routes.ts", () => {
  it("lists every customer page under app/[locale] (and nothing that isn't one)", () => {
    const pages = (globSync("app/[[]locale]/**/page.tsx", { cwd: WEB }) as string[])
      .map((f) => f.replace(/^app\/\[locale\]\//, ""))
      .filter((f) => !/^(plan|kiosk|kiosk-unauthorized|cny|agents)\//.test(f) && !f.startsWith("(site)/lab/"))
      .sort();
    expect(SITE_ROUTES.map((r) => r.file).sort()).toEqual(pages);
  });

  it("each route's group matches the folder its page lives in", () => {
    for (const r of SITE_ROUTES) expect(r.file.startsWith(`(${r.group})/`), r.path).toBe(true);
  });

  it("fills params and query", () => {
    const loc = SITE_ROUTES.find((r) => r.path === "/order/location/:locationId")!;
    expect(routeUrl(loc, (v) => (v === SAMPLE_LOCATION_ID ? "loc_1" : v))).toBe("/order/location/loc_1");
    const status = SITE_ROUTES.find((r) => r.path === "/order/status")!;
    expect(routeUrl(status)).toBe("/order/status?orderQrCode=DEMO-PLAN.PREPPING");
  });
});
