import { describe, expect, test } from "vitest";
import { activeHref, navFor, NAV_GROUPS, DOCK_ITEMS, HAS_SUPPORT } from "../nav";
import { canAccess } from "../access";

describe("navFor", () => {
  test("never shows an item the role can't open", () => {
    for (const role of ["owner", "manager", "station"] as const) {
      const { dock, groups } = navFor(role);
      for (const item of [...dock, ...groups.flatMap((g) => g.items)]) expect(canAccess(role, item.href), `${role} ${item.href}`).toBe(true);
    }
  });
  test("manager has no Owner group; empty groups are dropped", () => {
    expect(navFor("manager").groups.map((g) => g.title)).toEqual(["Sell", "Stores", "Insights"]);
    expect(navFor("station").dock).toEqual([]);
    expect(navFor("station").groups.map((g) => g.title)).toEqual(["Stores"]);
  });
  test("every nav href is unique", () => {
    const hrefs = [...DOCK_ITEMS, ...NAV_GROUPS.flatMap((g) => g.items)].map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("activeHref", () => {
  const hrefs = ["/", "/cleaning", "/cleaning/config", "/gift-cards", "/gift-cards/config", "/orders"];
  test("longest prefix wins; / only matches exactly", () => {
    expect(activeHref("/cleaning/config", hrefs)).toBe("/cleaning/config");
    expect(activeHref("/cleaning", hrefs)).toBe("/cleaning");
    expect(activeHref("/gift-cards/abc123", hrefs)).toBe("/gift-cards");
    expect(activeHref("/", hrefs)).toBe("/");
    expect(activeHref("/orders/o1", hrefs)).toBe("/orders");
    expect(activeHref("/menu", hrefs)).toBeNull();
  });
  test("shop orders belong to the Orders section", () => {
    expect(activeHref("/shop-orders", hrefs)).toBe("/orders");
    expect(activeHref("/shop-orders/s1", hrefs)).toBe("/orders");
  });
  test("support belongs to the Orders section (Task D12); owner and manager open it, stations don't", () => {
    expect(HAS_SUPPORT).toBe(true);
    expect(activeHref("/support", hrefs)).toBe("/orders");
    expect(activeHref("/support/c1", hrefs)).toBe("/orders");
    expect(canAccess("owner", "/support/c1")).toBe(true);
    expect(canAccess("manager", "/support")).toBe(true);
    expect(canAccess("station", "/support")).toBe(false);
  });
});
