/**
 * Support queue (Task D12): types and pure helpers for app/(console)/support.
 *
 * Money rules (owner's): staff give store credit, or refund the ENTIRE order
 * to the card (owner only). There is never a partial card refund, so a
 * full_refund request body never carries an amount (the API answers 400
 * PARTIAL_REFUND_NOT_ALLOWED if it does).
 */
import type { AdminRole } from "./access";
import type { BadgeTone } from "../components/ui/Badge";

export const CASE_STATUSES = ["OPEN", "RESOLVED", "DECLINED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const CASE_TYPES = ["POD_ISSUE", "ORDER_ISSUE", "REFUND_REQUEST", "GENERAL", "CONTACT"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export type SupportCase = {
  id: string; type: CaseType; status: CaseStatus; summary: string;
  userId: string | null; orderId: string | null;
  contact: { name?: string; email?: string; phone?: string } | null;
  transcript: unknown; locale: string | null;
  resolution: string | null; amountCents: number | null;
  resolvedBy: string | null; resolvedAt: string | null;
  resolutionNote: string | null; resolutionDetail: Record<string, unknown> | null;
  createdAt: string;
};
export type CaseListItem = SupportCase & {
  customer: { name: string | null; email: string | null } | null;
  order: { orderNumber: string | null; kitchenOrderNumber: string | null; totalCents: number | null; paymentStatus: string | null } | null;
};
export type CaseList = { cases: CaseListItem[]; nextCursor: string | null };
export type CaseOrder = {
  id: string; orderNumber: string | null; kitchenOrderNumber: string | null; status: string | null; paymentStatus: string | null;
  totalCents: number | null; createdAt: string | null; seatLabel: string | null; hasPaymentIntent: boolean;
  creditsAppliedCents: number; giftCardAppliedCents: number;
  items: { name: string; quantity: number; priceCents: number; selectedValue: string | null }[];
};
export type CaseCustomer = {
  id: string; name: string | null; email: string | null; phone: string | null; tier: string | null;
  creditBalanceCents: number; goodwillLifetimeCents: number;
};
export type CaseDetail = {
  case: SupportCase; order: CaseOrder | null; customer: CaseCustomer | null;
  limits: { staffCreditMaxCents: number; goodwillLifetimeCapCents: number };
};

export const STATUS_LABEL: Record<CaseStatus, string> = { OPEN: "Open", RESOLVED: "Resolved", DECLINED: "Declined" };
export const STATUS_TONE: Record<CaseStatus, BadgeTone> = { OPEN: "pending", RESOLVED: "good", DECLINED: "neutral" };
export const TYPE_LABEL: Record<CaseType, string> = {
  POD_ISSUE: "Pod issue", ORDER_ISSUE: "Order issue", REFUND_REQUEST: "Refund request", GENERAL: "General", CONTACT: "Contact form",
};
export const typeLabel = (t: string) => TYPE_LABEL[t as CaseType] ?? t;
export const TIER_LABEL: Record<string, string> = { CHOPSTICK: "Chopstick", NOODLE_MASTER: "Noodle Master", BEEF_BOSS: "Beef Boss" };
export const RESOLUTION_LABEL: Record<string, string> = {
  STAFF_CREDIT: "Store credit", GOODWILL_CREDIT: "Chappy goodwill credit", FULL_REFUND: "Full refund", DECLINED: "Declined", INFO: "Closed",
};

/** Staff credit bounds; the API is the authority and sends its max with the case. */
export const STAFF_CREDIT_MAX_CENTS_DEFAULT = 50000;

/** Urgent: Chappy's "unwell" reports and pod problems still open. Waiting over 2 hours is flagged too. */
export function isUrgent(c: Pick<SupportCase, "status" | "type" | "summary">): boolean {
  if (c.status !== "OPEN") return false;
  return /\bunwell\b/i.test(c.summary) || c.type === "POD_ISSUE";
}

/** "12m", "3h", "2d": how long a case has waited. `stale` once it is over 2 hours old and still open. */
export function caseAge(createdAt: string, now = new Date()): { label: string; stale: boolean } {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000));
  const label = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
  return { label, stale: mins >= 120 };
}

