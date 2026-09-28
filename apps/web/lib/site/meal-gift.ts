/**
 * The next meal gift offered at checkout (Task D5).
 *
 * A meal someone paid forward at this location (oldest first, funded,
 * unexpired). It is a tender the server quotes and spends at PAID.
 *
 * Task D5 fix round 3 (follow-up): this MUST use the authenticated `api`
 * fetch (SiteFetch, from lib/site/api.ts's useSiteApi), never a bare
 * `fetch`, so a signed-in caller's Bearer token reaches the server -
 * GET /meal-gifts/next/:locationId excludes the verified caller's own gift,
 * but only when it can see who's asking. Passing a bare `fetch` here would
 * silently defeat that server-side exclusion by making every request look
 * anonymous. An anonymous/signed-out caller (`api` attaches no token when
 * there's nothing to attach) still sees the plain FIFO gift.
 */
import type { SiteFetch } from "./api";

export type MealGift = { id: string; amountCents: number; messageFromGiver?: string | null; giver?: { name?: string | null } | null };

export async function fetchNextMealGift(api: SiteFetch, apiBase: string, locationId: string): Promise<MealGift | null> {
  try {
    const res = await api(`${apiBase}/meal-gifts/next/${encodeURIComponent(locationId)}`, { headers: { "x-tenant-slug": "oh" }, cache: "no-store" });
    if (!res.ok) return null;
    const g = await res.json();
    return g && typeof g.id === "string" && typeof g.amountCents === "number" ? (g as MealGift) : null;
  } catch {
    return null;
  }
}
