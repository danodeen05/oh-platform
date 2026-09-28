import { describe, expect, test } from "vitest";
import { canFullRefund, caseAge, customerName, isUrgent, normalizeTranscript, resolveBody, resolveErrorMessage } from "../support";

describe("resolveBody: never a partial card refund", () => {
  test("full_refund sends no amount, even when the form state holds one", () => {
    const r = resolveBody("full_refund", { amountCents: 500, reason: "cold soup" });
    expect(r).toEqual({ body: { action: "full_refund", reason: "cold soup" } });
    if ("body" in r) {
      expect("amountCents" in r.body).toBe(false);
      expect("amount" in r.body).toBe(false);
    }
    expect(resolveBody("full_refund", {})).toEqual({ body: { action: "full_refund" } });
  });
  test("credit sends whole cents within 1..max", () => {
    expect(resolveBody("credit", { amountCents: 300, reason: " sorry " })).toEqual({ body: { action: "credit", amountCents: 300, reason: "sorry" } });
    expect(resolveBody("credit", { amountCents: 300 })).toEqual({ body: { action: "credit", amountCents: 300 } });
    expect("error" in resolveBody("credit", { amountCents: 0 })).toBe(true);
    expect("error" in resolveBody("credit", { amountCents: null })).toBe(true);
    expect("error" in resolveBody("credit", { amountCents: 50001 })).toBe(true);
    expect("error" in resolveBody("credit", { amountCents: 2000 }, 1500)).toBe(true);
  });
  test("decline and close need a reason", () => {
    expect("error" in resolveBody("decline", { reason: "  " })).toBe(true);
    expect("error" in resolveBody("close", {})).toBe(true);
    expect(resolveBody("decline", { reason: "duplicate" })).toEqual({ body: { action: "decline", reason: "duplicate" } });
  });
});

describe("canFullRefund: owner only, and only with a card PaymentIntent", () => {
  test.each([
    ["owner", true, true],
    ["owner", false, false],
    ["manager", true, false],
    ["station", true, false],
  ] as const)("%s with PaymentIntent=%s -> %s", (role, pi, want) => {
    expect(canFullRefund(role, { hasPaymentIntent: pi })).toBe(want);
  });
  test("no order, no refund", () => expect(canFullRefund("owner", null)).toBe(false));
});

describe("resolveErrorMessage", () => {
  test("maps the API codes, with a retry for a refund in progress", () => {
    expect(resolveErrorMessage(409, { code: "REFUND_IN_PROGRESS" })).toMatchObject({ retry: true });
    expect(resolveErrorMessage(400, { code: "PARTIAL_REFUND_NOT_ALLOWED" }).message).toMatch(/whole order/);
    expect(resolveErrorMessage(409, { code: "NO_MEMBER" }).message).toMatch(/no account/);
    expect(resolveErrorMessage(403, { error: "Forbidden" }).message).toMatch(/Only the owner/);
    expect(resolveErrorMessage(500, { error: "boom" }).message).toBe("boom");
  });
});

describe("list helpers", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  test("age label and stale flag", () => {
    expect(caseAge("2026-09-28T11:50:00Z", now)).toEqual({ label: "10m", stale: false });
    expect(caseAge("2026-09-28T09:00:00Z", now)).toEqual({ label: "3h", stale: true });
    expect(caseAge("2026-09-25T12:00:00Z", now)).toEqual({ label: "3d", stale: true });
  });
  test("urgent: open pod issues and unwell reports", () => {
    expect(isUrgent({ status: "OPEN", type: "POD_ISSUE", summary: "wet seat" })).toBe(true);
    expect(isUrgent({ status: "OPEN", type: "ORDER_ISSUE", summary: "[Chappy] unwell: stomach ache" })).toBe(true);
    expect(isUrgent({ status: "RESOLVED", type: "POD_ISSUE", summary: "x" })).toBe(false);
    expect(isUrgent({ status: "OPEN", type: "GENERAL", summary: "hours?" })).toBe(false);
  });
  test("customer name falls back through member, contact, then Guest", () => {
    expect(customerName({ customer: { name: "Mei", email: "m@x.co" }, contact: null })).toBe("Mei");
    expect(customerName({ customer: null, contact: { email: "g@x.co" } })).toBe("g@x.co");
    expect(customerName({ customer: null, contact: null })).toBe("Guest");
  });
});

describe("normalizeTranscript", () => {
  test("reads role/content turns, text blocks and a {messages} wrapper; drops tool-only turns", () => {
    expect(normalizeTranscript([
      { role: "user", content: "My soup is cold" },
      { role: "assistant", content: [{ type: "text", text: "Sorry about that." }, { type: "tool_use", name: "report_issue" }] },
      { role: "assistant", content: [{ type: "tool_use", name: "x" }] },
    ])).toEqual([{ who: "guest", text: "My soup is cold" }, { who: "chappy", text: "Sorry about that." }]);
    expect(normalizeTranscript({ messages: [{ role: "staff", text: "Called them" }] })).toEqual([{ who: "staff", text: "Called them" }]);
    expect(normalizeTranscript(null)).toEqual([]);
    expect(normalizeTranscript("free text")).toEqual([]);
  });
});
