import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { canAccess, decide, homeFor, parseRole, ACCESS_RULES } from "../access";

describe("canAccess", () => {
  test("owner sees everything", () => {
    for (const p of ["/", "/plan-access", "/analytics/revenue", "/team", "/kitchen", "/gift-cards/config"]) expect(canAccess("owner", p)).toBe(true);
  });
  test("manager: day-to-day yes, owner areas no", () => {
    for (const p of ["/", "/orders", "/menu", "/promos", "/gift-cards/abc", "/catering/1", "/cleaning/config", "/analytics", "/analytics/operations", "/kitchen"]) expect(canAccess("manager", p), p).toBe(true);
    for (const p of ["/plan-access", "/plan-access/x", "/analytics/revenue", "/analytics/customers", "/analytics/funnel", "/locations", "/tenants", "/kiosks", "/team", "/gift-cards/config"]) expect(canAccess("manager", p), p).toBe(false);
  });
  test("station: displays only", () => {
    expect(canAccess("station", "/kitchen")).toBe(true);
    expect(canAccess("station", "/cleaning")).toBe(true);
    for (const p of ["/", "/cleaning/config", "/menu", "/orders"]) expect(canAccess("station", p), p).toBe(false);
  });
  test("public paths need no role; unknown paths are owner-only", () => {
    expect(canAccess(null, "/unauthorized")).toBe(true);
    expect(canAccess(null, "/sign-in/factor-one")).toBe(true);
    expect(canAccess(null, "/")).toBe(false);
    expect(canAccess("manager", "/some-new-page")).toBe(false);
  });
  test("prefix match does not bleed across names", () => {
    expect(canAccess("manager", "/menu-secret")).toBe(false);
  });
});

describe("decide", () => {
  test("no role goes to /unauthorized; station goes to /kitchen; manager to /", () => {
    expect(decide(null, "/menu")).toEqual({ kind: "redirect", to: "/unauthorized" });
    expect(decide("station", "/")).toEqual({ kind: "redirect", to: "/kitchen" });
    expect(decide("manager", "/team")).toEqual({ kind: "redirect", to: "/" });
    expect(decide("manager", "/menu")).toEqual({ kind: "next" });
  });
  test("homeFor", () => { expect(homeFor("station")).toBe("/kitchen"); expect(homeFor("owner")).toBe("/"); });
  test("parseRole", () => { expect(parseRole("manager")).toBe("manager"); expect(parseRole("x")).toBeNull(); expect(parseRole(null)).toBeNull(); });
});

describe("every page has a rule", () => {
  test("each app route segment is covered by ACCESS_RULES or public", () => {
    const appDir = path.resolve(__dirname, "../../app");
    const pages: string[] = [];
    const walk = (dir: string, route: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name.startsWith("_") || name === "api") continue;
          const seg = name.startsWith("(") ? "" : name.startsWith("[") ? "x" : name;
          walk(full, seg ? `${route}/${seg}` : route);
        } else if (name === "page.tsx") pages.push(route || "/");
      }
    };
    walk(appDir, "");
    const covered = (p: string) => p.startsWith("/unauthorized") || p.startsWith("/sign-") || ACCESS_RULES.some((r) => (r.exact ? p === r.path : p === r.path || p.startsWith(r.path + "/")));
    expect(pages.filter((p) => !covered(p))).toEqual([]);
  });
});
