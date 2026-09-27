/** POST /api/plan/nda/details  signer details for the NDA (saved server-side, asked once). */

import { NextResponse, type NextRequest } from "next/server";
import { ndaViewer, readJson, relay } from "@/lib/plan/nda/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await ndaViewer(true);
  if (claims instanceof NextResponse) return claims;
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { legalName, email, phone, address, company, title } = body;
  return relay(claims, "/details", { legalName, email, phone, address, company, title });
}
