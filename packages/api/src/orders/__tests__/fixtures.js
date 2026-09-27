/**
 * Shared fixtures for the order service and routes tests.
 */
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";

// Thursday 2026-10-01, noon in Denver: the default hours (11:00-21:00) are open.
export const NOW = new Date("2026-10-01T12:00:00-06:00");
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export const MENU = [
  { id: "classic", tenantId: "t1", name: "Classic Beef Noodle Soup", basePriceCents: 1599, additionalPriceCents: 0, includedQuantity: 0, category: "main01", categoryType: "MAIN", isAvailable: true },
  { id: "wagyu", tenantId: "t1", name: "American Wagyu Beef Noodle Soup", basePriceCents: 2399, additionalPriceCents: 0, includedQuantity: 0, category: "main01", categoryType: "MAIN", isAvailable: true },
  { id: "wide", tenantId: "t1", name: "Wide Noodles", basePriceCents: 0, additionalPriceCents: 0, includedQuantity: 0, category: "main02", categoryType: "MAIN", isAvailable: true },
  { id: "bokchoy", tenantId: "t1", name: "Baby Bok Choy", basePriceCents: 150, additionalPriceCents: 100, includedQuantity: 1, category: "slider04", categoryType: "SLIDER", isAvailable: true },
  { id: "egg", tenantId: "t1", name: "Soft-Boild Egg", basePriceCents: 199, additionalPriceCents: 199, includedQuantity: 0, category: "add-on04", categoryType: "ADDON", isAvailable: true },
  { id: "marrow", tenantId: "t1", name: "Bone Marrow", basePriceCents: 399, additionalPriceCents: 399, includedQuantity: 0, category: "add-on01", categoryType: "ADDON", isAvailable: true },
  { id: "soldout", tenantId: "t1", name: "Sold Out Special", basePriceCents: 999, additionalPriceCents: 0, includedQuantity: 0, category: "main01", categoryType: "MAIN", isAvailable: false },
  { id: "foreign", tenantId: "t2", name: "Other Tenant Bowl", basePriceCents: 100, additionalPriceCents: 0, includedQuantity: 0, category: "main01", categoryType: "MAIN", isAvailable: true },
  { id: "preview", tenantId: "t1", name: "Next Month's Bowl", basePriceCents: 1899, additionalPriceCents: 0, includedQuantity: 0, category: "main01", categoryType: "MAIN", isAvailable: true, releaseAt: new Date(NOW.getTime() + 10 * DAY_MS) },
];

export const SEATS = [
  { id: "s-a01", locationId: "L1", number: "01", label: "A-01", finger: 0, position: 1, status: "AVAILABLE", podType: "SINGLE" },
  { id: "s-a02", locationId: "L1", number: "02", label: "A-02", finger: 0, position: 2, status: "AVAILABLE", podType: "SINGLE" },
  { id: "s-b07", locationId: "L1", number: "07", label: "B-07", finger: 1, position: 7, status: "AVAILABLE", podType: "SINGLE" },
  { id: "s-c01", locationId: "L1", number: "31", label: "C-01", finger: 2, position: 1, status: "AVAILABLE", podType: "DUAL", dualPartnerId: "s-c02" },
  { id: "s-c02", locationId: "L1", number: "32", label: "C-02", finger: 2, position: 2, status: "AVAILABLE", podType: "DUAL", dualPartnerId: "s-c01" },
  { id: "s-old", locationId: "L1", number: "99", label: "A-00", finger: 0, position: 0, status: "AVAILABLE", podType: "SINGLE", retiredAt: new Date("2026-09-01") },
];

export function seed(extra = {}) {
  return makeMemoryPrisma({
    tenants: [{ id: "t1", slug: "oh" }],
    locations: [{ id: "L1", tenantId: "t1", name: "City Creek Mall", taxRate: 0.1, timezone: "America/Denver", isClosed: false }],
    menuItems: MENU,
    seats: SEATS.map((s) => ({ ...s })),
    users: [
      { id: "u1", email: "u1@x.com", membershipTier: "CHOPSTICK", creditsCents: 0, currentStreak: 2, longestStreak: 3, lifetimeOrderCount: 4, lifetimeSpentCents: 0, lastOrderDate: new Date(NOW.getTime() - DAY_MS) },
      { id: "u2", email: "u2@x.com", membershipTier: "CHOPSTICK", creditsCents: 0, currentStreak: 0, longestStreak: 0, lifetimeOrderCount: 0, lifetimeSpentCents: 0 },
    ],
    ...extra,
  });
}

/** A Stripe double: `intents` is a live map the test can fill after it knows an order id. */
export function fakeStripe(intents = {}, { onRetrieve = null } = {}) {
  const created = [];
  const issuedRefunds = []; // refunds Stripe "has"
  const refundCalls = []; // every refunds.create call: [params, options]
  return {
    intents,
    created,
    issuedRefunds,
    refundCalls,
    refunds: {
      async list({ payment_intent }) {
        return { data: issuedRefunds.filter((r) => r.payment_intent === payment_intent) };
      },
      async create(params, options) {
        refundCalls.push([params, options]);
        const refund = { id: `re_test_${issuedRefunds.length + 1}`, payment_intent: params.payment_intent, status: "succeeded" };
        issuedRefunds.push(refund);
        return refund;
      },
    },
    paymentIntents: {
      async retrieve(id) {
        const pi = intents[id];
        if (!pi) {
          const err = new Error(`No such payment_intent: '${id}'`);
          err.code = "resource_missing";
          throw err;
        }
        const result = { id, currency: "usd", ...pi };
        if (onRetrieve) await onRetrieve(id, result);
        return result;
      },
      async create(params) {
        const id = `pi_test_${created.length + 1}`;
        created.push(params);
        intents[id] = { status: "requires_payment_method", ...params };
        return { id, client_secret: `${id}_secret_abc`, ...params };
      },
    },
    paymentMethods: {
      async retrieve() {
        return { card: { last4: "4242", brand: "visa" } };
      },
    },
  };
}

/** Side-effect spies for markPaid. */
export function fakeEffects() {
  const calls = { sendOrderConfirmation: 0, afterPaid: 0, onOrderCompleted: 0, mealGiftAccepted: 0 };
  return {
    calls,
    effects: {
      sendOrderConfirmation: async () => { calls.sendOrderConfirmation++; },
      afterPaid: async () => { calls.afterPaid++; },
      onOrderCompleted: async () => { calls.onOrderCompleted++; },
      mealGiftAccepted: async () => { calls.mealGiftAccepted++; },
    },
  };
}

export const CLASSIC_BOWL = [
  { menuItemId: "classic", quantity: 1 },
  { menuItemId: "wide", quantity: 1 },
  { menuItemId: "bokchoy", quantity: 2 },
];
