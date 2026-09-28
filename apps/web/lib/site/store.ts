/**
 * Store and gift-card helpers (Task D10). Pure, so the pages and the unit
 * tests share them.
 *
 * Money rule: every amount the customer pays is the server's. The store
 * shows the bag's item total (product prices) until the API has created and
 * priced the order (POST /shop/orders); from then on shipping, tax, savings
 * and the total are the order's own numbers. Gift cards are the buyer's
 * choice of face value, whole dollars from $10 to $500, and never take a
 * promo code or store credit (the API refuses them: NOT_ALLOWED_FOR_GIFT_CARDS).
 */
import type { ImageKey } from "./images";

export type ShopCategory = "FOOD" | "CONDIMENTS" | "MERCHANDISE" | "APPAREL" | "LIMITED_EDITION";
export const SHOP_CATEGORIES: readonly ShopCategory[] = ["FOOD", "CONDIMENTS", "MERCHANDISE", "APPAREL", "LIMITED_EDITION"];

/** A product as GET /shop/products returns it. */
export interface ShopProductRow {
  id: string;
  slug: string;
  name: string;
  nameZhTW?: string | null;
  nameZhCN?: string | null;
  nameEs?: string | null;
  description?: string | null;
  descriptionZhTW?: string | null;
  descriptionZhCN?: string | null;
  descriptionEs?: string | null;
  priceCents: number;
  category: string;
  imageUrl?: string | null;
  isAvailable: boolean;
  stockCount?: number | null;
  variants?: string | null;
  qrCode?: string | null;
}

/** Where a product's photo comes from: the site's photography, or a file under /public/store. */
export type ProductImage = { kind: "site"; key: ImageKey } | { kind: "file"; src: string };

/** The product photos, matched by slug (C6: the bowl and the chopsticks use the new photography). */
const PRODUCT_IMAGES: Record<string, ProductImage> = {
  "ceramic-noodle-bowl": { kind: "site", key: "bowl-empty" },
  "bamboo-chopsticks": { kind: "site", key: "chopsticks" },
  "home-kit": { kind: "file", src: "/store/HomeKit.png" },
  "beef-bone-broth": { kind: "file", src: "/store/BeefBoneBrothConcentrate.png" },
  "chili-oil": { kind: "file", src: "/store/SignatureChiliOil.png" },
  "chef-apron": { kind: "file", src: "/store/ChefsApron.png" },
  "classic-tshirt": { kind: "file", src: "/store/T-Shirt.png" },
  "comfort-hoodie": { kind: "file", src: "/store/ComfortHoodie.png" },
  "artisan-wooden-bowl": { kind: "file", src: "/store/ArtisanWoodenSoupBowl.png" },
};

/** The files that exist under /public/store (a product's own imageUrl is used only when it is one of them). */
const STORE_FILES = new Set(Object.values(PRODUCT_IMAGES).flatMap((i) => (i.kind === "file" ? [i.src] : [])).concat("/store/CeramicBowl.png", "/store/Chopsticks.png"));

/** The fallback photo (this replaces the old /store/placeholder.png). */
export const PRODUCT_FALLBACK_IMAGE: ProductImage = { kind: "site", key: "bowl-flatlay" };

export function productImage(product: Pick<ShopProductRow, "slug" | "imageUrl">): ProductImage {
  const bySlug = PRODUCT_IMAGES[product.slug];
  if (bySlug) return bySlug;
  const url = product.imageUrl || "";
  if (STORE_FILES.has(url)) return { kind: "file", src: url };
  return PRODUCT_FALLBACK_IMAGE;
}

type Localizable = { name?: string | null; nameZhTW?: string | null; nameZhCN?: string | null; nameEs?: string | null; description?: string | null; descriptionZhTW?: string | null; descriptionZhCN?: string | null; descriptionEs?: string | null };

/** The product's name and description in the visitor's language (the English row is the fallback). */
export function localizeProduct(p: Localizable, locale: string): { name: string; description: string } {
  const pick = (base: string | null | undefined, zhTW?: string | null, zhCN?: string | null, es?: string | null) => {
    if (locale === "zh-TW" && zhTW) return zhTW;
    if (locale === "zh-CN" && zhCN) return zhCN;
    if (locale === "es" && es) return es;
    return base || "";
  };
  return {
    name: pick(p.name, p.nameZhTW, p.nameZhCN, p.nameEs),
    description: pick(p.description, p.descriptionZhTW, p.descriptionZhCN, p.descriptionEs),
  };
}

/** The sizes a product comes in (apparel), from its `variants` JSON. Sold-out sizes are marked. */
export function productSizes(variants: string | null | undefined): { size: string; soldOut: boolean }[] {
  if (!variants) return [];
  try {
    const parsed = JSON.parse(variants);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v) => v && typeof v.size === "string" && v.size.trim())
      .map((v) => ({ size: String(v.size).trim(), soldOut: typeof v.stock === "number" && v.stock <= 0 }));
  } catch {
    return [];
  }
}

export function categoryKey(category: string): ShopCategory | null {
  return (SHOP_CATEGORIES as readonly string[]).includes(category) ? (category as ShopCategory) : null;
}

/** The API's per-line limit (packages/api/src/shop/service.js MAX_SHOP_QUANTITY). */
export const MAX_LINE_QUANTITY = 20;

