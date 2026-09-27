import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  itemPriceCents,
  priceLines,
  taxCents,
  computeTotals,
  rewardDiscountCents,
  MAX_CREDITS_PER_ORDER_CENTS,
} from "../pricing.js";

// The pre-A6 calculateItemPrice from POST /orders (index.js), kept here
// verbatim as the parity oracle.
function oldCalculateItemPrice(menuItem, quantity) {
  if (quantity <= menuItem.includedQuantity) {
    return 0;
  }
  if (menuItem.includedQuantity > 0) {
    const extraQuantity = quantity - menuItem.includedQuantity;
    return menuItem.basePriceCents + menuItem.additionalPriceCents * (extraQuantity - 1);
  }
  return menuItem.basePriceCents + menuItem.additionalPriceCents * (quantity - 1);
}

/** Menu rows from packages/db/prisma/seed-prod.ts, with the schema defaults applied. */
function seedProdMenu() {
  const src = readFileSync(new URL("../../../../db/prisma/seed-prod.ts", import.meta.url), "utf8");
  const rows = [];
  for (const line of src.split("\n")) {
    if (!/\bbasePriceCents:\s*\d+/.test(line) || !/\bid:\s*'/.test(line)) continue;
    const num = (key, dflt) => {
      const m = new RegExp(`\\b${key}:\\s*(\\d+)`).exec(line);
      return m ? Number(m[1]) : dflt;
    };
    rows.push({
      id: /\bid:\s*'([^']+)'/.exec(line)[1],
      name: (/\bname:\s*'([^']+)'/.exec(line) || [])[1],
      basePriceCents: num("basePriceCents", 0),
      additionalPriceCents: num("additionalPriceCents", 0),
      includedQuantity: num("includedQuantity", 0),
    });
  }
  return rows;
}

describe("pricing parity", () => {
  const menu = seedProdMenu();

  test("the seed-prod fixture parses", () => {
    assert.ok(menu.length >= 25, `only ${menu.length} items parsed`);
  });

  test("priceLines matches the old calculateItemPrice for quantities 0-4 of every item", () => {
    for (const item of menu) {
      for (let q = 0; q <= 4; q++) {
        const [line] = priceLines(menu, [{ menuItemId: item.id, quantity: q }]);
        assert.equal(line.priceCents, oldCalculateItemPrice(item, q), `${item.name} x${q}`);
        assert.equal(itemPriceCents(item, q), oldCalculateItemPrice(item, q));
      }
    }
  });

  test("included-quantity bok choy: 1 is free, 2 costs basePriceCents", () => {
    const bokChoy = { id: "bok", basePriceCents: 150, additionalPriceCents: 100, includedQuantity: 1 };
    assert.equal(priceLines([bokChoy], [{ menuItemId: "bok", quantity: 1 }])[0].priceCents, 0);
    assert.equal(priceLines([bokChoy], [{ menuItemId: "bok", quantity: 2 }])[0].priceCents, 150);
    assert.equal(priceLines([bokChoy], [{ menuItemId: "bok", quantity: 3 }])[0].priceCents, 250);
    for (let q = 0; q <= 4; q++) assert.equal(itemPriceCents(bokChoy, q), oldCalculateItemPrice(bokChoy, q));
  });

  test("an unknown item or a bad quantity is rejected", () => {
    assert.throws(() => priceLines(menu, [{ menuItemId: "nope", quantity: 1 }]), { code: "ITEM_UNAVAILABLE" });
    assert.throws(() => priceLines(menu, [{ menuItemId: menu[0].id, quantity: 1.5 }]), { code: "INVALID_QUANTITY" });
    assert.throws(() => priceLines(menu, [{ menuItemId: menu[0].id, quantity: -1 }]), { code: "INVALID_QUANTITY" });
  });
});

describe("taxCents", () => {
  test("rounds half up like Math.round", () => {
    assert.equal(taxCents(1000, 0.0945), 95); // 94.5
    assert.equal(taxCents(1599, 0.0825), 132); // 131.9
    assert.equal(taxCents(0, 0.1), 0);
  });
});

