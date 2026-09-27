/**
 * POST /api/plan/scenario  { scenario }
 * Stores the reader's global scenario choice in the `oh_plan_scn` cookie.
 * Only a signed-in plan reader may set it, and only to a known key; the
 * cookie is not httpOnly so the client control can read it back.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isScenarioKey } from "@oh/plan-model";
import { planApi } from "@/lib/plan/api";
import { PLAN_COOKIE, verifyPlanToken } from "@/lib/plan/session";
import { PLAN_SCENARIO_COOKIE, PLAN_SCENARIO_DAYS } from "@/lib/plan/scenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await verifyPlanToken(req.cookies.get(PLAN_COOKIE)?.value);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let scenario: unknown;
  try {
    scenario = ((await req.json()) as { scenario?: unknown }).scenario;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof scenario !== "string" || !isScenarioKey(scenario)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  // For Chappy's visit summary; never blocks the switch.
  await planApi(`/plan/sessions/${encodeURIComponent(claims.sid)}/event`, { type: "scenario", value: scenario }).catch(() => undefined);
  const res = NextResponse.json({ ok: true, scenario });
  res.cookies.set(PLAN_SCENARIO_COOKIE, scenario, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PLAN_SCENARIO_DAYS * 24 * 60 * 60,
  });
  return res;
}
