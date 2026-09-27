/**
 * POST /api/plan/event  { type, value? }
 * Records a reader move the owner cares about (print view, printed, language)
 * for Chappy's visit summary. Beacon-friendly: the body may arrive as text.
 * The session id comes from the verified cookie, never from the client.
 */

import { NextResponse, type NextRequest } from "next/server";
import { planApi } from "@/lib/plan/api";
import { PLAN_COOKIE, verifyPlanToken } from "@/lib/plan/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["print_view", "printed", "locale"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await verifyPlanToken(req.cookies.get(PLAN_COOKIE)?.value);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { type?: unknown; value?: unknown };
  try {
    body = JSON.parse(await req.text()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.type !== "string" || !TYPES.has(body.type)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const value = typeof body.value === "string" ? body.value.slice(0, 40) : undefined;
  const upstream = await planApi<{ ok: boolean }>(`/plan/sessions/${encodeURIComponent(claims.sid)}/event`, { type: body.type, value });
  return NextResponse.json({ ok: upstream.ok }, { status: upstream.ok ? 200 : upstream.status });
}
