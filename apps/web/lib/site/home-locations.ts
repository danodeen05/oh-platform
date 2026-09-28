/**
 * Task D1: the two restaurants the home story talks about, read on the
 * server from `GET /locations` (revalidated every 5 minutes) and slimmed to
 * what the page needs: the id the live pill polls, the slug its link uses,
 * coordinates for "nearer to you", the street address for directions, and
 * the opening hours when the location has them set.
 *
 * Names and neighborhoods come from messages (`home.locations.cards.*`),
 * keyed by slug: they are copy, translated in all four locales. Fails soft:
 * if the API is down, each card still renders with its link and no live
 * numbers.
 */

const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const HOME_LOCATIONS = [
  // `mapsQuery` is only the directions link's fallback when the API is unreachable.
  { slug: "city-creek", msg: "cityCreek", mapsQuery: "City Creek Center, Salt Lake City, UT" },
  { slug: "university-place", msg: "universityPlace", mapsQuery: "University Place, Orem, UT" },
] as const;

export type HomeLocationSlug = (typeof HOME_LOCATIONS)[number]["slug"];

export interface HomeLocation {
  slug: HomeLocationSlug;
  /** `home.locations.cards.<msg>` */
  msg: (typeof HOME_LOCATIONS)[number]["msg"];
  id: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  /** Where the directions link points: the street address, else the fallback query. */
  directionsTo: string;
  operatingHours: unknown;
  timeZone: string;
}

interface LocationRow {
  id?: unknown;
  slug?: unknown;
  lat?: unknown;
  lng?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  operatingHours?: unknown;
  timezone?: unknown;
}

/** A Google Maps directions link (opens the maps app on phones). */
export function directionsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pure: the API rows mapped onto the two home locations (exported for tests). */
export function toHomeLocations(rows: unknown): HomeLocation[] {
  const list = Array.isArray(rows) ? (rows as LocationRow[]) : [];
  return HOME_LOCATIONS.map(({ slug, msg, mapsQuery }) => {
    const row = list.find((r) => r && r.slug === slug);
    const address = row && typeof row.address === "string" && row.address.trim() ? row.address.trim() : null;
    return {
      slug,
      msg,
      id: row && typeof row.id === "string" ? row.id : null,
      lat: row ? num(row.lat) : null,
      lng: row ? num(row.lng) : null,
      address,
      directionsTo: address ?? mapsQuery,
      operatingHours: row?.operatingHours ?? null,
      timeZone: row && typeof row.timezone === "string" ? row.timezone : "America/Denver",
    };
  });
}

export async function getHomeLocations(): Promise<HomeLocation[]> {
  try {
    const res = await fetch(`${API}/locations`, { headers: { "x-tenant-slug": "oh" }, next: { revalidate: 300 } });
    return toHomeLocations(res.ok ? await res.json() : []);
  } catch {
    return toHomeLocations([]);
  }
}
