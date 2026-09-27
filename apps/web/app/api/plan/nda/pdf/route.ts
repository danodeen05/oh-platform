/** GET /api/plan/nda/pdf  the signer's own fully executed copy (download). */

import { NextResponse } from "next/server";
import { planApi } from "@/lib/plan/api";
import { ndaViewer } from "@/lib/plan/nda/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const claims = await ndaViewer(false);
  if (claims instanceof NextResponse) return claims;
  const res = await planApi<{ pdf: string; filename: string }>(`/plan/sessions/${encodeURIComponent(claims.sid)}/nda/pdf`, {});
  if (!res.ok || !res.data?.pdf) return NextResponse.json({ error: "not_found" }, { status: res.status === 404 ? 404 : 502 });
  const filename = res.data.filename.replace(/[^\w.-]/g, "_");
  return new NextResponse(new Uint8Array(Buffer.from(res.data.pdf, "base64")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
