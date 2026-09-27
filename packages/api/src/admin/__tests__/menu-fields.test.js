import { test } from "node:test";
import assert from "node:assert/strict";
import { menuPatchData } from "../menu-fields.js";

test("menu patch: keeps the legacy fields and adds availability and layout fields", () => {
  const out = menuPatchData({
    name: "Bok choy", category: "side01", description: null, basePriceCents: 0, additionalPriceCents: 100, includedQuantity: 1,
    isAvailable: false, categoryType: "SIDE", selectionMode: "MULTIPLE", displayOrder: 3,
  });
  assert.deepEqual(out, { data: {
    name: "Bok choy", category: "side01", description: null, basePriceCents: 0, additionalPriceCents: 100, includedQuantity: 1,
    isAvailable: false, categoryType: "SIDE", selectionMode: "MULTIPLE", displayOrder: 3,
  } });
});

test("menu patch: a sold-out flip alone is a valid patch", () => {
  assert.deepEqual(menuPatchData({ isAvailable: true }), { data: { isAvailable: true } });
});

test("menu patch: legacy priceCents still maps to basePriceCents", () => {
  assert.deepEqual(menuPatchData({ priceCents: 1299 }), { data: { basePriceCents: 1299 } });
});

test("menu patch: empty categoryType clears it", () => {
  assert.deepEqual(menuPatchData({ categoryType: "" }), { data: { categoryType: null } });
});

test("menu patch: rejects bad values instead of writing them", () => {
  assert.ok(menuPatchData({ isAvailable: "no" }).error);
  assert.ok(menuPatchData({ categoryType: "SOUP" }).error);
  assert.ok(menuPatchData({ selectionMode: "MANY" }).error);
  assert.ok(menuPatchData({ displayOrder: 1.5 }).error);
  assert.ok(menuPatchData({}).error);
  assert.ok(menuPatchData(null).error);
});

test("menu patch: tenantId is create-only and is rejected, never written", () => {
  const out = menuPatchData({ name: "Bok choy", tenantId: "other-tenant" });
  assert.ok(out.error);
  assert.equal(out.data, undefined);
});
