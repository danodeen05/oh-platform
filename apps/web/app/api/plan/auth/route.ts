/**
 * POST /api/plan/auth   { code }  -> sets the oh_plan cookie
 * DELETE /api/plan/auth           -> clears it
 *
 * Thin BFF over the Fastify /plan/auth route. This handler is the only place
 * that knows PLAN_JWT_SECRET. Every failure returns the same generic 401 so a
 * caller cannot distinguish a wrong code from a revoked one.
 */

import { NextResponse, type NextRequest } from "next/server";
import { planApi } from "@/lib/plan/api";
import { clientIp, hashIp } from "@/lib/plan/ip";
import { PLAN_COOKIE, PLAN_SESSION_DAYS, signPlanToken, type PlanAudience, type PlanScenario } from "@/lib/plan/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuthUpstream {
  sid: string;
  acid: string;
  audience: PlanAudience;
  scenario: PlanScenario;
  sections: string[];
  label: string;
}

const GENERIC = { error: "invalid" } as const;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let code = "";
  try {
    const body = (await req.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    return NextResponse.json(GENERIC, { status: 401 });
  }
  if (!code.trim()) return NextResponse.json(GENERIC, { status: 401 });

  const ipHash = hashIp(clientIp(req.headers));
  const upstream = await planApi<AuthUpstream>("/plan/auth", {
    code,
    userAgent: req.headers.get("user-agent") ?? undefined,
    country: req.headers.get("x-vercel-ip-country") ?? undefined,
  }, { ipHash });

  if (upstream.status === 429) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!upstream.ok || !upstream.data) {
    return NextResponse.json(GENERIC, { status: 401 });
  }

  const d = upstream.data;
  const token = await signPlanToken({ sid: d.sid, acid: d.acid, aud: d.audience, scn: d.scenario, sec: d.sections, lbl: d.label });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: PLAN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLAN_SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: PLAN_COOKIE, value: "", httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
