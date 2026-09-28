/** Plan access codes: types and pure helpers for the list, detail and IssueCodeSheet. */
import type { BadgeTone } from "../components/ui/Badge";

export const AUDIENCES = ["INVESTOR", "LENDER", "LANDLORD", "PARTNER", "ADVISOR", "INTERNAL"] as const;
export const SCENARIOS = ["CONSERVATIVE", "BASE", "AGGRESSIVE"] as const;

/**
 * Mirror of apps/web/lib/plan/sections.ts SECTION_KEYS. The admin app cannot
 * import from the web app; keep these in sync when a section is added.
 */
export const SECTION_KEYS = [
  "summary", "model", "experience", "market", "floor-plan", "operations", "expansion",
  "unit-economics", "financials", "sensitivity", "team", "funding", "roadmap", "integrity",
] as const;

export type Audience = (typeof AUDIENCES)[number];
export type Scenario = (typeof SCENARIOS)[number];
export type CodeStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type NdaStatus = "NOT_REQUIRED" | "PENDING" | "SIGNED";

export interface CodeRow {
  id: string;
  code: string;
  label: string;
  audience: Audience;
  defaultScenario: Scenario;
  allowedSections: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  maxSessions: number | null;
  createdAt: string;
  lastViewedAt: string | null;
  status: CodeStatus;
  sessionCount: number;
  questionCount: number;
  totalSeconds: number;
  ndaRequired: boolean;
  ndaStatus: NdaStatus;
  ndaSignedAt: string | null;
  inviteSentAt?: string | null;
}

/** Who a code is for (optional; all three are needed to email the invitation). */
export interface Recipient { firstName: string; lastName: string; email: string }

/** The invitation email: the exact link it carries, and when and to whom it last went out. */
export interface InviteInfo { url: string; sentAt: string | null; sentTo: string | null; sendCount: number }

export interface SectionView { id: string; sectionKey: string; seconds: number; interactions: number; enteredAt: string }

export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; sectionKey: string | null; escalated: boolean; createdAt: string }

/** One finished visit, written up by Chappy (error "skipped_short" = a bounce, not emailed). */
export interface VisitSummary {
  id: string; visitStart: string; visitEnd: string; seconds: number; chatCount: number;
  verdict: string | null; take: string | null; emailedAt: string | null; error: string | null;
}

export interface Session {
  id: string; startedAt: string; lastSeenAt: string; userAgent: string | null; country: string | null;
  totalSeconds: number; sectionViews: SectionView[]; chatMessages?: ChatMessage[]; visitSummaries?: VisitSummary[];
}

export interface Question { id: string; sectionKey: string; body: string; contactEmail: string | null; answeredAt: string | null; answerBody: string | null; createdAt: string }

export interface CodeDetail extends Omit<CodeRow, "sessionCount" | "questionCount" | "totalSeconds" | "ndaStatus" | "ndaSignedAt"> {
  sessions: Session[];
  questions: Question[];
  recipient: Recipient | null;
  invite: InviteInfo;
}

export interface HeatRow { sectionKey: string; seconds: number; interactions: number; sessions: number }

export function formatMinutes(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function formatDate(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The short "Sep 27" form used next to the NDA Signed badge. */
export function shortDate(value: string | null): string {
  return formatDate(value).replace(/,.*$/, "");
}

const STATUS_TONE: Record<CodeStatus, BadgeTone> = { ACTIVE: "good", REVOKED: "alert", EXPIRED: "pending" };
export const statusTone = (s: CodeStatus): BadgeTone => STATUS_TONE[s];

/** The NDA badge on a code row: a word plus a tone, never colour alone. */
export function ndaBadge(code: Pick<CodeRow, "ndaStatus" | "ndaSignedAt">): { label: string; tone: BadgeTone } {
  if (code.ndaStatus === "SIGNED") return { label: `Signed ${shortDate(code.ndaSignedAt)}`, tone: "good" };
  if (code.ndaStatus === "PENDING") return { label: "Awaiting", tone: "pending" };
  return { label: "Not required", tone: "neutral" };
}

/** Copy link is only offered while the code is still usable. */
export const canCopyLink = (code: Pick<CodeRow, "status">) => code.status === "ACTIVE";

/** LENDER audiences are always modeled conservatively. */
export function scenarioForAudience(audience: Audience, current: Scenario): Scenario {
  return audience === "LENDER" ? "CONSERVATIVE" : current;
}

export function sessionsSummary(code: Pick<CodeRow, "sessionCount" | "maxSessions">): string {
  return `${code.sessionCount}${code.maxSessions ? ` / ${code.maxSessions}` : ""}`;
}

/** Max sessions: empty means no limit; otherwise a whole number of at least 1. */
export function validateMaxSessions(value: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t) || Number(t) < 1) return "Enter a whole number of at least 1.";
  return undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const EMPTY_RECIPIENT: Recipient = { firstName: "", lastName: "", email: "" };

/** Recipient email: optional, but it has to look like one when given (same check as the API). */
export function validateRecipientEmail(value: string): string | undefined {
  const t = value.trim();
  if (!t || EMAIL_RE.test(t)) return undefined;
  return "That email doesn't look right.";
}

/** The fields still needed before the invitation can be emailed, as labels. */
export function inviteMissing(r: Recipient | null): string[] {
  const out: string[] = [];
  if (!r?.firstName.trim()) out.push("first name");
  if (!r?.lastName.trim()) out.push("last name");
  if (!r?.email.trim()) out.push("email");
  return out;
}

/** "first name, last name and email" */
export function joinFields(fields: string[]): string {
  if (fields.length <= 1) return fields.join("");
  return `${fields.slice(0, -1).join(", ")} and ${fields.at(-1)}`;
}

/** One line for the invitation's status. */
export function inviteSummary(invite: Pick<InviteInfo, "sentAt" | "sentTo" | "sendCount">): string {
  if (!invite.sentAt) return "Not sent yet.";
  const times = invite.sendCount > 1 ? ` (sent ${invite.sendCount} times)` : "";
  return `Sent ${formatDate(invite.sentAt)}${invite.sentTo ? ` to ${invite.sentTo}` : ""}${times}.`;
}

export const sameRecipient = (a: Recipient, b: Recipient) =>
  a.firstName.trim() === b.firstName.trim() && a.lastName.trim() === b.lastName.trim() && a.email.trim().toLowerCase() === b.email.trim().toLowerCase();
