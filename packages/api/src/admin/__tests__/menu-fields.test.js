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

test("menu patch: money, counts and ordering must be non-negative whole numbers", () => {
  for (const k of ["basePriceCents", "additionalPriceCents", "includedQuantity", "displayOrder", "spiceLevel"]) {
    for (const bad of [-1, 1.5, "100", null, NaN]) {
      const out = menuPatchData({ [k]: bad });
      assert.match(out.error || "", new RegExp(`^${k} must be a whole number of 0 or more$`), `${k}=${String(bad)}`);
    }
    assert.deepEqual(menuPatchData({ [k]: 0 }), { data: { [k]: 0 } });
  }
  assert.match(menuPatchData({ priceCents: -5 }).error, /basePriceCents/);
});

test("menu patch: name must be a non-empty string when sent", () => {
  for (const bad of ["", "   ", 5, null]) assert.equal(menuPatchData({ name: bad }).error, "name must be a non-empty string");
  assert.deepEqual(menuPatchData({ name: "Bok choy" }), { data: { name: "Bok choy" } });
});
