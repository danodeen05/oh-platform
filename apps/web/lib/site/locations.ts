/**
 * The location pages' data (Task D4): the public `GET /locations?locale=`
 * row, reduced to what /locations and /locations/[slug] draw. Pure, so the
 * pages stay server components and the rules are unit tested.
 *
 * Two rules the owner cares about:
 * - Open or closed shows only when the API says the hours are real
 *   (`availability.hoursBypassed === false` and a boolean `openNow`). Under
 *   the testing bypass, or on an API from before those fields, it is hidden.
 * - Hours are exactly the API's `hours.week`. No API hours, no hours shown.
 */
import type { ImageKey } from "./images";
import type { CombLayoutKey } from "@/components/site/floor-plan/useSeats";

export const LOCATION_SLUGS = ["city-creek", "university-place"] as const;
export type LocationSlug = (typeof LOCATION_SLUGS)[number];

/** The photo that leads each location (the card and the detail hero). */
const HERO: Record<LocationSlug, ImageKey> = {
  "city-creek": "sign-pool",
  "university-place": "storefront-queue",
};

/** The comb layout each location seats: the fallback when its row has no `layoutKey`. */
const LAYOUT: Record<LocationSlug, CombLayoutKey> = {
  "city-creek": "comb-75",
  "university-place": "comb-70-mirrored",
};

/** The messages key under `locations.places` for each location's own copy. */
export const PLACE_KEY: Record<LocationSlug, "cityCreek" | "universityPlace"> = {
  "city-creek": "cityCreek",
  "university-place": "universityPlace",
};

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ApiHours {
  timezone?: string;
  today?: string;
  week?: { day: string; open: string | null; close: string | null }[];
}

export interface ApiAvailability {
  isOpen?: boolean;
  openNow?: boolean;
  hoursBypassed?: boolean;
  canOrder?: boolean;
}

export interface ApiLocation {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  layoutKey?: string | null;
  landmarks?: string | null;
  stats?: { availableSeats?: number; totalSeats?: number; avgWaitMinutes?: number } | null;
  availability?: ApiAvailability | null;
  hours?: ApiHours | null;
  i18n?: Record<string, { name?: string; address?: string; landmarks?: string }> | null;
}

export interface SiteLocation {
  id: string;
  slug: LocationSlug;
  name: string;
  address: string | null;
  landmarks: string | null;
  layoutKey: CombLayoutKey;
  podsFree: number | null;
  podsTotal: number | null;
  /** null: don't say (the hours bypass is on, or the API didn't say). */
  open: "open" | "closed" | null;
  canOrder: boolean;
  hero: ImageKey;
  hours: ApiHours | null;
}

export function isLocationSlug(s: string): s is LocationSlug {
  return (LOCATION_SLUGS as readonly string[]).includes(s);
}

export function heroFor(slug: LocationSlug): ImageKey {
  return HERO[slug];
}

export function openState(a: ApiAvailability | null | undefined): "open" | "closed" | null {
  if (!a || a.hoursBypassed !== false || typeof a.openNow !== "boolean") return null;
  return a.openNow ? "open" : "closed";
}

const LAYOUT_KEYS = new Set<string>(["comb-75", "comb-70-mirrored"]);

/** The API row (already localized by `?locale=`) to the page model; null for anything but our two locations. */
export function toSiteLocation(l: ApiLocation, locale = "en"): SiteLocation | null {
  const slug = l.slug ?? "";
  if (!isLocationSlug(slug)) return null;
  const free = l.stats?.availableSeats;
  const total = l.stats?.totalSeats;
  return {
    id: l.id,
    slug,
    name: l.name,
    address: l.address ?? null,
    // English has no column of its own: the API only localizes non-English, so fall back to i18n.
    landmarks: l.landmarks ?? l.i18n?.[locale]?.landmarks ?? l.i18n?.en?.landmarks ?? null,
    layoutKey: l.layoutKey && LAYOUT_KEYS.has(l.layoutKey) ? (l.layoutKey as CombLayoutKey) : LAYOUT[slug],
    podsFree: typeof free === "number" && typeof total === "number" && total > 0 ? free : null,
    podsTotal: typeof total === "number" && total > 0 ? total : null,
    open: openState(l.availability),
    canOrder: l.availability?.canOrder !== false,
    hero: HERO[slug],
    hours: l.hours ?? null,
  };
}

/** Our locations in page order (City Creek, then University Place). */
export function siteLocations(rows: ApiLocation[], locale = "en"): SiteLocation[] {
  const all = rows.map((r) => toSiteLocation(r, locale)).filter((l): l is SiteLocation => l !== null);
  return LOCATION_SLUGS.map((s) => all.find((l) => l.slug === s)).filter((l): l is SiteLocation => Boolean(l));
}

/** A fixed Monday (2024-01-01) plus an offset, for weekday names in any locale. */
const DAY_INDEX: Record<DayKey, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

export interface WeekRow {
  day: DayKey;
  label: string;
  today: boolean;
  open: string | null;
  close: string | null;
}

export function weekRows(hours: ApiHours | null | undefined, locale: string): WeekRow[] {
  const week = Array.isArray(hours?.week) ? hours.week : [];
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  return week
    .filter((d): d is { day: DayKey; open: string | null; close: string | null } => d.day in DAY_INDEX)
    .map((d) => ({
      day: d.day,
      label: fmt.format(new Date(Date.UTC(2024, 0, 1 + DAY_INDEX[d.day]))),
      today: d.day === hours?.today,
      open: d.open && d.close ? d.open : null,
      close: d.open && d.close ? d.close : null,
    }));
}

/** "21:00" in the reader's locale ("9:00 PM", "21:00", "下午9:00"). Empty for anything that isn't a time. */
export function formatHour(hhmm: string, locale: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  const d = new Date(Date.UTC(2024, 0, 1, Number(m[1]), Number(m[2])));
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}

/** A maps search for the place (opens the maps app on a phone). No API key. */
export function mapsHref(name: string, address: string | null): string {
  const q = address ? `${name}, ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
