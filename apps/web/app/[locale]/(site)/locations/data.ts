/**
 * Server-side fetch for the location pages (Task D4): the public
 * `GET /locations?locale=`, already localized by the API (name, address and
 * landmarks from `Location.i18n`), reduced to our two locations.
 * `failed` means the API didn't answer, which is not the same as "no such
 * location".
 */
import { API_URL } from "@/lib/api";
import { serverApiHeaders } from "@/lib/server/api-headers";
import { siteLocations, type ApiLocation, type SiteLocation } from "@/lib/site/locations";

export async function getSiteLocations(locale: string): Promise<{ locations: SiteLocation[]; failed: boolean }> {
  try {
    const res = await fetch(`${API_URL}/locations?locale=${encodeURIComponent(locale)}`, {
      cache: "no-store",
      headers: serverApiHeaders({ "x-tenant-slug": "oh" }),
    });
    if (!res.ok) return { locations: [], failed: true };
    const rows: ApiLocation[] = await res.json();
    return { locations: siteLocations(Array.isArray(rows) ? rows : [], locale), failed: false };
  } catch {
    return { locations: [], failed: true };
  }
}
