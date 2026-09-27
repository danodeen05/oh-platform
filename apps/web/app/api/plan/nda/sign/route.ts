/**
 * POST /api/plan/nda/sign  { signature: { kind, image }, consent: { electronic, terms } }
 *
 * Builds the executed NDA from the details the API holds (never from the
 * browser), fixes the signing time, hashes the exact text, renders the PDF,
 * and hands everything to the API in one call. The API checks the phone was
 * verified, stores it encrypted, then emails and texts the copies.
 */

import { NextResponse, type NextRequest } from "next/server";
import { planApi } from "@/lib/plan/api";
import { clientIp } from "@/lib/plan/ip";
import { buildNdaDocument } from "@/lib/plan/nda/document";
import { ndaDocumentHash } from "@/lib/plan/nda/hash";
import { renderNdaPdf } from "@/lib/plan/nda/pdf";
import { ndaViewer, readJson } from "@/lib/plan/nda/proxy";
import type { NdaState } from "@/lib/plan/nda/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SIGNATURE_MAX_CHARS = 400_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await ndaViewer(false);
  if (claims instanceof NextResponse) return claims;
  const body = await readJson(req);
  const sig = (body?.signature ?? {}) as { kind?: unknown; image?: unknown };
  const consent = (body?.consent ?? {}) as { electronic?: unknown; terms?: unknown };
  if (consent.electronic !== true || consent.terms !== true) return NextResponse.json({ error: "consent_required" }, { status: 400 });
  if ((sig.kind !== "typed" && sig.kind !== "drawn") || typeof sig.image !== "string" || !sig.image.startsWith("data:image/png;base64,") || sig.image.length > SIGNATURE_MAX_CHARS) {
    return NextResponse.json({ error: "signature_required" }, { status: 400 });
  }

  const sid = encodeURIComponent(claims.sid);
  const stateRes = await planApi<NdaState>(`/plan/sessions/${sid}/nda`, {});
  const state = stateRes.data;
  if (!stateRes.ok || !state) return NextResponse.json({ error: "unavailable" }, { status: stateRes.status || 502 });
  if (state.step === "done") return NextResponse.json({ ok: true, already: true });
  if (state.step !== "sign" || !state.details || !state.ndaId) return NextResponse.json({ error: "not_ready" }, { status: 409 });
  if (!state.countersigner) return NextResponse.json({ error: "no_countersigner" }, { status: 503 });

  const signedAt = new Date();
  const doc = buildNdaDocument({ recipient: state.details, effectiveDate: signedAt });
  const documentSha256 = ndaDocumentHash(doc);
  const ip = clientIp(req.headers);
  const userAgent = req.headers.get("user-agent") ?? "";
  let pdf: Buffer;
  try {
    pdf = await renderNdaPdf({
      doc,
      ndaId: state.ndaId,
      signedAt,
      recipientSignature: sig.image,
      signatureKind: sig.kind,
      countersigner: state.countersigner,
      audit: { openedAt: state.audit.openedAt, detailsAt: state.audit.detailsAt, phoneVerifiedAt: state.audit.phoneVerifiedAt, ip, userAgent, documentSha256 },
    });
  } catch (err) {
    console.error("[plan] NDA PDF render failed", err);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }

  const res = await planApi<{ ok?: boolean; already?: boolean; error?: string }>(`/plan/sessions/${sid}/nda/sign`, {
    version: doc.version,
    documentSha256,
    signature: { kind: sig.kind, image: sig.image },
    consent: { electronic: true, terms: true },
    signedAt: signedAt.toISOString(),
    ip,
    userAgent,
    pdf: pdf.toString("base64"),
  });
  if (!res.ok) return NextResponse.json(res.data ?? { error: "unavailable" }, { status: res.status || 502 });
  return NextResponse.json({ ok: true });
}
