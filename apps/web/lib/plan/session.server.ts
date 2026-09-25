/**
 * Server-component helpers around the plan session cookie.
 * Kept separate from session.ts so middleware (edge) never imports next/headers
 * or next/navigation.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PLAN_COOKIE, verifyPlanToken, type PlanClaims } from "./session";
import { planApi } from "./api";
import { isSectionVisible, type SectionKey } from "./sections";

/**
 * Memoized per request: layout and pages share one verification.
 *
 * Two checks: the JWT signature (cheap, also done in middleware) and then a
 * live status call so a revoked or expired code stops working immediately,
 * not when the 14-day cookie runs out. Middleware runs on the edge and cannot
 * reach the database, which is why the live check lives here.
 */
export const getPlanSession = cache(async (): Promise<PlanClaims | null> => {
  const store = await cookies();
  const claims = await verifyPlanToken(store.get(PLAN_COOKIE)?.value);
  if (!claims) return null;
  const status = await planApi<{ active: boolean }>(`/plan/sessions/${encodeURIComponent(claims.sid)}/status`, {});
  return status.ok && status.data?.active ? claims : null;
});

/**
 * Enforces section visibility server-side (spec 7.7): the code's explicit
 * allowlist, else the section's audience defaults. A code that is not
 * allowed to see a section gets a 404, not a hidden nav item.
 */
export async function requireSection(key: SectionKey): Promise<PlanClaims> {
  const claims = await getPlanSession();
  if (!claims || !isSectionVisible(claims, key)) notFound();
  return claims;
}
