import { expect, test } from "vitest";
import { REPORTS, reportsFor } from "../analytics";
import { canAccess } from "../access";

test("reports shown per role match access rules", () => {
  for (const role of ["owner", "manager"] as const) for (const r of reportsFor(role)) expect(canAccess(role, r.href)).toBe(true);
  expect(reportsFor("manager").map((r) => r.href)).not.toContain("/analytics/revenue");
  expect(REPORTS).toHaveLength(10);
});

test("owner sees every report", () => {
  expect(reportsFor("owner")).toHaveLength(10);
});

test("station sees no reports", () => {
  expect(reportsFor("station")).toHaveLength(0);
});
