/**
 * POST /api/plan/question  { sectionKey, body, contactEmail? }
 * Stores a recipient question against their access code and alerts the owner.
 */

import { NextResponse, type NextRequest } from "next/server";
import { planApi } from "@/lib/plan/api";
import { PLAN_COOKIE, verifyPlanToken } from "@/lib/plan/session";
import { isSectionKey } from "@/lib/plan/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await verifyPlanToken(req.cookies.get(PLAN_COOKIE)?.value);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const sectionKey = typeof payload.sectionKey === "string" && isSectionKey(payload.sectionKey) ? payload.sectionKey : null;
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const contactEmail = typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : undefined;
  if (!sectionKey || body.length < 3) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const upstream = await planApi<{ ok: boolean; id: string }>(
    `/plan/sessions/${encodeURIComponent(claims.sid)}/questions`,
    { sectionKey, body, contactEmail },
  );
  return NextResponse.json({ ok: upstream.ok }, { status: upstream.ok ? 201 : upstream.status });
}
