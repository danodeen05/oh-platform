/**
 * Plan invitations: who a code is for, and Chappy's email with their link.
 *
 * The recipient (first name, last name, email) is optional on a code and is
 * sealed under PLAN_PII_KEY like the NDA signer's details. All three are
 * required to send the invitation. The recipient prefills the NDA form for
 * that code only, and gives Chappy a first name to greet.
 *
 * Admin routes (guarded by the /admin hook in index.js; /admin/plan is owner-only):
 *   PATCH /admin/plan/codes/:id/recipient   save or clear the recipient
 *   POST  /admin/plan/codes/:id/invite      email the link (re-send allowed)
 *
 * Sending honors SUPPORT_NOTIFY (off | log | live, notifications.js): "log"
 * records the send and logs it without emailing anyone, "off" refuses.
 */

import { sendGraphMail } from "../email/graph.js";
import { notifyMode } from "../notifications.js";
import { assetBase64 } from "./assets.js";
import { ndaSender, ownerEmail } from "./chappy.js";
import { INVITE_SUBJECT, renderInviteEmail, renderInviteText } from "./invite-mail.js";
import { isEmail, maskEmail } from "./nda-fields.js";

const NAME_MAX = 60;
const RESEND_COOLDOWN_MS = 20 * 1000;
const clean = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export const MISSING_MESSAGE = "Add the recipient's first name, last name and email before sending the invitation.";

/**
 * Validates the optional recipient fields. Blank means "not set"; an email,
 * when given, must look like one.
 * @returns {{ ok: true, value: { firstName: string, lastName: string, email: string } } | { ok: false, error: string, field: string }}
 */
export function validateRecipient(input) {
  const b = input && typeof input === "object" ? input : {};
  const value = {
    firstName: clean(b.firstName, NAME_MAX),
    lastName: clean(b.lastName, NAME_MAX),
    email: clean(b.email, 254).toLowerCase(),
  };
  if (value.email && !isEmail(value.email)) return { ok: false, error: "That recipient email doesn't look right.", field: "email" };
  return { ok: true, value };
}

export const hasRecipient = (r) => Boolean(r && (r.firstName || r.lastName || r.email));

/** The missing fields for sending, in form order. */
export function missingForInvite(r) {
  return ["firstName", "lastName", "email"].filter((k) => !r?.[k]);
}

/** Column values for a recipient (null clears). */
export function sealRecipient(pii, r) {
  const seal = (v) => (v ? pii.seal(v) : null);
  return { recipientFirstNameEnc: seal(r.firstName), recipientLastNameEnc: seal(r.lastName), recipientEmailEnc: seal(r.email) };
}

/** Decrypted recipient, or null when none is set or it cannot be decrypted. */
export function openRecipient(pii, code) {
  if (!pii || !code || !(code.recipientFirstNameEnc || code.recipientLastNameEnc || code.recipientEmailEnc)) return null;
  try {
    return {
      firstName: pii.open(code.recipientFirstNameEnc) || "",
      lastName: pii.open(code.recipientLastNameEnc) || "",
      email: pii.open(code.recipientEmailEnc) || "",
    };
  } catch {
    return null;
  }
}

/** The first name Chappy should use: the signed NDA's name wins over the invitation's. */
export function greetingName({ signedLegalName, recipientFirstName }) {
  const fromNda = String(signedLegalName || "").trim().split(/\s+/)[0];
  return fromNda || String(recipientFirstName || "").trim() || null;
}

/** The code's /plan entry link, the same shape as the admin console's Copy link. */
export function planEntryUrl(code, env = process.env) {
  const base = String(env.WEB_BASE_URL || "https://www.ohbeef.com").replace(/\/+$/, "");
  return `${base}/plan?c=${encodeURIComponent(code)}`;
}

const ENC_FIELDS = ["recipientFirstNameEnc", "recipientLastNameEnc", "recipientEmailEnc", "inviteSentToEnc"];

