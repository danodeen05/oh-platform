import { expect, test } from "vitest";
import { emptyProductForm, filterProducts, formFromProduct, productBody, stockLabel, validateProduct } from "../products";

const product = {
  id: "1", slug: "home-kit", sku: "HK-1", name: "Home Kit", nameZhTW: null, nameZhCN: null, nameEs: null,
  description: "desc", priceCents: 3499, category: "FOOD", imageUrl: null, isAvailable: true, stockCount: 5, lowStockThreshold: 2,
};

test("filterProducts: ALL returns everything, else matches category", () => {
  const list = [product, { ...product, id: "2", category: "APPAREL" }];
  expect(filterProducts(list, "ALL")).toHaveLength(2);
  expect(filterProducts(list, "APPAREL")).toHaveLength(1);
});

test("stockLabel: null is Unlimited", () => {
  expect(stockLabel(null)).toBe("Unlimited");
  expect(stockLabel(0)).toBe("0");
  expect(stockLabel(5)).toBe("5");
});

test("emptyProductForm defaults to MERCHANDISE", () => {
  expect(emptyProductForm().category).toBe("MERCHANDISE");
});

test("formFromProduct: cents become a dollars string, nulls become empty strings", () => {
  const f = formFromProduct(product as never);
  expect(f.price).toBe("34.99");
  expect(f.stockCount).toBe("5");
  expect(f.lowStockThreshold).toBe("2");
  expect(f.sku).toBe("HK-1");
  const f2 = formFromProduct({ ...product, stockCount: null, lowStockThreshold: null, sku: null } as never);
  expect(f2.stockCount).toBe("");
  expect(f2.lowStockThreshold).toBe("");
  expect(f2.sku).toBe("");
});

test("validateProduct: requires slug, name and a non-negative price", () => {
  const f = { ...emptyProductForm(), slug: "x", name: "X", price: "10" };
  expect(validateProduct(f)).toEqual({});
  expect(validateProduct({ ...f, slug: "" }).slug).toBeTruthy();
  expect(validateProduct({ ...f, name: "" }).name).toBeTruthy();
  expect(validateProduct({ ...f, price: "" }).price).toBeTruthy();
  expect(validateProduct({ ...f, price: "-1" }).price).toBeTruthy();
  expect(validateProduct({ ...f, price: "0" }).price).toBeUndefined();
});

test("validateProduct: stock and threshold must be whole numbers when present", () => {
  const f = { ...emptyProductForm(), slug: "x", name: "X", price: "10" };
  expect(validateProduct({ ...f, stockCount: "" }).stockCount).toBeUndefined();
  expect(validateProduct({ ...f, stockCount: "5" }).stockCount).toBeUndefined();
  expect(validateProduct({ ...f, stockCount: "5.5" }).stockCount).toBeTruthy();
  expect(validateProduct({ ...f, lowStockThreshold: "abc" }).lowStockThreshold).toBeTruthy();
});

test("productBody: sends all fields, empty stock means unlimited (null)", () => {
  const f = { ...emptyProductForm(), slug: "  home-kit  ", name: " Home Kit ", price: "34.99", stockCount: "", lowStockThreshold: "2" };
  const b = productBody(f);
  expect(b.slug).toBe("home-kit");
  expect(b.name).toBe("Home Kit");
  expect(b.priceCents).toBe(3499);
  expect(b.stockCount).toBeNull();
  expect(b.lowStockThreshold).toBe(2);
  expect(b.category).toBe("MERCHANDISE");
});
