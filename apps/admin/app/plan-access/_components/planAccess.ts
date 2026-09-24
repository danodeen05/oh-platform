/** Shared types and helpers for the Plan Access admin pages. */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const AUDIENCES = ["INVESTOR", "LENDER", "LANDLORD", "PARTNER", "ADVISOR", "INTERNAL"] as const;
export const SCENARIOS = ["CONSERVATIVE", "BASE", "AGGRESSIVE"] as const;

/**
 * Mirror of apps/web/lib/plan/sections.ts SECTION_KEYS. The admin app cannot
 * import from the web app; keep these in sync when a section is added.
 */
export const SECTION_KEYS = [
  "summary", "model", "experience", "market", "floor-plan", "operations", "expansion",
  "unit-economics", "financials", "sensitivity", "team", "funding", "roadmap",
] as const;

export type Audience = (typeof AUDIENCES)[number];
export type Scenario = (typeof SCENARIOS)[number];

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
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  sessionCount: number;
  questionCount: number;
  totalSeconds: number;
}

export interface SectionView {
  id: string;
  sectionKey: string;
  seconds: number;
  interactions: number;
  enteredAt: string;
}

export interface Session {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  country: string | null;
  totalSeconds: number;
  sectionViews: SectionView[];
}

export interface Question {
  id: string;
  sectionKey: string;
  body: string;
  contactEmail: string | null;
  answeredAt: string | null;
  answerBody: string | null;
  createdAt: string;
}

export interface CodeDetail extends Omit<CodeRow, "sessionCount" | "questionCount" | "totalSeconds"> {
  sessions: Session[];
  questions: Question[];
}

export interface HeatRow {
  sectionKey: string;
  seconds: number;
  interactions: number;
  sessions: number;
}

/**
 * Public web origin for invitation links. Derived at runtime so dev admin
 * emits dev links (same pattern as apps/admin/app/kiosks/page.tsx getWebUrl).
 */
export function getWebOrigin(): string {
  if (process.env.NEXT_PUBLIC_WEB_URL) return process.env.NEXT_PUBLIC_WEB_URL;
  if (typeof window === "undefined") return "https://www.ohbeef.com";
  const host = window.location.hostname;
  if (host.includes("devadmin") || host.includes("devwebapp")) return "https://devwebapp.ohbeef.com";
  if (host.includes("ohbeef")) return "https://www.ohbeef.com";
  return "http://localhost:3000";
}

export function inviteLink(code: string): string {
  return `${getWebOrigin()}/plan?c=${encodeURIComponent(code)}`;
}

export function formatMinutes(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function formatDate(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export const statusColors: Record<CodeRow["status"], { bg: string; text: string }> = {
  ACTIVE: { bg: "#d1fae5", text: "#065f46" },
  REVOKED: { bg: "#fee2e2", text: "#991b1b" },
  EXPIRED: { bg: "#fef3c7", text: "#92400e" },
};
