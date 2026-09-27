/**
 * POST /api/plan/heartbeat  { sectionKey, seconds, interactions, targets? }
 * Sent by the analytics beacon (navigator.sendBeacon, so the body arrives as
 * text). The session id comes from the verified cookie, never from the client.
 */

import { NextResponse, type NextRequest } from "next/server";
import { planApi } from "@/lib/plan/api";
import { PLAN_COOKIE, verifyPlanToken } from "@/lib/plan/session";
import { isSectionKey } from "@/lib/plan/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HeartbeatBody {
  sectionKey: string;
  seconds: number;
  interactions: number;
  targets?: Record<string, number>;
}

/** `{label: count}`; labels come from the page's own controls, trimmed again by the API. */
function parseTargets(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, 20)) {
    if (typeof n === "number" && n > 0 && k.trim()) out[k.slice(0, 40)] = Math.floor(n);
  }
  return Object.keys(out).length ? out : undefined;
}

function parseBody(raw: string): HeartbeatBody | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.sectionKey !== "string" || !isSectionKey(v.sectionKey)) return null;
    return {
      sectionKey: v.sectionKey,
      seconds: typeof v.seconds === "number" ? v.seconds : 0,
      interactions: typeof v.interactions === "number" ? v.interactions : 0,
      targets: parseTargets(v.targets),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await verifyPlanToken(req.cookies.get(PLAN_COOKIE)?.value);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = parseBody(await req.text());
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const upstream = await planApi<{ ok: boolean }>(`/plan/sessions/${encodeURIComponent(claims.sid)}/heartbeat`, body);
  return NextResponse.json({ ok: upstream.ok }, { status: upstream.ok ? 200 : upstream.status });
}
