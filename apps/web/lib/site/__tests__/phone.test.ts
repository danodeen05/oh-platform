import { describe, expect, test } from "vitest";
import { normalizePhoneE164, isValidOptionalPhone } from "../phone";

describe("normalizePhoneE164", () => {
  test("normalizes common US formats and keeps international numbers", () => {
    for (const raw of ["+18015550100", "18015550100", "8015550100", "(801) 555-0100", "801-555-0100", "801.555.0100", "+1 (801) 555-0100", "001 801 555 0100"]) {
      expect(normalizePhoneE164(raw)).toBe("+18015550100");
    }
    expect(normalizePhoneE164("+44 20 7946 0958")).toBe("+442079460958");
  });

  test("rejects partial, empty, malformed numbers, +0..., and a US area code starting with 0 or 1", () => {
    for (const raw of ["5550100", "555-0100", "", "   ", null, undefined, "abc", "+0123456789", "0801555010", "1801555010", "12345678901234567"]) {
      expect(normalizePhoneE164(raw)).toBeNull();
    }
  });
});

describe("isValidOptionalPhone", () => {
  test("blank is valid (phone is optional at checkout)", () => {
    expect(isValidOptionalPhone("")).toBe(true);
    expect(isValidOptionalPhone("   ")).toBe(true);
    expect(isValidOptionalPhone(null)).toBe(true);
    expect(isValidOptionalPhone(undefined)).toBe(true);
  });

  test("a parseable phone is valid; garbage is not", () => {
    expect(isValidOptionalPhone("(801) 555-1234")).toBe(true);
    expect(isValidOptionalPhone("555-1234")).toBe(false);
    expect(isValidOptionalPhone("abc")).toBe(false);
  });
});
