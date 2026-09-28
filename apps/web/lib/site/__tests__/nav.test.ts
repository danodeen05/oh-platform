import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { ICON_NAMES } from "@/components/site/icons/Icon";
import { locales } from "@/i18n/config";
import {
  ACCOUNT_ITEM,
  DOCK_ITEMS,
  MORE_ITEMS,
  SITE_NAV_KEYS,
  isNavActive,
  isNavLink,
  localizedHref,
} from "../nav";

// Task C4: the shell's nav model. Hrefs live here (and only here) so the
// Phase D tasks can flip /loyalty -> /rewards (D7) and add /experience (D2)
// in one place.

describe("DOCK_ITEMS", () => {
  test("is exactly order, menu, rewards, chappy, in that order", () => {
    expect(DOCK_ITEMS.map((i) => i.key)).toEqual(["order", "menu", "rewards", "chappy"]);
  });

  test("order is the one primary item and goes to /order with the bowl icon", () => {
    const order = DOCK_ITEMS[0];
    expect(order).toMatchObject({ key: "order", href: "/order", icon: "bowl", primary: true });
    expect(DOCK_ITEMS.filter((i) => isNavLink(i) && i.primary)).toHaveLength(1);
  });

  test("chappy is an action, not a link", () => {
    const chappy = DOCK_ITEMS[3];
    expect(chappy).toMatchObject({ key: "chappy", action: "openChappy" });
    expect(isNavLink(chappy)).toBe(false);
    expect("href" in chappy).toBe(false);
  });

  test("rewards points at the legacy loyalty page until D7 builds /rewards", () => {
    expect(DOCK_ITEMS[2]).toMatchObject({ key: "rewards", href: "/loyalty" });
  });
});

describe("MORE_ITEMS", () => {
  test("is locations, experience, store, gift cards, contact", () => {
    expect(MORE_ITEMS.map((i) => i.key)).toEqual(["locations", "experience", "store", "giftCards", "contact"]);
  });

  test("every item is a locale-free absolute path", () => {
    for (const item of MORE_ITEMS) {
      expect(item.href).toMatch(/^\/[a-z-]+$/);
    }
  });
});

describe("every nav item", () => {
  const all = [...DOCK_ITEMS, ...MORE_ITEMS, ACCOUNT_ITEM];

  test("uses an icon that exists in the in-house set", () => {
    for (const item of all) {
      expect(ICON_NAMES, `${item.key} -> ${item.icon}`).toContain(item.icon);
    }
  });

  test("has a unique key listed in SITE_NAV_KEYS", () => {
    const keys = all.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(SITE_NAV_KEYS).toContain(k);
  });
});

describe("localizedHref", () => {
  test("prefixes the locale", () => {
    expect(localizedHref("zh-TW", "/menu")).toBe("/zh-TW/menu");
    expect(localizedHref("en", "/")).toBe("/en");
  });
});

describe("isNavActive", () => {
  test("matches the route and its subpaths, in any locale", () => {
    expect(isNavActive("/en/menu", "/menu")).toBe(true);
    expect(isNavActive("/zh-TW/menu", "/menu")).toBe(true);
    expect(isNavActive("/es/order/status", "/order")).toBe(true);
  });

  test("does not match a sibling that only shares a prefix", () => {
    expect(isNavActive("/en/ordering", "/order")).toBe(false);
    expect(isNavActive("/en/locations", "/loyalty")).toBe(false);
    expect(isNavActive("/en", "/menu")).toBe(false);
    expect(isNavActive(null, "/menu")).toBe(false);
  });
});

describe("site.nav and site.shell messages", () => {
  const MESSAGES = path.resolve(__dirname, "../../../messages");
  const load = (l: string) => JSON.parse(readFileSync(path.join(MESSAGES, `${l}.json`), "utf8"));

  function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object" ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  }

  test.each(locales)("%s has a label for every nav key", (locale) => {
    const nav = load(locale).site?.nav ?? {};
    for (const key of SITE_NAV_KEYS) {
      expect(typeof nav[key], `${locale}: site.nav.${key}`).toBe("string");
      expect(nav[key].trim().length).toBeGreaterThan(0);
    }
  });

  test("all 4 locales have identical site.* key sets", () => {
    const en = flatKeys(load("en").site).sort();
    for (const locale of locales) {
      expect(flatKeys(load(locale).site).sort(), locale).toEqual(en);
    }
  });

  test("the non-English files are really translated (not English copies)", () => {
    const en = load("en").site.nav;
    for (const locale of ["zh-TW", "zh-CN", "es"]) {
      const other = load(locale).site.nav;
      // Chappy is a name, the same in every language.
      const same = SITE_NAV_KEYS.filter((k) => k !== "chappy" && other[k] === en[k]);
      expect(same, locale).toEqual([]);
    }
  });

  test("no em dashes and no emoji anywhere in site.*", () => {
    for (const locale of locales) {
      const text = JSON.stringify(load(locale).site);
      expect(text, locale).not.toContain("—");
      expect(/\p{Extended_Pictographic}/u.test(text), locale).toBe(false);
    }
  });
});
