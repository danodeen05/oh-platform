/**
 * Shared plumbing for the /api/plan/nda/* route handlers: resolve the viewer's
 * plan session, then relay to the API's /plan/sessions/:sid/nda* routes.
 * Server only.
 */

import { NextResponse } from "next/server";
import { planApi } from "../api";
import { getPlanAccess } from "../session.server";
import type { PlanClaims } from "../session";

/**
 * The viewer's claims when they are signed in, else a 401 response.
 * `pendingOnly` also refuses viewers who no longer need to sign (409).
 */
export async function ndaViewer(pendingOnly: boolean): Promise<PlanClaims | NextResponse> {
  const access = await getPlanAccess();
  if (!access.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (pendingOnly && access.state !== "nda") return NextResponse.json({ error: "not_pending" }, { status: 409 });
  return access.claims;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** POST body to /plan/sessions/:sid/nda<suffix> and mirror the API's status and JSON. */
export async function relay(claims: PlanClaims, suffix: string, body: unknown): Promise<NextResponse> {
  const res = await planApi<unknown>(`/plan/sessions/${encodeURIComponent(claims.sid)}/nda${suffix}`, body);
  return NextResponse.json(res.data ?? { error: "unavailable" }, { status: res.status || 502 });
}
