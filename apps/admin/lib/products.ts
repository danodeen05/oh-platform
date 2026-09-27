import { dollarsToCents } from "../components/ui/Field";

export const CATEGORIES = ["FOOD", "CONDIMENTS", "MERCHANDISE", "APPAREL", "LIMITED_EDITION"] as const;
export type Category = (typeof CATEGORIES)[number];

export type ShopProduct = {
  id: string; slug: string; sku: string | null; name: string; nameZhTW: string | null; nameZhCN: string | null; nameEs: string | null;
  description: string | null; priceCents: number; category: string; imageUrl: string | null;
  isAvailable: boolean; stockCount: number | null; lowStockThreshold: number | null;
};

export type ProductFilter = "ALL" | Category;

export function filterProducts(products: ShopProduct[], filter: ProductFilter): ShopProduct[] {
  return filter === "ALL" ? products : products.filter((p) => p.category === filter);
}

export function stockLabel(count: number | null): string {
  return count == null ? "Unlimited" : String(count);
}

export type ProductForm = {
  slug: string; sku: string; name: string; nameZhTW: string; nameZhCN: string; nameEs: string;
  price: string; category: string; imageUrl: string; stockCount: string; lowStockThreshold: string; description: string;
};

export function emptyProductForm(): ProductForm {
  return { slug: "", sku: "", name: "", nameZhTW: "", nameZhCN: "", nameEs: "", price: "", category: "MERCHANDISE", imageUrl: "", stockCount: "", lowStockThreshold: "", description: "" };
}

export function formFromProduct(p: ShopProduct | null): ProductForm {
  if (!p) return emptyProductForm();
  return {
    slug: p.slug, sku: p.sku ?? "", name: p.name, nameZhTW: p.nameZhTW ?? "", nameZhCN: p.nameZhCN ?? "", nameEs: p.nameEs ?? "",
    price: (p.priceCents / 100).toFixed(2), category: p.category, imageUrl: p.imageUrl ?? "",
    stockCount: p.stockCount != null ? String(p.stockCount) : "", lowStockThreshold: p.lowStockThreshold != null ? String(p.lowStockThreshold) : "",
    description: p.description ?? "",
  };
}

const wholeNumberOrNull = (s: string) => {
  const t = s.trim();
  if (t === "") return null;
  return /^\d+$/.test(t) ? Number(t) : undefined; // undefined marks "invalid"
};

export function validateProduct(f: ProductForm): Partial<Record<keyof ProductForm, string>> {
  const errors: Partial<Record<keyof ProductForm, string>> = {};
  if (!f.slug.trim()) errors.slug = "Give the product a slug.";
  if (!f.name.trim()) errors.name = "Give the product a name.";
  const cents = dollarsToCents(f.price);
  if (cents === null || cents < 0) errors.price = "Enter a price, 0 or more.";
  if (wholeNumberOrNull(f.stockCount) === undefined) errors.stockCount = "Use a whole number, or leave empty for unlimited.";
  if (wholeNumberOrNull(f.lowStockThreshold) === undefined) errors.lowStockThreshold = "Use a whole number.";
  return errors;
}

export type ProductBody = {
  slug: string; sku: string | null; name: string; nameZhTW: string | null; nameZhCN: string | null; nameEs: string | null;
  priceCents: number; category: string; imageUrl: string | null; stockCount: number | null; lowStockThreshold: number | null; description: string | null;
};

/** All fields, in the body shape the API accepts. Create and edit both send every field. */
export function productBody(f: ProductForm): ProductBody {
  return {
    slug: f.slug.trim(), sku: f.sku.trim() || null, name: f.name.trim(),
    nameZhTW: f.nameZhTW.trim() || null, nameZhCN: f.nameZhCN.trim() || null, nameEs: f.nameEs.trim() || null,
    priceCents: dollarsToCents(f.price) ?? 0, category: f.category, imageUrl: f.imageUrl.trim() || null,
    stockCount: wholeNumberOrNull(f.stockCount) ?? null, lowStockThreshold: wholeNumberOrNull(f.lowStockThreshold) ?? null,
    description: f.description.trim() || null,
  };
}
