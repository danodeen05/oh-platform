/**
 * Plan NDA routes (BFF, x-plan-api-key). The web app renders the NDA and the
 * executed PDF; this service keeps the draft, verifies the phone, and stores
 * the signed record encrypted (see pii.js). Registered from registerPlanRoutes.
 *
 *   POST /plan/sessions/:sid/nda          state for the NDA page
 *   POST /plan/sessions/:sid/nda/details  save signer details (never asked twice)
 *   POST /plan/sessions/:sid/nda/code     text a 6-digit code to the signer
 *   POST /plan/sessions/:sid/nda/verify   check it
 *   POST /plan/sessions/:sid/nda/sign     store signature + executed PDF, then deliver
 *   POST /plan/sessions/:sid/nda/pdf      the signer's own executed copy
 *
 * Admin routes live in nda-admin.js.
 */

import crypto from "node:crypto";
import { safeEqual } from "./codes.js";
import { validateDetails, maskPhone, ndaFilename, openDetails } from "./nda-fields.js";
import { deliverNda as defaultDeliverNda } from "./nda-delivery.js";
import { registerPlanNdaAdminRoutes } from "./nda-admin.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS = 8;
const SIGNED_AT_SKEW_MS = 5 * 60 * 1000;
const PDF_MAX_BYTES = 5 * 1024 * 1024;
const SIGNATURE_MAX_CHARS = 400_000;
const LIVE = ["DRAFT", "SIGNED"];

export const otpText = (code) => `Oh! Beef Noodle Soup: ${code} is your code to sign the NDA. It expires in 10 minutes.`;

/** The code's current (DRAFT or SIGNED) NDA, or null. */
export function currentNda(prisma, accessCodeId) {
  return prisma.planNda.findFirst({ where: { accessCodeId, status: { in: LIVE } }, orderBy: { createdAt: "desc" } });
}

function stepOf(nda) {
  if (!nda?.legalNameEnc) return "details";
  if (nda.status === "SIGNED") return "done";
  if (!nda.phoneVerifiedAt) return "verify";
  return "sign";
}

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{ prisma: any, requirePlanApiKey: Function, isActive: Function, now: () => Date, sendSms: Function, pii: any, sendMail?: Function, deliverNda?: (id: string) => void }} ctx
 */