/** A code row for the admin console: sealed columns out, decrypted recipient and invite status in. */
export function adminCodeView(pii, code, env = process.env) {
  const out = { ...code };
  for (const k of ENC_FIELDS) delete out[k];
  let sentTo = null;
  if (code.inviteSentToEnc && pii) {
    try {
      sentTo = pii.open(code.inviteSentToEnc);
    } catch {
      sentTo = null;
    }
  }
  return {
    ...out,
    recipient: openRecipient(pii, code),
    invite: { url: planEntryUrl(code.code, env), sentAt: code.inviteSentAt || null, sentTo, sendCount: code.inviteSendCount || 0 },
  };
}

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{ prisma: any, pii: any, now: () => Date, sendMail?: Function, env?: Record<string, string|undefined>, isActive: Function, log?: any }} ctx
 */
export async function registerPlanInviteRoutes(app, { prisma, pii, now, sendMail, env: envIn, isActive, log }) {
  const env = envIn || process.env;
  const send = sendMail || sendGraphMail;
  const noKey = (reply) => reply.code(503).send({ error: "PLAN_PII_KEY is not configured, so recipient details can't be stored." });

  app.patch("/admin/plan/codes/:id/recipient", async (req, reply) => {
    if (!pii) return noKey(reply);
    const result = validateRecipient(req.body);
    if (!result.ok) return reply.code(400).send({ error: result.error, field: result.field });
    const existing = await prisma.planAccessCode.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: "not found" });
    const code = await prisma.planAccessCode.update({ where: { id: existing.id }, data: sealRecipient(pii, result.value) });
    return reply.send({ code: adminCodeView(pii, code, env) });
  });

  app.post("/admin/plan/codes/:id/invite", async (req, reply) => {
    if (!pii) return noKey(reply);
    const code = await prisma.planAccessCode.findUnique({ where: { id: req.params.id } });
    if (!code) return reply.code(404).send({ error: "not found" });
    if (!isActive(code, now())) return reply.code(409).send({ error: "This code is revoked or expired, so its link no longer works. Issue a new code instead." });
    const r = openRecipient(pii, code);
    const missing = missingForInvite(r);
    if (missing.length) return reply.code(400).send({ error: MISSING_MESSAGE, missing });
    if (!isEmail(r.email)) return reply.code(400).send({ error: "That recipient email doesn't look right.", missing: ["email"] });
    if (code.inviteSentAt && now().getTime() - new Date(code.inviteSentAt).getTime() < RESEND_COOLDOWN_MS) {
      return reply.code(429).send({ error: "The invitation just went out. Give it a few seconds before sending again." });
    }

    const mode = notifyMode(env);
    if (mode === "off") return reply.code(503).send({ error: "Email is turned off on this server (SUPPORT_NOTIFY=off)." });

    const url = planEntryUrl(code.code, env);
    const chappy = assetBase64("chappy-160.png");
    const mark = assetBase64("mark-light-160.png");
    const content = { firstName: r.firstName, url, code: code.code, ndaRequired: Boolean(code.ndaRequired) };
    const message = {
      from: ndaSender(env),
      fromName: env.PLAN_INVITE_FROM_NAME || "Oh! Beef Noodle Soup",
      replyTo: ownerEmail(env) || undefined,
      to: r.email,
      subject: INVITE_SUBJECT,
      html: renderInviteEmail({ ...content, hasAvatar: Boolean(chappy), hasLogo: Boolean(mark) }),
      text: renderInviteText(content),
      inlineImages: [
        ...(chappy ? [{ contentId: "chappy", name: "chappy.png", contentType: "image/png", contentBytes: chappy }] : []),
        ...(mark ? [{ contentId: "ohmark", name: "oh.png", contentType: "image/png", contentBytes: mark }] : []),
      ],
    };

    if (mode === "log") {
      (log || app.log).info?.(`[plan] SUPPORT_NOTIFY=log: would email the plan invitation for code ${code.id} to ${maskEmail(r.email)} (${url})`);
    } else {
      let result;
      try {
        result = await send(message);
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : String(err) };
      }
      if (!result || result.success === false) {
        const why = (result && (result.error || result.reason)) || "unknown";
        (log || app.log).error?.({ why }, "[plan] invitation email failed");
        return reply.code(502).send({ error: `The invitation email did not go out (${String(why).slice(0, 200)}).` });
      }
    }

    const updated = await prisma.planAccessCode.update({
      where: { id: code.id },
      data: { inviteSentAt: now(), inviteSentToEnc: pii.seal(r.email), inviteSendCount: { increment: 1 } },
    });
    return reply.send({ ok: true, mode, code: adminCodeView(pii, updated, env) });
  });
}
