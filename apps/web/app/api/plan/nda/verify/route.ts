/** POST /api/plan/nda/verify  { code } */

import { NextResponse, type NextRequest } from "next/server";
import { ndaViewer, readJson, relay } from "@/lib/plan/nda/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await ndaViewer(true);
  if (claims instanceof NextResponse) return claims;
  const body = await readJson(req);
  return relay(claims, "/verify", { code: typeof body?.code === "string" ? body.code.slice(0, 12) : "" });
}
