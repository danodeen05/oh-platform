/**
 * The plan invitation: Chappy's email handing a recipient their private link
 * to the business plan. Same family as the NDA emails (nda-mail.js shell,
 * table layout, inline styles, service@ sender). Chappy introduces himself
 * here, so the NDA copy that follows does not. No em dashes; Chappy uses no
 * exclamation points (the only "!" is the brand name).
 */

import { C, esc, shell } from "./nda-mail.js";

export const INVITE_SUBJECT = "Your private link to the Oh! Beef Noodle Soup business plan";

const NDA_LINE = "First, a quick, standard NDA: confirm your details and mobile, then sign. It takes about two minutes, and the plan opens right after.";

/**
 * @param {{ firstName: string, url: string, code: string, ndaRequired: boolean, hasAvatar?: boolean, hasLogo?: boolean }} p
 */
export function renderInviteEmail({ firstName, url, code, ndaRequired, hasAvatar, hasLogo }) {
  const avatar = hasAvatar ? `<img src="cid:chappy" width="56" height="56" alt="Chappy Chopstix" style="display:block;border-radius:28px;background:${C.page}">` : "";
  const p = (t, extra = "") => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.ink}${extra}">${t}</p>`;
  const nda = ndaRequired
    ? `<tr><td style="padding:0 28px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};border-radius:10px;border-left:3px solid ${C.gold}"><tr>
<td style="padding:12px 14px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:${C.ink}">${esc(NDA_LINE)}</td>
</tr></table></td></tr>`
    : "";
  const body = `<tr><td style="padding:26px 28px 4px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr>
<td style="vertical-align:middle;padding-right:14px">${avatar}</td>
<td style="vertical-align:middle;font-family:Helvetica,Arial,sans-serif"><div style="font-size:14px;font-weight:bold;color:${C.ink}">Chappy Chopstix</div><div style="font-size:12px;color:${C.mute}">Head of Paperwork, Oh! Beef Noodle Soup</div></td>
</tr></table>
${p(`Hi ${esc(firstName)},`)}
${p("I'm Chappy Chopstix, the chopsticks in charge of paperwork around here. We're excited about your interest in Oh! Beef Noodle Soup, and I get the pleasant job of handing you the keys to our business plan. This link is yours alone.")}
</td></tr>
${nda}
<tr><td style="padding:2px 28px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:10px;background:${C.ember}">
<a href="${esc(url)}" style="display:block;padding:16px 20px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:bold;letter-spacing:.02em;color:#ffffff;text-decoration:none;border-radius:10px">Open the business plan</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:6px 28px 20px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.mute}" align="center">
Or paste this link into your browser:<br>
<a href="${esc(url)}" style="color:${C.ember};word-break:break-all">${esc(url)}</a><br>
Your access code: <span style="font-family:Menlo,Consolas,monospace;color:${C.ink};letter-spacing:.04em">${esc(code)}</span>
</td></tr>
<tr><td style="padding:0 28px 26px">
<div style="height:1px;background:${C.rule};line-height:1px;font-size:0;margin:0 0 18px">&nbsp;</div>
${p("Once you've had a chance to look it over, we'd love your feedback. If a question comes up while you read, ask me right there in the plan, or just reply to this email.")}
<p style="margin:0 0 4px;font-size:16px;line-height:1.5;color:${C.ink}">Chappy Chopstix</p>
<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${C.mute}">On behalf of Dano, Oh! Beef Noodle Soup</p>
</td></tr>`;
  return shell({
    eyebrow: "Private invitation",
    title: "The Oh! business plan",
    preheader: ndaRequired ? "Your private link is inside. A quick NDA comes first." : "Your private link is inside.",
    body,
    hasLogo,
    footer: "Oh! Beef Noodle Soup, LLC · 379 W 3175 N, Lehi, UT 84043<br>This link was made for you. Please don't forward it.",
  });
}

/** The plain-text alternative of renderInviteEmail. */
export function renderInviteText({ firstName, url, code, ndaRequired }) {
  return [
    `Hi ${firstName},`,
    "",
    "I'm Chappy Chopstix, the chopsticks in charge of paperwork around here. We're excited about your interest in Oh! Beef Noodle Soup, and I get the pleasant job of handing you the keys to our business plan. This link is yours alone.",
    "",
    ...(ndaRequired ? [NDA_LINE, ""] : []),
    "Open the business plan:",
    url,
    "",
    `Your access code: ${code}`,
    "",
    "Once you've had a chance to look it over, we'd love your feedback. If a question comes up while you read, ask me right there in the plan, or just reply to this email.",
    "",
    "Chappy Chopstix",
    "On behalf of Dano, Oh! Beef Noodle Soup",
    "",
    "Oh! Beef Noodle Soup, LLC · 379 W 3175 N, Lehi, UT 84043",
    "This link was made for you. Please don't forward it.",
    "",
  ].join("\n");
}
