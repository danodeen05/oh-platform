/**
 * After a plan NDA is signed: Chappy emails the signer the executed PDF (from
 * service@) and texts a thank-you; the owner gets an email copy and a text.
 * Never throws for a failed send; failures land in PlanNda.deliveryError so
 * the admin console can offer "Resend copy".
 */

import { sendGraphMail } from "../email/graph.js";
import { sendSMS } from "../notifications.js";
import { adminCodeUrl, audienceLabel, ndaSender, ownerEmail, ownerPhone } from "./chappy.js";
import { assetBase64 } from "./assets.js";
import { firstName, maskEmail, ndaFilename, openDetails } from "./nda-fields.js";
import { renderOwnerEmail, renderSignerEmail, ownerSignedText, signerThanksText } from "./nda-mail.js";

const failed = (r) => !r || r.success === false;
const why = (r) => (r && (r.error || r.reason)) || "unknown";

/**
 * @param {string} ndaId
 * @param {{ prisma: any, pii: any, sendMail?: Function, sendSms?: Function, env?: Record<string, string|undefined>, now?: () => Date, log?: any, only?: "all" | "signer" }} deps
 * @returns {Promise<{ email: boolean, text: boolean, owner: boolean } | { skipped: true }>}
 */
export async function deliverNda(ndaId, deps) {
  const { prisma, pii } = deps;
  const sendMail = deps.sendMail || sendGraphMail;
  const sendSms = deps.sendSms || sendSMS;
  const env = deps.env || process.env;
  const now = deps.now || (() => new Date());
  const only = deps.only || "all";

  const nda = await prisma.planNda.findUnique({ where: { id: ndaId }, include: { accessCode: { select: { id: true, label: true, audience: true, inviteSentAt: true } } } });
  if (!nda || nda.status !== "SIGNED" || !nda.pdfEnc) return { skipped: true };

  const d = openDetails(pii, nda);
  if (!d) {
    await prisma.planNda.update({ where: { id: nda.id }, data: { deliveryError: "signer details could not be decrypted" } });
    return { email: false, text: false, owner: false };
  }
  const filename = ndaFilename(d.legalName, nda.signedAt);
  const pdf = { name: filename, contentType: "application/pdf", contentBytes: pii.openBytes(nda.pdfEnc).toString("base64") };
  const chappy = assetBase64("chappy-160.png");
  const mark = assetBase64("mark-light-160.png");
  const inlineImages = [
    ...(chappy ? [{ contentId: "chappy", name: "chappy.png", contentType: "image/png", contentBytes: chappy }] : []),
    ...(mark ? [{ contentId: "ohmark", name: "oh.png", contentType: "image/png", contentBytes: mark }] : []),
  ];
  const errors = [];
  const safe = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const signerMail = await safe(() =>
    sendMail({
      from: ndaSender(env),
      replyTo: ownerEmail(env) || undefined,
      to: d.email,
      subject: "Your signed NDA with Oh! Beef Noodle Soup",
      html: renderSignerEmail({
        firstName: firstName(d.legalName),
        legalName: d.legalName,
        signedAt: nda.signedAt,
        ndaId: nda.id,
        version: nda.version,
        documentSha256: nda.documentSha256,
        hasAvatar: Boolean(chappy),
        hasLogo: Boolean(mark),
        // Chappy introduced himself in the invitation email; don't do it twice.
        introduced: Boolean(nda.accessCode.inviteSentAt),
      }),
      inlineImages,
      attachments: [pdf],
    }),
  );
  const emailed = !failed(signerMail);
  if (!emailed) errors.push(`signer email: ${why(signerMail)}`);

  const signerText = await safe(() => sendSms({ to: d.phone, body: signerThanksText({ first: firstName(d.legalName), masked: maskEmail(d.email), emailed }) }));
  const texted = !failed(signerText);
  if (!texted) errors.push(`signer text: ${why(signerText)}`);

  let owner = false;
  if (only === "all") {
    const url = adminCodeUrl(nda.accessCode.id, env);
    const to = ownerEmail(env);
    if (to) {
      const r = await safe(() =>
        sendMail({
          from: ndaSender(env),
          to,
          subject: `NDA signed: ${d.legalName} (${nda.accessCode.label})`,
          html: renderOwnerEmail({
            legalName: d.legalName,
            label: nda.accessCode.label,
            audience: audienceLabel(nda.accessCode.audience),
            email: d.email,
            phone: d.phone,
            company: d.company,
            title: d.title,
            signedAt: nda.signedAt,
            ndaId: nda.id,
            adminUrl: url,
            deliveryNote: emailed ? "" : "Heads up: their copy did not go out by email. Use Resend copy in the admin console.",
            hasLogo: Boolean(mark),
          }),
          inlineImages: inlineImages.filter((i) => i.contentId === "ohmark"),
          attachments: [pdf],
        }),
      );
      if (failed(r)) errors.push(`owner email: ${why(r)}`);
      else owner = true;
    }
    const phone = ownerPhone(env);
    if (phone) {
      const r = await safe(() => sendSms({ to: phone, body: ownerSignedText({ label: nda.accessCode.label, legalName: d.legalName, url }) }));
      if (failed(r)) errors.push(`owner text: ${why(r)}`);
    }
  }

  const t = now();
  await prisma.planNda.update({
    where: { id: nda.id },
    data: {
      ...(emailed ? { emailedAt: t } : {}),
      ...(texted ? { textedAt: t } : {}),
      ...(owner ? { ownerNotifiedAt: t } : {}),
      deliveryError: errors.length ? errors.join("; ").slice(0, 1000) : null,
    },
  });
  if (errors.length) deps.log?.error?.({ errors }, "[plan] NDA delivery had failures");
  return { email: emailed, text: texted, owner };
}
