/**
 * Server-side reads for the store pages (Task D10). Read-only, public
 * catalog data; the store's money always comes from the API's order.
 */
import { API_URL } from "@/lib/api";
import { serverApiHeaders } from "@/lib/server/api-headers";
import type { ShopProductRow } from "./store";

/** Available products, or null when the API couldn't be reached (the page says so and offers a retry). */
export async function getShopProducts(): Promise<ShopProductRow[] | null> {
  try {
    const res = await fetch(`${API_URL}/shop/products`, { cache: "no-store", headers: serverApiHeaders() });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? (body as ShopProductRow[]).filter((p) => p.isAvailable) : null;
  } catch {
    return null;
  }
}

/** The product behind a shelf tag's QR code: the row, "missing", or null when the API couldn't be reached. */
export async function getProductByQr(qrCode: string): Promise<ShopProductRow | "missing" | null> {
  try {
    const res = await fetch(`${API_URL}/shop/products/qr/${encodeURIComponent(qrCode)}`, { cache: "no-store", headers: serverApiHeaders() });
    if (res.status === 404 || res.status === 400) return "missing";
    if (!res.ok) return null;
    return (await res.json()) as ShopProductRow;
  } catch {
    return null;
  }
}
