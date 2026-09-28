/**
 * Order, step 1: where are you eating (Task D5). Server-rendered list of
 * locations (localized from the API's `i18n`) and the dine-in switch; the
 * cards and the group row are the client LocationSelector.
 */
import { getLocale } from "next-intl/server";
import { API_URL } from "@/lib/api";
import LocationSelector, { type LocationCard } from "./location-selector";

export const dynamic = "force-dynamic";

type ApiLocation = {
  id: string;
  name: string;
  city?: string | null;
  landmarks?: string | null;
  layoutKey?: string | null;
  isClosed?: boolean;
  availability?: { isOpen?: boolean; canOrder?: boolean } | null;
  i18n?: Record<string, { name?: string; landmarks?: string; address?: string }> | null;
  address?: string | null;
};

async function getLocations(): Promise<ApiLocation[]> {
  try {
    const res = await fetch(`${API_URL}/locations`, { cache: "no-store", headers: { "x-tenant-slug": "oh" } });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

/** The owner's "Order Now" switch (Tenant.dineInOrdersEnabled). Unknown counts as on; POST /orders enforces it anyway. */
async function dineInEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/catering/site-config/order-now`, { cache: "no-store", headers: { "x-tenant-slug": "oh" } });
    if (!res.ok) return true;
    const body = await res.json();
    return body?.enabled !== false;
  } catch {
    return true;
  }
}

export default async function OrderPage() {
  const locale = await getLocale();
  const [locations, enabled] = await Promise.all([getLocations(), dineInEnabled()]);
  const cards: LocationCard[] = locations.map((l, i) => {
    const loc = l.i18n?.[locale] || l.i18n?.en || {};
    return {
      id: l.id,
      name: loc.name || l.name,
      landmarks: loc.landmarks || l.landmarks || null,
      address: loc.address || l.address || null,
      open: !l.isClosed && l.availability?.isOpen !== false,
      canOrder: !l.isClosed && l.availability?.canOrder !== false,
      image: i % 2 === 0 ? "storefront-dusk" : "storefront-queue",
    };
  });
  return <LocationSelector locations={cards} dineInEnabled={enabled} />;
}
