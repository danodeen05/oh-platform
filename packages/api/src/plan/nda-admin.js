/**
 * Admin NDA routes (guarded by the /admin hook in index.js). Decrypts signer
 * details for the owner, serves the executed PDF, and manages the owner's
 * adopted countersignature.
 */

import { deliverNda } from "./nda-delivery.js";
import { ndaFilename, openDetails } from "./nda-fields.js";

const SIGNATURE_MAX_CHARS = 400_000;
const clean = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const isPng = (v) => typeof v === "string" && v.startsWith("data:image/png;base64,") && v.length <= SIGNATURE_MAX_CHARS;

/** @param {import('fastify').FastifyInstance} app */
export async function registerPlanNdaAdminRoutes(app, { prisma, pii, now, sendSms, sendMail, log }) {
  const need = (reply) => {
    if (pii) return false;
    reply.code(503).send({ error: "PLAN_PII_KEY is not configured" });
    return true;
  };
  const tryOpen = (v) => {
    try {
      return pii.open(v);
    } catch {
      return null;
    }
  };

  app.get("/admin/plan/nda/countersigner", async (req, reply) => {
    const cs = await prisma.planNdaCountersigner.findUnique({ where: { id: "default" } });
    return reply.send({ countersigner: cs ? { name: cs.name, title: cs.title, signature: cs.signature, adoptedAt: cs.adoptedAt, updatedAt: cs.updatedAt } : null });
  });

  app.put("/admin/plan/nda/countersigner", { bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const b = req.body || {};
    const name = clean(b.name, 120);
    const title = clean(b.title, 80);
    if (name.length < 3 || !title || !isPng(b.signature)) return reply.code(400).send({ error: "name, title and a PNG signature are required" });
    const data = { name, title, signature: b.signature };
    const cs = await prisma.planNdaCountersigner.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: { ...data, adoptedAt: now() } });
    return reply.send({ countersigner: { name: cs.name, title: cs.title, signature: cs.signature, adoptedAt: cs.adoptedAt } });
  });

  app.get("/admin/plan/codes/:id/nda", async (req, reply) => {
    if (need(reply)) return reply;
    const code = await prisma.planAccessCode.findUnique({ where: { id: req.params.id } });
    if (!code) return reply.code(404).send({ error: "not found" });
    const rows = await prisma.planNda.findMany({ where: { accessCodeId: code.id }, orderBy: { createdAt: "desc" } });
    const live = rows.find((r) => r.status !== "VOIDED") || null;
    return reply.send({
      ndaRequired: Boolean(code.ndaRequired),
      current: live && {
        id: live.id,
        status: live.status,
        details: openDetails(pii, live),
        audit: {
          version: live.version,
          startedAt: live.createdAt,
          phoneVerifiedAt: live.phoneVerifiedAt,
          consentAt: live.consentAt,
          signedAt: live.signedAt,
          ip: live.signerIpEnc ? tryOpen(live.signerIpEnc) : null,
          userAgent: live.signerUserAgent,
          signatureKind: live.signatureKind,
          documentSha256: live.documentSha256,
          pdfSha256: live.pdfSha256,
          countersignerName: live.countersignerName,
          countersignerTitle: live.countersignerTitle,
          emailedAt: live.emailedAt,
          textedAt: live.textedAt,
          ownerNotifiedAt: live.ownerNotifiedAt,
          deliveryError: live.deliveryError,
          otpSendCount: live.otpSendCount,
        },
      },
      history: rows.map((r) => ({ id: r.id, status: r.status, createdAt: r.createdAt, signedAt: r.signedAt, voidedAt: r.voidedAt })),
    });
  });

  app.get("/admin/plan/ndas/:ndaId/pdf", async (req, reply) => {
    if (need(reply)) return reply;
    const nda = await prisma.planNda.findUnique({ where: { id: req.params.ndaId } });
    if (!nda || !nda.pdfEnc) return reply.code(404).send({ error: "not found" });
    let pdf;
    try {
      pdf = pii.openBytes(nda.pdfEnc);
    } catch {
      return reply.code(500).send({ error: "The PDF could not be decrypted (check PLAN_PII_KEY)" });
    }
    const filename = ndaFilename(openDetails(pii, nda)?.legalName, nda.signedAt);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Cache-Control", "no-store")
      .send(pdf);
  });

  app.post("/admin/plan/ndas/:ndaId/resend", async (req, reply) => {
    if (need(reply)) return reply;
    const result = await deliverNda(req.params.ndaId, { prisma, pii, sendSms, sendMail, now, log, only: "signer" });
    if (result.skipped) return reply.code(404).send({ error: "not found or not signed" });
    return reply.send(result);
  });

  app.post("/admin/plan/ndas/:ndaId/void", async (req, reply) => {
    const nda = await prisma.planNda.findUnique({ where: { id: req.params.ndaId } });
    if (!nda) return reply.code(404).send({ error: "not found" });
    const updated = await prisma.planNda.update({ where: { id: nda.id }, data: { status: "VOIDED", voidedAt: nda.voidedAt || now() } });
    return reply.send({ ok: true, status: updated.status });
  });

  app.patch("/admin/plan/codes/:id/nda", async (req, reply) => {
    const required = req.body?.required;
    if (typeof required !== "boolean") return reply.code(400).send({ error: "required must be true or false" });
    const existing = await prisma.planAccessCode.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: "not found" });
    const code = await prisma.planAccessCode.update({ where: { id: existing.id }, data: { ndaRequired: required } });
    return reply.send({ code: { id: code.id, ndaRequired: code.ndaRequired } });
  });
}
