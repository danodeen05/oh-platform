import { expect, test } from "vitest";
import {
  adjustmentCapText, adjustmentCents, adjustmentError, adjustmentPrompt, maxAddCents, isExpired, pageSummary, percentUsed, purchaserName, recipientName,
  remainingPercent, slugifyDesignId, statusTone, validateCustomRange, validateDenomination,
} from "../gift-cards";

test("statusTone covers every GiftCardStatus", () => {
  for (const s of ["ACTIVE", "REDEEMED", "EXHAUSTED", "EXPIRED", "CANCELLED"]) expect(statusTone(s)).toBeTruthy();
  expect(statusTone("ACTIVE")).toBe("good");
  expect(statusTone("CANCELLED")).toBe("alert");
});

test("purchaserName and recipientName fall back correctly", () => {
  expect(purchaserName({ purchaser: { id: "1", name: "Mei", email: null } })).toBe("Mei");
  expect(purchaserName({ purchaser: null })).toBe("Guest");
  expect(recipientName({ recipientEmail: null, recipientName: null })).toBe("Self");
  expect(recipientName({ recipientEmail: "a@x.com", recipientName: null })).toBe("Unknown");
  expect(recipientName({ recipientEmail: "a@x.com", recipientName: "Sam" })).toBe("Sam");
});

test("remainingPercent and percentUsed", () => {
  expect(remainingPercent(5000, 3500)).toBe(70);
  expect(percentUsed(5000, 3500)).toBe(30);
  expect(remainingPercent(0, 0)).toBe(0);
  expect(remainingPercent(5000, 0)).toBe(0);
  expect(remainingPercent(5000, 5000)).toBe(100);
});

test("isExpired", () => {
  const now = new Date("2026-09-27T20:00:00Z");
  expect(isExpired({ expiresAt: "2026-01-01T00:00:00Z" }, now)).toBe(true);
  expect(isExpired({ expiresAt: "2027-01-01T00:00:00Z" }, now)).toBe(false);
  expect(isExpired({ expiresAt: null }, now)).toBe(false);
});

test("adjustmentCents parses signed dollars", () => {
  expect(adjustmentCents("5")).toBe(500);
  expect(adjustmentCents("-5.50")).toBe(-550);
  expect(adjustmentCents("")).toBeNull();
  expect(adjustmentCents("abc")).toBeNull();
});

test("adjustmentPrompt: Add vs Remove copy", () => {
  expect(adjustmentPrompt("OHGC-1234", 500)).toBe("Add $5.00 to OHGC-1234?");
  expect(adjustmentPrompt("OHGC-1234", -500)).toBe("Remove $5.00 from OHGC-1234?");
});

test("pageSummary", () => {
  expect(pageSummary({ page: 1, limit: 20, totalCount: 5, totalPages: 1 })).toBe("Page 1 of 1");
});

test("validateDenomination requires a positive amount", () => {
  expect(validateDenomination("25")).toBeUndefined();
  expect(validateDenomination("0")).toBeTruthy();
  expect(validateDenomination("")).toBeTruthy();
  expect(validateDenomination("-5")).toBeTruthy();
});

test("validateCustomRange: min >= 0, max > min", () => {
  expect(validateCustomRange("10", "500")).toEqual({});
  expect(validateCustomRange("-1", "500").min).toBeTruthy();
  expect(validateCustomRange("10", "10").max).toBeTruthy();
  expect(validateCustomRange("10", "5").max).toBeTruthy();
});

test("slugifyDesignId lowercases and turns spaces into dashes", () => {
  expect(slugifyDesignId("Festive Winter")).toBe("festive-winter");
  expect(slugifyDesignId("  Gold!! ")).toBe("gold");
});

test("adding balance is capped at the original amount", () => {
  const card = { amountCents: 5000, balanceCents: 3000 };
  expect(maxAddCents(card)).toBe(2000);
  expect(maxAddCents({ amountCents: 5000, balanceCents: 5000 })).toBe(0);
  expect(adjustmentCapText(card)).toBe("Balance can't exceed the original $50.00; max you can add is $20.00.");
  expect(adjustmentError(card, 2000)).toBeUndefined();
  expect(adjustmentError(card, 2001)).toBe(adjustmentCapText(card));
  expect(adjustmentError(card, -3000)).toBeUndefined();
  expect(adjustmentError(card, 0)).toBe("Enter a non-zero amount.");
  expect(adjustmentError(card, null)).toBe("Enter a non-zero amount.");
});
