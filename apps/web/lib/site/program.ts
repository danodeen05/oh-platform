/**
 * Task D7: server-side reads for the rewards page.
 *
 * - The membership program (GET /membership/program, publicProgram() in
 *   packages/api/src/membership/program.js), revalidated hourly. The page
 *   never hard-codes a tier rule; every number on it comes from here.
 * - The badge and challenge catalogs (GET /badges, GET /challenges) with
 *   `?locale=`, so the API's F1a localizers return translated names.
 *
 * Every read fails soft (null or an empty list): the page renders what it
 * can instead of erroring.
 */
import type { PublicProgram } from "./simulate";

export type { PublicProgram, ProgramTier } from "./simulate";

/** Server-side API base: the same env the client uses (the API is reachable from both). */
const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const PROGRAM_REVALIDATE_SECONDS = 3600;

export { TIER_META, tierMeta, type TierKey } from "./tier-meta";

export interface CatalogCopy {
  name: string;
  description: string;
}

export interface BadgeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  iconKey: string | null;
  i18n?: Record<string, Partial<CatalogCopy>> | null;
}

export interface ChallengeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  rewardCents: number;
  iconKey: string | null;
  i18n?: Record<string, Partial<CatalogCopy>> | null;
}

/**
 * The row's copy in `locale`. The API localizes when it has F1a; this
 * repeats the same rule (row columns are English, `i18n[locale]` overrides
 * them) so the page is right either way.
 */
export function localizedCopy(row: { name: string; description: string; i18n?: BadgeRow["i18n"] }, locale: string): CatalogCopy {
  const copy = locale === "en" ? null : row.i18n?.[locale];
  return { name: copy?.name ?? row.name, description: copy?.description ?? row.description };
}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function isProgram(value: unknown): value is PublicProgram {
  const p = value as PublicProgram | null;
  return Boolean(p && Array.isArray(p.tiers) && p.tiers.length > 0 && p.referral && typeof p.creditExpiryDays === "number");
}

export async function getProgram(): Promise<PublicProgram | null> {
  const body = await getJson<unknown>("/membership/program", PROGRAM_REVALIDATE_SECONDS);
  return isProgram(body) ? body : null;
}

export async function getBadges(locale: string): Promise<BadgeRow[]> {
  const body = await getJson<BadgeRow[]>(`/badges?locale=${encodeURIComponent(locale)}`, 600);
  return Array.isArray(body) ? body : [];
}

export async function getChallenges(locale: string): Promise<ChallengeRow[]> {
  const body = await getJson<ChallengeRow[]>(`/challenges?locale=${encodeURIComponent(locale)}`, 600);
  return Array.isArray(body) ? body : [];
}