export function customerName(c: Pick<CaseListItem, "customer" | "contact">): string {
  return c.customer?.name || c.customer?.email || c.contact?.name || c.contact?.email || c.contact?.phone || "Guest";
}

/** Owner only, and only when the order was paid by card (a PaymentIntent exists). */
export function canFullRefund(role: AdminRole, order: Pick<CaseOrder, "hasPaymentIntent"> | null): boolean {
  return role === "owner" && Boolean(order?.hasPaymentIntent);
}

export type ResolveAction = "credit" | "full_refund" | "decline" | "close";
export type ResolveInput = { amountCents?: number | null; reason?: string };
export type ResolveBody =
  | { action: "credit"; amountCents: number; reason?: string }
  | { action: "full_refund"; reason?: string }
  | { action: "decline" | "close"; reason: string };

/**
 * The request body for POST /admin/support/cases/:id/resolve, or an error to
 * show. A full refund NEVER carries an amount, whatever the input holds.
 */
export function resolveBody(action: ResolveAction, input: ResolveInput, maxCents = STAFF_CREDIT_MAX_CENTS_DEFAULT): { body: ResolveBody } | { error: string } {
  const reason = (input.reason ?? "").trim();
  if (action === "full_refund") return { body: reason ? { action, reason } : { action } };
  if (action === "credit") {
    const a = input.amountCents;
    if (a == null || !Number.isInteger(a) || a <= 0) return { error: "Enter an amount above $0." };
    if (a > maxCents) return { error: `Store credit is at most $${(maxCents / 100).toFixed(2)}.` };
    return { body: reason ? { action, amountCents: a, reason } : { action, amountCents: a } };
  }
  if (!reason) return { error: action === "decline" ? "Say why you are declining." : "Say why you are closing it." };
  return { body: { action, reason } };
}

/** Plain-English message for each API error code the resolve call can return. */
export function resolveErrorMessage(status: number, body: unknown): { message: string; retry?: boolean } {
  const code = body && typeof body === "object" && "code" in body ? String((body as { code: unknown }).code) : "";
  const apiMsg = body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string" ? (body as { error: string }).error : "";
  switch (code) {
    case "PARTIAL_REFUND_NOT_ALLOWED": return { message: "Card refunds are for the whole order only. Give store credit for part of it." };
    case "REFUND_IN_PROGRESS": return { message: "A card refund for this case is already running. Try again in a moment.", retry: true };
    case "REFUND_FAILED": return { message: "Stripe could not refund this payment. Nothing changed. Try again.", retry: true };
    case "NO_MEMBER": return { message: "This guest has no account to hold store credit. Contact them directly, or close the case." };
    case "INVALID_AMOUNT": return { message: apiMsg || "That amount is not allowed." };
    case "REASON_REQUIRED": return { message: "A reason is required." };
    case "NOT_FOUND": return { message: "This case no longer exists." };
  }
  if (status === 403) return { message: "Only the owner can refund an order to the card." };
  if (status === 401) return { message: "Your session ended. Sign in again." };
  return { message: apiMsg || "Something went wrong. Try again." };
}

export type TranscriptTurn = { who: "guest" | "chappy" | "staff" | "system"; text: string };

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b === "string" ? b : b && typeof b === "object" && (b as { type?: unknown }).type === "text" ? String((b as { text?: unknown }).text ?? "") : "")).filter(Boolean).join("\n");
  }
  return "";
}

/**
 * Turns a stored transcript into readable turns. Accepts an array of
 * { role, content } (content a string or text blocks), or { messages: [...] }.
 * Tool calls and empty turns are dropped. Anything else gives [].
 */
export function normalizeTranscript(raw: unknown): TranscriptTurn[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { messages?: unknown }).messages) ? (raw as { messages: unknown[] }).messages : [];
  const out: TranscriptTurn[] = [];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const role = String((m as { role?: unknown }).role ?? "").toLowerCase();
    const text = textOf((m as { content?: unknown; text?: unknown }).content ?? (m as { text?: unknown }).text).trim();
    if (!text) continue;
    const who = role === "user" || role === "guest" || role === "customer" ? "guest" : role === "assistant" || role === "chappy" ? "chappy" : role === "staff" ? "staff" : "system";
    out.push({ who, text });
  }
  return out;
}
