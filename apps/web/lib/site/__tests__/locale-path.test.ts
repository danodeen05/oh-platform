import { describe, expect, test } from "vitest";
import { locales } from "@/i18n/config";
import { swapLocalePath } from "../locale-path";

// Task C4: LocaleSwitch keeps the same path and query and swaps only the
// locale segment. The rewrite is a pure function so it can be tested here.

describe("swapLocalePath", () => {
  test.each(locales)("swaps /en/lab/shell to /%s/lab/shell", (target) => {
    expect(swapLocalePath("/en/lab/shell", "", target)).toBe(`/${target}/lab/shell`);
  });

  test.each(locales)("swaps from %s to every other locale", (from) => {
    for (const to of locales) {
      expect(swapLocalePath(`/${from}/menu`, "", to)).toBe(`/${to}/menu`);
    }
  });

  test("keeps the query string, with or without its leading ?", () => {
    expect(swapLocalePath("/en/order/status", "?orderQrCode=ABC.1&x=2", "zh-TW")).toBe(
      "/zh-TW/order/status?orderQrCode=ABC.1&x=2",
    );
    expect(swapLocalePath("/en/order/status", "orderQrCode=ABC", "es")).toBe("/es/order/status?orderQrCode=ABC");
  });

  test("keeps encoded characters in the query untouched", () => {
    expect(swapLocalePath("/es/menu", "?q=caf%C3%A9%20con%20leche", "zh-CN")).toBe("/zh-CN/menu?q=caf%C3%A9%20con%20leche");
  });

  test("keeps the hash", () => {
    expect(swapLocalePath("/en/menu", "?a=1", "es", "#soups")).toBe("/es/menu?a=1#soups");
    expect(swapLocalePath("/en/menu", "", "es", "soups")).toBe("/es/menu#soups");
  });

  test("an empty ? or # is dropped", () => {
    expect(swapLocalePath("/en/menu", "?", "es", "#")).toBe("/es/menu");
  });

  test("the locale home swaps to the other locale home", () => {
    expect(swapLocalePath("/en", "", "zh-TW")).toBe("/zh-TW");
    expect(swapLocalePath("/zh-TW/", "", "en")).toBe("/en");
  });

  test("a path without a locale prefix gets one", () => {
    expect(swapLocalePath("/menu", "", "es")).toBe("/es/menu");
    expect(swapLocalePath("/", "", "zh-CN")).toBe("/zh-CN");
    expect(swapLocalePath("", "?a=1", "en")).toBe("/en?a=1");
  });

  test("only the first segment is a locale; a later 'en' segment is kept", () => {
    expect(swapLocalePath("/es/store/en", "", "en")).toBe("/en/store/en");
  });

  test("locale matching is exact (zh is not a locale, zh-TW is)", () => {
    expect(swapLocalePath("/zh/menu", "", "en")).toBe("/en/zh/menu");
  });
});
