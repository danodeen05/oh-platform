import { expect, test } from "vitest";
import {
  customerEmail, customerName, denverDayRange, fulfillmentLabel, fulfillmentTone, isShipped,
  itemCount, itemsSummary, pageSummary, paymentLabel, paymentTone, typeLabel,
} from "../shop-orders";

test("fulfillment labels and tones cover every ShopFulfillmentStatus", () => {
  for (const s of ["PENDING", "PROCESSING", "SHIPPED", "READY_PICKUP", "COMPLETED", "CANCELLED"]) {
    expect(fulfillmentLabel(s)).toBeTruthy();
    expect(fulfillmentTone(s)).toBeTruthy();
  }
  expect(fulfillmentLabel("READY_PICKUP")).toBe("Ready for pickup");
  expect(fulfillmentTone("COMPLETED")).toBe("good");
  expect(fulfillmentTone("CANCELLED")).toBe("alert");
});

test("payment labels and tones", () => {
  expect(paymentLabel("PAID")).toBe("Paid");
  expect(paymentTone("PAID")).toBe("good");
  expect(paymentTone("FAILED")).toBe("alert");
});

test("typeLabel", () => {
  expect(typeLabel("SHIPPING")).toBe("Shipping");
  expect(typeLabel("IN_STORE_PICKUP")).toBe("In-store pickup");
});

test("isShipped: only SHIPPED and COMPLETED hide Mark as shipped", () => {
  expect(isShipped("SHIPPED")).toBe(true);
  expect(isShipped("COMPLETED")).toBe(true);
  expect(isShipped("PENDING")).toBe(false);
  expect(isShipped("PROCESSING")).toBe(false);
  expect(isShipped("READY_PICKUP")).toBe(false);
});

test("customerName and customerEmail: user wins over guest, then Guest fallback", () => {
  expect(customerName({ user: { id: "1", name: "Mei", email: "mei@x.com" }, guest: null })).toBe("Mei");
  expect(customerName({ user: null, guest: { id: "2", name: "Sam", email: null } })).toBe("Sam");
  expect(customerName({ user: null, guest: null })).toBe("Guest");
  expect(customerEmail({ user: null, guest: { id: "2", name: "Sam", email: "sam@x.com" } })).toBe("sam@x.com");
  expect(customerEmail({ user: null, guest: null })).toBeNull();
});

test("itemCount and itemsSummary", () => {
  const items = [
    { id: "1", quantity: 2, priceCents: 100, product: { id: "p1", name: "Home Kit", slug: "home-kit", imageUrl: null } },
    { id: "2", quantity: 1, priceCents: 200, product: { id: "p2", name: "Chili Oil", slug: "chili-oil", imageUrl: null } },
  ];
  expect(itemCount(items)).toBe(3);
  expect(itemsSummary(items)).toBe("3 items · 2x Home Kit, 1x Chili Oil");
  expect(itemsSummary([])).toBe("0 items");
});

test("pageSummary", () => {
  expect(pageSummary({ page: 2, limit: 20, totalCount: 45, totalPages: 3 })).toBe("Page 2 of 3");
});

test("denverDayRange: a 24h span, DST-aware (winter -7, summer -6)", () => {
  const winter = denverDayRange(new Date("2026-01-15T20:00:00Z"));
  expect(new Date(winter.endDate).getTime() - new Date(winter.startDate).getTime()).toBe(24 * 3600 * 1000);
  expect(winter.startDate).toBe("2026-01-15T07:00:00.000Z"); // MST = UTC-7

  const summer = denverDayRange(new Date("2026-07-15T20:00:00Z"));
  expect(summer.startDate).toBe("2026-07-15T06:00:00.000Z"); // MDT = UTC-6

  // 11:30pm Denver local still resolves to that same Denver calendar day.
  const lateNight = denverDayRange(new Date("2026-07-16T05:30:00Z")); // 11:30pm MDT on the 15th
  expect(lateNight.startDate).toBe("2026-07-15T06:00:00.000Z");
});
