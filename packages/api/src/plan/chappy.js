/**
 * Shared bits for Chappy on the business plan: labels, owner contact
 * resolution, and his short texts to the owner. The chat itself runs in the
 * web BFF (apps/web/app/api/plan/chappy); this service stores the turns,
 * rate limits them, and handles texts, visit summaries and email.
 */

// English titles, mirrored from apps/web/messages/en.json plan.sections.*.title.
// The API ships without the web app, so it keeps its own copy.
export const SECTION_TITLES = Object.freeze({
  summary: "Executive Summary",
  model: "The Model",
  experience: "The Experience",
  market: "Market",
  "floor-plan": "The Floor Plan",
  operations: "Operations and Technology",
  expansion: "The Expansion Engine",
  "unit-economics": "Unit Economics",
  financials: "Financials",
  sensitivity: "Sensitivity and Risk",
  team: "Team and Governance",
  funding: "Funding and Use of Funds",
  roadmap: "Roadmap and Milestones",
  integrity: "Model Integrity",
});

export const AUDIENCE_LABELS = Object.freeze({
  INVESTOR: "Investor",
  LENDER: "Lender",
  LANDLORD: "Landlord",
  PARTNER: "Partner",
  ADVISOR: "Advisor",
  INTERNAL: "Internal",
});

export const sectionTitle = (key) => SECTION_TITLES[key] || key || "the plan";
export const audienceLabel = (a) => AUDIENCE_LABELS[a] || a;

export function ownerPhone(env = process.env) {
  return env.OWNER_ALERT_PHONE || env.ADMIN_PHONE_NUMBER || null;
}

export function ownerEmail(env = process.env) {
  return env.PLAN_NOTIFY_EMAIL || null;
}

export function summarySender(env = process.env) {
  return env.PLAN_SUMMARY_FROM || "chappy@ohbeefnoodlesoup.com";
}

export function adminCodeUrl(codeId, env = process.env) {
  const base = (env.ADMIN_APP_URL || "https://admin-oh-beef-noodle-soup.vercel.app").replace(/\/+$/, "");
  return `${base}/plan-access/${encodeURIComponent(codeId)}`;
}

const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** First Chappy message of a visit. Short enough for one or two SMS segments. */
export function firstChatText({ label, audience, sectionKey, message }) {
  return `Chappy: ${label} (${audienceLabel(audience)}) is asking me about the plan, from ${sectionTitle(sectionKey)}. Opener: "${clip(message, 160)}". I'll handle it. Summary to your inbox when they wander off.`;
}

/** Chappy could not answer, or the viewer asked for the owner. */
export function escalationText({ label, audience, sectionKey, question, contactEmail }) {
  const reach = contactEmail ? ` Reply to ${contactEmail}.` : " No email left.";
  return `Chappy escalation: ${label} (${audienceLabel(audience)}, ${sectionTitle(sectionKey)}) wants you, not me. "${clip(question, 220)}".${reach}`;
}
