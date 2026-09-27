import { expect, test } from "vitest";
import { dollarsToCents } from "../ui/Field";

test("dollars text becomes whole cents, empty or junk becomes null", () => {
  expect(dollarsToCents("12.5")).toBe(1250);
  expect(dollarsToCents("0.07")).toBe(7);
  expect(dollarsToCents("$1,249.99")).toBe(124999);
  expect(dollarsToCents("  ")).toBeNull();
  expect(dollarsToCents("abc")).toBeNull();
});
