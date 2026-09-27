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
import { accessState, type PlanAccessState, type PlanStatus } from "./access";

export interface PlanAccess {
  claims: PlanClaims | null;
  state: PlanAccessState;
  /** The viewer's email is on file from their signed NDA. */
  contactOnFile: boolean;
}

/**
 * Memoized per request: layout and pages share one verification.
 *
 * Two checks: the JWT signature (cheap, also done in middleware) and then a
 * live status call so a revoked or expired code stops working immediately,
 * not when the 14-day cookie runs out. Middleware runs on the edge and cannot
 * reach the database, which is why the live check lives here.
 */
export const getPlanAccess = cache(async (): Promise<PlanAccess> => {
  const store = await cookies();
  const claims = await verifyPlanToken(store.get(PLAN_COOKIE)?.value);
  if (!claims) return { claims: null, state: "none", contactOnFile: false };
  const status = await planApi<PlanStatus>(`/plan/sessions/${encodeURIComponent(claims.sid)}/status`, {});
  const state = accessState(status.ok, status.data);
  return { claims: state === "none" ? null : claims, state, contactOnFile: Boolean(status.data?.contactOnFile) };
});

/**
 * Claims only when the viewer may read plan content: a pending NDA counts as
 * no session here, so every page, print view and BFF route stays closed until
 * it is signed. Layouts use getPlanAccess to send those viewers to the NDA.
 */
export const getPlanSession = cache(async (): Promise<PlanClaims | null> => {
  const access = await getPlanAccess();
  return access.state === "ok" ? access.claims : null;
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
