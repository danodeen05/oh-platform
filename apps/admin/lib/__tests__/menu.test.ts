import { expect, test } from "vitest";
import { filterMenu, groupMenu, parseCents, type MenuItem } from "../menu";

test("groups by category, sorts by displayOrder then name, uncategorised last", () => {
  const g = groupMenu([
    { id: "1", name: "B", category: "main01", displayOrder: 2 },
    { id: "2", name: "A", category: "main01", displayOrder: 2 },
    { id: "3", name: "Z", category: null, displayOrder: 0 },
    { id: "4", name: "C", category: "addon01", displayOrder: 1 },
  ] as never);
  expect(g.map((x) => x.category)).toEqual(["addon01", "main01", ""]);
  expect(g[1].items.map((i) => i.id)).toEqual(["2", "1"]);
  expect(g[2].label).toBe("No category");
});

test("parseCents accepts dollars", () => {
  expect(parseCents("18.99")).toBe(1899);
  expect(parseCents("0")).toBe(0);
  expect(parseCents("")).toBeNull();
  expect(parseCents("abc")).toBeNull();
  expect(parseCents("-1")).toBeNull();
});

const item = (over: Partial<MenuItem>): MenuItem => ({
  id: "x", name: "X", category: null, categoryType: null, selectionMode: "MULTIPLE", displayOrder: 0, description: null,
  basePriceCents: 0, additionalPriceCents: 0, includedQuantity: 0, isAvailable: true, tenantId: "t", ...over,
});

test("filterMenu matches name or category, ignoring case, and can show sold out only", () => {
  const items = [
    item({ id: "1", name: "Wagyu Noodle Soup", category: "main01" }),
    item({ id: "2", name: "Bok Choy", category: "side01", isAvailable: false }),
    item({ id: "3", name: "Iced Tea", category: "drink01" }),
  ];
  expect(filterMenu(items, "  wagyu ", "all").map((i) => i.id)).toEqual(["1"]);
  expect(filterMenu(items, "SIDE", "all").map((i) => i.id)).toEqual(["2"]);
  expect(filterMenu(items, "", "soldOut").map((i) => i.id)).toEqual(["2"]);
  expect(filterMenu(items, "tea", "soldOut")).toEqual([]);
});

test("a new item form has the old defaults", async () => {
  const { formFromItem } = await import("../menu");
  expect(formFromItem(null, "t-oh")).toMatchObject({ selectionMode: "MULTIPLE", displayOrder: "0", extra: "0.00", included: "0", isAvailable: true, tenantId: "t-oh", categoryType: "" });
});

test("readMenuForm turns dollars into cents and blanks into nulls", async () => {
  const { formFromItem, readMenuForm } = await import("../menu");
  const f = { ...formFromItem(null, "t1"), name: " Bok Choy ", base: "$0", extra: "1", included: "1", category: "", description: " " };
  expect(readMenuForm(f)).toEqual({ errors: {}, body: {
    name: "Bok Choy", category: null, categoryType: null, selectionMode: "MULTIPLE", displayOrder: 0, description: null,
    basePriceCents: 0, additionalPriceCents: 100, includedQuantity: 1, isAvailable: true, tenantId: "t1",
  } });
});

test("readMenuForm reports every problem inline and sends nothing", async () => {
  const { formFromItem, readMenuForm } = await import("../menu");
  const out = readMenuForm({ ...formFromItem(null, ""), name: " ", base: "", extra: "abc", included: "1.5", displayOrder: "x" });
  expect(out.body).toBeNull();
  expect(Object.keys(out.errors).sort()).toEqual(["base", "displayOrder", "extra", "included", "name", "tenantId"]);
});

test("an edited item round-trips through the form unchanged", async () => {
  const { formFromItem, readMenuForm } = await import("../menu");
  const it = item({ name: "Wagyu", category: "main01", categoryType: "MAIN", selectionMode: "SINGLE", displayOrder: 1, basePriceCents: 2399, additionalPriceCents: 150, includedQuantity: 2, isAvailable: false, tenantId: "t" });
  expect(readMenuForm(formFromItem(it, "other")).body).toMatchObject({ name: "Wagyu", category: "main01", categoryType: "MAIN", selectionMode: "SINGLE", displayOrder: 1, basePriceCents: 2399, additionalPriceCents: 150, includedQuantity: 2, isAvailable: false, tenantId: "t" });
});
