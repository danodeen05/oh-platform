/**
 * Validates a PATCH /menu/:id body. Before 2026-09-27 the route dropped
 * isAvailable, categoryType, selectionMode and displayOrder silently, so the
 * console's sold-out switch and edit sheet had nothing to write to.
 */
const CATEGORY_TYPES = ["MAIN", "SLIDER", "ADDON", "SIDE", "DRINK", "DESSERT"];
const SELECTION_MODES = ["SINGLE", "MULTIPLE", "SLIDER", "INCLUDED"];
// tenantId is create-only: a PATCH must never move an item to another brand.
const PASS_THROUGH = ["category", "description"];
// Money, counts and ordering: whole numbers, never negative.
const NON_NEGATIVE_INTS = ["basePriceCents", "additionalPriceCents", "includedQuantity", "displayOrder", "spiceLevel"];

export function menuPatchData(body) {
  const b = body && typeof body === "object" ? body : {};
  if (b.tenantId !== undefined) return { error: "tenantId can't be changed" };
  const data = {};
  for (const k of PASS_THROUGH) if (b[k] !== undefined) data[k] = b[k];
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim()) return { error: "name must be a non-empty string" };
    data.name = b.name;
  }
  const ints = { ...b };
  if (ints.basePriceCents === undefined && ints.priceCents !== undefined) ints.basePriceCents = ints.priceCents; // legacy
  for (const k of NON_NEGATIVE_INTS) {
    if (ints[k] === undefined) continue;
    if (!Number.isInteger(ints[k]) || ints[k] < 0) return { error: `${k} must be a whole number of 0 or more` };
    data[k] = ints[k];
  }

  if (b.isAvailable !== undefined) {
    if (typeof b.isAvailable !== "boolean") return { error: "isAvailable must be true or false" };
    data.isAvailable = b.isAvailable;
  }
  if (b.categoryType !== undefined) {
    const v = b.categoryType === "" ? null : b.categoryType;
    if (v !== null && !CATEGORY_TYPES.includes(v)) return { error: "Unknown categoryType" };
    data.categoryType = v;
  }
  if (b.selectionMode !== undefined) {
    if (!SELECTION_MODES.includes(b.selectionMode)) return { error: "Unknown selectionMode" };
    data.selectionMode = b.selectionMode;
  }
  if (!Object.keys(data).length) return { error: "At least one field required" };
  return { data };
}
