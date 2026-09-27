/**
 * NDA delivery copy: Chappy's email to the signer, the owner's copy, and the
 * two texts. Table layout with inline styles so Outlook and Gmail agree (same
 * approach as the visit summary email). No em dashes; Chappy uses no
 * exclamation points (the only "!" is the brand name).
 */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const C = { page: "#f4ede3", card: "#fffdf9", ink: "#2b2622", mute: "#6b625a", head: "#1f1b18", gold: "#E0C38C", ember: "#C9542B", rule: "#eee4d8" };

export function denverDateTime(d) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", dateStyle: "long", timeStyle: "short" }).format(new Date(d)) + " MT";
}

function shell({ eyebrow, title, body, footer, hasLogo }) {
  const logo = hasLogo ? `<img src="cid:ohmark" width="44" height="44" alt="Oh!" style="display:block">` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.page};font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border-radius:16px;overflow:hidden;border:1px solid ${C.rule}">
<tr><td style="background:${C.head};padding:22px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle"><div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${C.gold}">${esc(eyebrow)}</div><div style="font-size:26px;line-height:1.2;color:#fbf6ef;margin-top:4px">${esc(title)}</div></td>
<td style="vertical-align:middle;width:44px" align="right">${logo}</td>
</tr></table></td></tr>
<tr><td style="height:3px;background:${C.gold};line-height:3px;font-size:0">&nbsp;</td></tr>
${body}
</table>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8077;margin-top:12px;line-height:1.5">${footer}</div>
</td></tr></table></body></html>`;
}

function factsTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${C.ink};background:${C.page};border-radius:10px">
${rows.map(([k, v]) => `<tr><td style="padding:7px 14px;color:${C.mute};width:130px;vertical-align:top">${esc(k)}</td><td style="padding:7px 14px;vertical-align:top">${v}</td></tr>`).join("")}
</table>`;
}

/** Chappy's email to the person who just signed. */
export function renderSignerEmail({ firstName, legalName, signedAt, ndaId, version, documentSha256, hasAvatar, hasLogo }) {
  const avatar = hasAvatar ? `<img src="cid:chappy" width="56" height="56" alt="Chappy Chopstix" style="display:block;border-radius:28px;background:${C.page}">` : "";
  const p = (t) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.ink}">${t}</p>`;
  const body = `<tr><td style="padding:26px 28px 6px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr>
<td style="vertical-align:middle;padding-right:14px">${avatar}</td>
<td style="vertical-align:middle;font-family:Helvetica,Arial,sans-serif"><div style="font-size:14px;font-weight:bold;color:${C.ink}">Chappy Chopstix</div><div style="font-size:12px;color:${C.mute}">Head of Paperwork, Oh! Beef Noodle Soup</div></td>
</tr></table>
${p(`Hi ${esc(firstName)},`)}
${p("Chappy Chopstix here, the chopsticks in charge of paperwork at Oh! Beef Noodle Soup. Your NDA is signed, countersigned, and attached for your records. File it somewhere safe. I keep mine next to the broth recipe, which, per Section 3, I'm not allowed to tell you about.")}
${p("The business plan is open to you now. If a number catches your eye, ask me about it right there in the plan.")}
${p("Thanks for your interest in what we're building.")}
<p style="margin:0 0 4px;font-size:16px;line-height:1.5;color:${C.ink}">Chappy Chopstix</p>
<p style="margin:0 0 20px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${C.mute}">On behalf of Dano, Oh! Beef Noodle Soup</p>
</td></tr>
<tr><td style="padding:0 28px 26px">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.mute};margin-bottom:8px">Your agreement</div>
${factsTable([
  ["Agreement", "Confidential Disclosure Agreement"],
  ["Signed by", esc(legalName)],
  ["Signed", esc(denverDateTime(signedAt))],
  ["Version", esc(version)],
  ["Document ID", `<span style="font-family:Menlo,Consolas,monospace;font-size:12px">${esc(ndaId)}</span>`],
  ["Fingerprint", `<span style="font-family:Menlo,Consolas,monospace;font-size:12px">${esc(String(documentSha256 || "").slice(0, 16))}</span>`],
])}
</td></tr>`;
  return shell({
    eyebrow: "Fully executed",
    title: "Your NDA is signed",
    body,
    hasLogo,
    footer: "Oh! Beef Noodle Soup, LLC · 379 W 3175 N, Lehi, UT 84043<br>Questions about this agreement? Just reply to this email.",
  });
}

/** The owner's copy. */
export function renderOwnerEmail({ legalName, label, audience, email, phone, company, title, signedAt, ndaId, adminUrl, deliveryNote, hasLogo }) {
  const body = `<tr><td style="padding:24px 28px 8px"><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.ink}">${esc(legalName)} signed the plan NDA. The fully executed PDF is attached, and the plan is open to them now.</p>
${deliveryNote ? `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${C.ember}">${esc(deliveryNote)}</p>` : ""}</td></tr>
<tr><td style="padding:0 28px 18px">${factsTable([
  ["Code", `${esc(label)} · ${esc(audience)}`],
  ["Legal name", esc(legalName)],
  ["Email", esc(email)],
  ["Mobile", esc(phone)],
  ...(company ? [["On behalf of", `${esc(company)}${title ? `, ${esc(title)}` : ""}`]] : []),
  ["Signed", esc(denverDateTime(signedAt))],
  ["Document ID", `<span style="font-family:Menlo,Consolas,monospace;font-size:12px">${esc(ndaId)}</span>`],
])}</td></tr>
<tr><td style="padding:0 28px 26px"><a href="${esc(adminUrl)}" style="display:inline-block;background:${C.ember};color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;padding:10px 18px;border-radius:8px">Open in the admin console</a></td></tr>`;
  return shell({ eyebrow: "NDA signed", title: legalName, body, hasLogo, footer: "Chappy Chopstix, filing your paperwork so you don't have to." });
}

export function signerThanksText({ first, masked, emailed }) {
  const where = emailed ? `is in your inbox at ${masked}` : `is on its way to ${masked}`;
  return `Oh! Beef Noodle Soup: Thanks for signing, ${first}, and for your interest in Oh!. We received your NDA, and your fully executed copy ${where}. Enjoy the plan. Chappy`;
}

export function ownerSignedText({ label, legalName, url }) {
  return `Chappy: ${label} just signed the NDA as ${legalName}. PDF's in your inbox. ${url}`;
}
