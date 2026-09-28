import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import * as planContact from "@/components/plan/modules/foundation/contact";
import { FOUNDATION, FOUNDATION_MARK, FOUNDATION_PLEDGE_PCT, displayUrl } from "../foundation";

// Site follow-up 2026-09-28: the foundation's facts moved to a client-safe
// module shared by the site and the plan. The plan's contact.ts re-exports it.

const PUBLIC = path.resolve(__dirname, "../../../public");

describe("lib/site/foundation", () => {
  test("the plan reads the very same constants", () => {
    expect(planContact.FOUNDATION).toBe(FOUNDATION);
    expect(planContact.displayUrl).toBe(displayUrl);
  });

  test("the facts the site shows", () => {
    expect(FOUNDATION.ein).toBe("33-7041706");
    expect(FOUNDATION.name).toBe("ONE RED STEP AT A TIME®");
    expect(FOUNDATION.siteName).toBe("ONE RED STEP AT A TIME");
    expect(FOUNDATION.donate).toBe(`${FOUNDATION.website}/donate`);
    expect(FOUNDATION.store).toBe(`${FOUNDATION.website}/store`);
    expect(FOUNDATION_PLEDGE_PCT).toBe(1);
    for (const s of FOUNDATION.social) expect(s.url).toMatch(/^https:\/\//);
  });

  test("the marks exist in public/", () => {
    expect(existsSync(path.join(PUBLIC, FOUNDATION.logo.src))).toBe(true);
    expect(existsSync(path.join(PUBLIC, FOUNDATION_MARK))).toBe(true);
  });

  test("displayUrl drops the scheme and a trailing slash", () => {
    expect(displayUrl("https://www.oneredstepatatime.org/donate/")).toBe("www.oneredstepatatime.org/donate");
  });
});