export async function registerPlanNdaRoutes(app, ctx) {
  const { prisma, requirePlanApiKey, isActive, now, sendSms, pii } = ctx;
  const deliver = ctx.deliverNda || ((id) => {
    setImmediate(() => {
      defaultDeliverNda(id, { prisma, pii, sendSms, sendMail: ctx.sendMail, now, log: app.log }).catch((err) => app.log.error({ err }, "[plan] NDA delivery failed"));
    });
  });
  const guard = { onRequest: requirePlanApiKey };

  /** Active session + its code, or sends 401/503 and returns null. */
  const load = async (sid, reply) => {
    if (!pii) {
      reply.code(503).send({ error: "unavailable" });
      return null;
    }
    const session = await prisma.planViewSession.findUnique({
      where: { id: sid },
      include: { accessCode: { select: { id: true, label: true, audience: true, revokedAt: true, expiresAt: true, ndaRequired: true } } },
    });
    if (!session || !isActive(session.accessCode, now())) {
      reply.code(401).send({ error: "invalid" });
      return null;
    }
    return { session, code: session.accessCode, nda: await currentNda(prisma, session.accessCode.id) };
  };

  const view = async ({ session, code, nda }) => {
    const details = openDetails(pii, nda);
    const cs = await prisma.planNdaCountersigner.findUnique({ where: { id: "default" } });
    return {
      required: Boolean(code.ndaRequired),
      step: stepOf(nda),
      ndaId: nda?.id || null,
      details,
      phoneMasked: details ? maskPhone(details.phone) : null,
      otpSentAt: nda?.otpSentAt || null,
      countersigner: cs ? { name: cs.name, title: cs.title, signature: cs.signature } : null,
      audit: {
        openedAt: session.startedAt,
        detailsAt: nda?.createdAt || null,
        phoneVerifiedAt: nda?.phoneVerifiedAt || null,
        signedAt: nda?.signedAt || null,
      },
      signedAt: nda?.signedAt || null,
    };
  };

  app.post("/plan/sessions/:sid/nda", guard, async (req, reply) => {
    const ctxRow = await load(req.params.sid, reply);
    if (!ctxRow) return reply;
    return reply.send(await view(ctxRow));
  });

  app.post("/plan/sessions/:sid/nda/details", guard, async (req, reply) => {
    const row = await load(req.params.sid, reply);
    if (!row) return reply;
    if (row.nda?.status === "SIGNED") return reply.code(409).send({ error: "already_signed" });
    const result = validateDetails(req.body);
    if (!result.ok) return reply.code(400).send({ error: "invalid_details", errors: result.errors });
    const d = result.value;
    const sealed = {
      legalNameEnc: pii.seal(d.legalName),
      emailEnc: pii.seal(d.email),
      phoneEnc: pii.seal(d.phone),
      addressEnc: pii.seal(JSON.stringify(d.address)),
      companyEnc: pii.seal(d.company),
      titleEnc: pii.seal(d.title),
    };
    let nda;
    if (!row.nda) {
      nda = await prisma.planNda.create({ data: { accessCodeId: row.code.id, ...sealed } });
    } else {
      const phoneChanged = openDetails(pii, row.nda)?.phone !== d.phone;
      nda = await prisma.planNda.update({
        where: { id: row.nda.id },
        data: { ...sealed, ...(phoneChanged ? { phoneVerifiedAt: null, otpHash: null, otpExpiresAt: null, otpAttempts: 0 } : {}) },
      });
    }
    return reply.send(await view({ ...row, nda }));
  });

  app.post("/plan/sessions/:sid/nda/code", guard, async (req, reply) => {
    const row = await load(req.params.sid, reply);
    if (!row) return reply;
    const { nda } = row;
    if (!nda?.phoneEnc || nda.status !== "DRAFT") return reply.code(409).send({ error: "not_ready" });
    if (nda.phoneVerifiedAt) return reply.send({ ok: true, verified: true });
    const t = now().getTime();
    if (nda.otpSentAt && t - nda.otpSentAt.getTime() < OTP_COOLDOWN_MS) {
      return reply.code(429).send({ error: "cooldown", retryIn: Math.ceil((OTP_COOLDOWN_MS - (t - nda.otpSentAt.getTime())) / 1000) });
    }
    if (nda.otpSendCount >= OTP_MAX_SENDS) return reply.code(429).send({ error: "too_many_codes" });

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.planNda.update({
      where: { id: nda.id },
      data: { otpHash: pii.hmac(`${nda.id}:${code}`), otpExpiresAt: new Date(t + OTP_TTL_MS), otpAttempts: 0, otpSentAt: new Date(t), otpSendCount: { increment: 1 } },
    });
    const phone = pii.open(nda.phoneEnc);
    let sent;
    try {
      sent = await sendSms({ to: phone, body: otpText(code) });
    } catch (err) {
      sent = { success: false, error: String(err) };
    }
    if (sent && sent.success === false) {
      app.log.error({ reason: sent.reason || sent.error }, "[plan] NDA code SMS failed");
      return reply.code(502).send({ error: "sms_failed" });
    }
    return reply.send({ ok: true, phoneMasked: maskPhone(phone) });
  });

  app.post("/plan/sessions/:sid/nda/verify", guard, async (req, reply) => {
    const row = await load(req.params.sid, reply);
    if (!row) return reply;
    const { nda } = row;
    if (!nda || nda.status !== "DRAFT") return reply.code(409).send({ error: "not_ready" });
    if (nda.phoneVerifiedAt) return reply.send(await view(row));
    const entered = String(req.body?.code ?? "").replace(/\D/g, "");
    if (!nda.otpHash || !nda.otpExpiresAt || nda.otpExpiresAt.getTime() <= now().getTime()) {
      return reply.code(400).send({ error: "expired" });
    }
    if (entered.length !== 6 || !safeEqual(pii.hmac(`${nda.id}:${entered}`), nda.otpHash)) {
      const attempts = nda.otpAttempts + 1;
      const spent = attempts >= OTP_MAX_ATTEMPTS;
      await prisma.planNda.update({
        where: { id: nda.id },
        data: spent ? { otpAttempts: attempts, otpHash: null, otpExpiresAt: null } : { otpAttempts: attempts },
      });
      return reply.code(400).send({ error: spent ? "expired" : "wrong_code", remaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts) });
    }
    const updated = await prisma.planNda.update({
      where: { id: nda.id },
      data: { phoneVerifiedAt: now(), otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
    });
    return reply.send(await view({ ...row, nda: updated }));
  });

  app.post("/plan/sessions/:sid/nda/sign", { ...guard, bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    const row = await load(req.params.sid, reply);
    if (!row) return reply;
    const { nda } = row;
    if (nda?.status === "SIGNED") return reply.send({ ok: true, already: true });
    if (!nda || stepOf(nda) !== "sign") return reply.code(409).send({ error: "not_ready" });
    const cs = await prisma.planNdaCountersigner.findUnique({ where: { id: "default" } });
    if (!cs) return reply.code(503).send({ error: "no_countersigner" });

    const b = req.body || {};
    const bad = (why) => reply.code(400).send({ error: "bad_request", why });
    if (b.consent?.electronic !== true || b.consent?.terms !== true) return bad("consent");
    const sig = b.signature || {};
    if (!["typed", "drawn"].includes(sig.kind)) return bad("signature");
    if (typeof sig.image !== "string" || !sig.image.startsWith("data:image/png;base64,") || sig.image.length > SIGNATURE_MAX_CHARS) return bad("signature");
    if (typeof b.version !== "string" || !b.version || b.version.length > 40) return bad("version");
    if (typeof b.documentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(b.documentSha256)) return bad("hash");
    const signedAt = new Date(b.signedAt);
    if (Number.isNaN(signedAt.getTime()) || Math.abs(now().getTime() - signedAt.getTime()) > SIGNED_AT_SKEW_MS) return bad("signedAt");
    const pdf = typeof b.pdf === "string" ? Buffer.from(b.pdf, "base64") : Buffer.alloc(0);
    if (pdf.length < 8 || pdf.length > PDF_MAX_BYTES || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return bad("pdf");

    // Only the request that moves DRAFT -> SIGNED delivers, so a double
    // submit or two tabs produce one record and one set of messages.
    const won = await prisma.planNda.updateMany({
      where: { id: nda.id, status: "DRAFT" },
      data: {
        status: "SIGNED",
        version: b.version,
        signatureKind: sig.kind,
        signatureEnc: pii.seal(sig.image),
        consentAt: signedAt,
        signedAt,
        signerIpEnc: typeof b.ip === "string" && b.ip ? pii.seal(b.ip.slice(0, 64)) : null,
        signerUserAgent: typeof b.userAgent === "string" ? b.userAgent.slice(0, 512) : null,
        documentSha256: b.documentSha256,
        pdfEnc: pii.sealBytes(pdf),
        pdfSha256: crypto.createHash("sha256").update(pdf).digest("hex"),
        countersignerName: cs.name,
        countersignerTitle: cs.title,
        otpHash: null,
        otpExpiresAt: null,
      },
    });
    if (won.count === 0) return reply.send({ ok: true, already: true });
    deliver(nda.id);
    return reply.send({ ok: true });
  });

  app.post("/plan/sessions/:sid/nda/pdf", guard, async (req, reply) => {
    const row = await load(req.params.sid, reply);
    if (!row) return reply;
    const { nda } = row;
    if (!nda || nda.status !== "SIGNED" || !nda.pdfEnc) return reply.code(404).send({ error: "not_found" });
    return reply.send({
      pdf: pii.openBytes(nda.pdfEnc).toString("base64"),
      filename: ndaFilename(pii.open(nda.legalNameEnc), nda.signedAt),
    });
  });

  await registerPlanNdaAdminRoutes(app, { prisma, pii, now, sendSms, sendMail: ctx.sendMail, log: app.log });
}
