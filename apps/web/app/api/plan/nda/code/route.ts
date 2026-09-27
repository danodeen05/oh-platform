/** POST /api/plan/nda/code  text the signer a 6-digit code. */

import { NextResponse } from "next/server";
import { ndaViewer, relay } from "@/lib/plan/nda/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const claims = await ndaViewer(true);
  if (claims instanceof NextResponse) return claims;
  return relay(claims, "/code", {});
}