describe("computeTotals (ruling Q2)", () => {
  test("promo and reward lower the taxable base; credits and gift card come after tax", () => {
    const t = computeTotals({
      subtotalCents: 3000,
      rewardCents: 1000,
      promo: { discountType: "FIXED_AMOUNT", discountValue: 500 },
      taxRate: 0.1,
      creditsRequestedCents: 300,
      creditsAvailableCents: 1000,
      giftCardBalanceCents: 100,
    });
    assert.equal(t.taxableCents, 1500);
    assert.equal(t.taxCents, 150);
    assert.equal(t.totalCents, 1650);
    assert.deepEqual(t.discounts, { promoCents: 500, creditsCents: 300, rewardCents: 1000, giftCardCents: 100, mealGiftCents: 0 });
    assert.equal(t.amountDueCents, 1250);
  });

  test("credits are capped at MAX_CREDITS_PER_ORDER_CENTS and at what's available", () => {
    assert.equal(MAX_CREDITS_PER_ORDER_CENTS, 500);
    const capped = computeTotals({ subtotalCents: 3000, creditsRequestedCents: 2000, creditsAvailableCents: 2000 });
    assert.equal(capped.discounts.creditsCents, 500);
    const short = computeTotals({ subtotalCents: 3000, creditsRequestedCents: 500, creditsAvailableCents: 120 });
    assert.equal(short.discounts.creditsCents, 120);
  });

  test("tenders never push the amount due below zero", () => {
    const t = computeTotals({ subtotalCents: 400, taxRate: 0.1, creditsRequestedCents: 500, creditsAvailableCents: 500, mealGiftCents: 900, giftCardBalanceCents: 900 });
    assert.equal(t.totalCents, 440);
    assert.equal(t.discounts.creditsCents, 440);
    assert.equal(t.discounts.mealGiftCents, 0);
    assert.equal(t.discounts.giftCardCents, 0);
    assert.equal(t.amountDueCents, 0);
  });
});

describe("rewardDiscountCents (ruling Q4)", () => {
  const menuById = new Map([
    ["wagyu", { id: "wagyu", categoryType: "MAIN", category: "main01", basePriceCents: 2399 }],
    ["classic", { id: "classic", categoryType: "MAIN", category: "main01", basePriceCents: 1599 }],
    ["noodle", { id: "noodle", categoryType: "MAIN", category: "main02", basePriceCents: 0 }],
    ["marrow", { id: "marrow", categoryType: "ADDON", category: "add-on01", basePriceCents: 399 }],
    ["beef", { id: "beef", categoryType: "ADDON", category: "add-on02", basePriceCents: 599 }],
  ]);

  test("FREE_BOWL takes one unit of the highest-priced MAIN line at its base price", () => {
    const lines = [
      { menuItemId: "classic", quantity: 1, priceCents: 1599 },
      { menuItemId: "wagyu", quantity: 2, priceCents: 4798 },
      { menuItemId: "noodle", quantity: 1, priceCents: 0 },
    ];
    assert.equal(rewardDiscountCents(lines, menuById, "FREE_BOWL"), 2399);
  });

  test("PREMIUM_ADDON takes one unit of the highest-priced ADDON line", () => {
    const lines = [
      { menuItemId: "marrow", quantity: 1, priceCents: 399 },
      { menuItemId: "beef", quantity: 1, priceCents: 599 },
    ];
    assert.equal(rewardDiscountCents(lines, menuById, "PREMIUM_ADDON"), 599);
  });

  test("no qualifying line gives null (REWARD_NOT_APPLICABLE)", () => {
    assert.equal(rewardDiscountCents([{ menuItemId: "noodle", quantity: 1, priceCents: 0 }], menuById, "FREE_BOWL"), null);
    assert.equal(rewardDiscountCents([{ menuItemId: "classic", quantity: 1, priceCents: 1599 }], menuById, "PREMIUM_ADDON"), null);
  });
});