/** How many of a product the bag may still take: the per-line limit, or the stock when it is lower. */
export function maxQuantity(stockCount: number | null | undefined): number {
  if (typeof stockCount === "number") return Math.max(0, Math.min(MAX_LINE_QUANTITY, stockCount));
  return MAX_LINE_QUANTITY;
}

/** "Only a few left" below this stock. */
export const LOW_STOCK = 10;

/** The free-shipping line the API applies (shop/service.js SHOP_FREE_SHIPPING_MIN_CENTS). Shown as a hint only. */
export const FREE_SHIPPING_MIN_CENTS = 7500;

/**
 * Refusals the store checkout explains (store.errors.<CODE>); anything else
 * is GENERIC. The three confirm-time 409s (CREDIT_SHORT, GIFT_CARD_CHANGED,
 * OUT_OF_STOCK after payment) come back with the charge refunded in full.
 */
export const STORE_ERROR_CODES = [
  "CREDIT_SHORT",
  "GIFT_CARD_CHANGED",
  "OUT_OF_STOCK",
  "ORDER_CHANGED",
  "ORDER_NOT_PENDING",
  "PAYMENT_REFUNDED",
  "GIFT_CARD_INVALID",
  "PRODUCT_NOT_FOUND",
  "PRODUCT_UNAVAILABLE",
  "INVALID_QUANTITY",
  "ITEMS_REQUIRED",
  "TOO_MANY_ITEMS",
  "AMOUNT_BELOW_MINIMUM",
  "SIGN_IN_REQUIRED",
  "PAYMENTS_UNAVAILABLE",
  "PAYMENT_NOT_VERIFIED",
  "LEGACY_ORDER",
  "FORBIDDEN",
  "NETWORK_ERROR",
  "RATE_LIMITED",
  "GENERIC",
] as const;
export type StoreErrorCode = (typeof STORE_ERROR_CODES)[number];

/**
 * Confirm-time refusals that mean "the order changed under the payment; you
 * were not charged": the page drops the order and the next tap re-creates it
 * from the bag, so the server prices it again with what is left.
 */
export const RECREATE_CODES: readonly StoreErrorCode[] = ["CREDIT_SHORT", "GIFT_CARD_CHANGED", "OUT_OF_STOCK", "ORDER_CHANGED", "ORDER_NOT_PENDING", "PAYMENT_REFUNDED", "LEGACY_ORDER"];

export function storeErrorCode(code: string | null | undefined, status?: number): StoreErrorCode {
  if (code && (STORE_ERROR_CODES as readonly string[]).includes(code)) return code as StoreErrorCode;
  if (status === 0) return "NETWORK_ERROR";
  if (status === 401) return "SIGN_IN_REQUIRED";
  if (status === 402) return "PAYMENT_NOT_VERIFIED";
  if (status === 403) return "FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  return "GENERIC";
}

// ---------------------------------------------------------------- gift cards

/** Face value limits, whole dollars (orders/tenders.js GIFT_CARD_MIN_CENTS / MAX). */
export const GIFT_MIN_DOLLARS = 10;
export const GIFT_MAX_DOLLARS = 500;
export const GIFT_PRESETS = [25, 50, 75, 100] as const;

/** The card faces (the photo is always bowl-flatlay; the face tints it). */
export const GIFT_DESIGNS = ["classic", "dark", "gold"] as const;
export type GiftDesign = (typeof GIFT_DESIGNS)[number];

export function giftDesign(id: string | null | undefined): GiftDesign {
  return (GIFT_DESIGNS as readonly string[]).includes(id || "") ? (id as GiftDesign) : "classic";
}

/** A typed amount as whole dollars, or null when it isn't one (no cents, no symbols). */
export function parseGiftDollars(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  return Number(s);
}

export function giftAmountValid(dollars: number | null): dollars is number {
  return dollars !== null && Number.isInteger(dollars) && dollars >= GIFT_MIN_DOLLARS && dollars <= GIFT_MAX_DOLLARS;
}

/** "abcd efgh..." -> "ABCD-EFGH-..." (16 characters in groups of 4, as the cards are printed). */
export function formatGiftCode(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  return (cleaned.match(/.{1,4}/g) || []).join("-");
}

export function giftCodeComplete(code: string): boolean {
  return code.replace(/[^A-Z0-9]/gi, "").length === 16;
}

/** Gift-card purchase refusals (giftCards.errors.<CODE>). */
export const GIFT_ERROR_CODES = ["AMOUNT_TOO_LOW", "AMOUNT_TOO_HIGH", "INVALID_AMOUNT", "NOT_ALLOWED_FOR_GIFT_CARDS", "PAYMENT_REQUIRED", "PAYMENT_ALREADY_USED", "PAYMENT_NOT_VERIFIED", "NETWORK_ERROR", "RATE_LIMITED", "GENERIC"] as const;
export type GiftErrorCode = (typeof GIFT_ERROR_CODES)[number];

export function giftErrorCode(code: string | null | undefined, status?: number): GiftErrorCode {
  if (code && (GIFT_ERROR_CODES as readonly string[]).includes(code)) return code as GiftErrorCode;
  if (status === 0) return "NETWORK_ERROR";
  if (status === 402) return "PAYMENT_NOT_VERIFIED";
  if (status === 429) return "RATE_LIMITED";
  return "GENERIC";
}
