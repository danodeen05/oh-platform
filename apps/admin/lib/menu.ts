export type SelectionMode = "SINGLE" | "MULTIPLE" | "SLIDER" | "INCLUDED";
export type MenuItem = {
  id: string; name: string; category: string | null; categoryType: string | null; selectionMode: SelectionMode;
  displayOrder: number; description: string | null; basePriceCents: number; additionalPriceCents: number; includedQuantity: number;
  isAvailable: boolean; tenantId: string;
};
export type Tenant = { id: string; slug: string; brandName: string };

export const CATEGORY_TYPES = ["MAIN", "SLIDER", "ADDON", "SIDE", "DRINK", "DESSERT"] as const;
export const SELECTION_MODES: { value: SelectionMode; label: string }[] = [
  { value: "SINGLE", label: "Single" },
  { value: "MULTIPLE", label: "Multiple" },
  { value: "SLIDER", label: "Slider" },
];

export function groupMenu(items: MenuItem[]) {
  const by = new Map<string, MenuItem[]>();
  for (const i of items) { const k = i.category || ""; by.set(k, [...(by.get(k) || []), i]); }
  return [...by.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([category, list]) => ({
      category, label: category || "No category",
      items: list.sort((x, y) => x.displayOrder - y.displayOrder || x.name.localeCompare(y.name)),
    }));
}

export function parseCents(input: string): number | null {
  if (!input.trim()) return null;
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export type MenuFilter = "all" | "soldOut";

/** Client-side search over name and category, plus the Sold out chip. */
export function filterMenu(items: MenuItem[], query: string, filter: MenuFilter): MenuItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => (filter === "all" || !i.isAvailable)
    && (!q || i.name.toLowerCase().includes(q) || (i.category ?? "").toLowerCase().includes(q)));
}

/** The edit sheet's fields as typed. Money is kept as the dollars text. */
export type MenuForm = {
  name: string; category: string; categoryType: string; selectionMode: SelectionMode; displayOrder: string; description: string;
  base: string; extra: string; included: string; isAvailable: boolean; tenantId: string;
};
export type MenuBody = {
  name: string; category: string | null; categoryType: string | null; selectionMode: SelectionMode; displayOrder: number;
  description: string | null; basePriceCents: number; additionalPriceCents: number; includedQuantity: number; isAvailable: boolean; tenantId: string;
};

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function formFromItem(item: MenuItem | null, defaultTenantId: string): MenuForm {
  if (!item) {
    return { name: "", category: "", categoryType: "", selectionMode: "MULTIPLE", displayOrder: "0", description: "",
      base: "", extra: "0.00", included: "0", isAvailable: true, tenantId: defaultTenantId };
  }
  return {
    name: item.name, category: item.category ?? "", categoryType: item.categoryType ?? "", selectionMode: item.selectionMode,
    displayOrder: String(item.displayOrder ?? 0), description: item.description ?? "",
    base: dollars(item.basePriceCents), extra: dollars(item.additionalPriceCents), included: String(item.includedQuantity ?? 0),
    isAvailable: item.isAvailable, tenantId: item.tenantId,
  };
}

const wholeNumber = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);
const cleanMoney = (s: string) => s.replace(/[$,\s]/g, "");

/** Validates the sheet. Errors are for inline display; body is null when any exist. */
export function readMenuForm(f: MenuForm): { errors: Partial<Record<keyof MenuForm, string>>; body: MenuBody | null } {
  const errors: Partial<Record<keyof MenuForm, string>> = {};
  const base = parseCents(cleanMoney(f.base));
  const extra = cleanMoney(f.extra) === "" ? 0 : parseCents(cleanMoney(f.extra));
  const included = f.included.trim() === "" ? 0 : wholeNumber(f.included);
  const order = f.displayOrder.trim() === "" ? 0 : wholeNumber(f.displayOrder);
  if (!f.name.trim()) errors.name = "Give the item a name.";
  if (base === null) errors.base = "Enter a price, like 12.50.";
  if (extra === null) errors.extra = "Enter a price, or 0.";
  if (included === null) errors.included = "Use a whole number.";
  if (order === null) errors.displayOrder = "Use a whole number.";
  if (!f.tenantId) errors.tenantId = "Choose a brand.";
  if (Object.keys(errors).length) return { errors, body: null };
  return {
    errors,
    body: {
      name: f.name.trim(), category: f.category.trim() || null, categoryType: f.categoryType || null, selectionMode: f.selectionMode,
      displayOrder: order!, description: f.description.trim() || null, basePriceCents: base!, additionalPriceCents: extra!,
      includedQuantity: included!, isAvailable: f.isAvailable, tenantId: f.tenantId,
    },
  };
}

/** The PATCH body for an edit: every field except the brand, which only a create sets. */
export function editBody(body: MenuBody): Omit<MenuBody, "tenantId"> {
  const { tenantId: _omit, ...rest } = body;
  void _omit;
  return rest;
}
