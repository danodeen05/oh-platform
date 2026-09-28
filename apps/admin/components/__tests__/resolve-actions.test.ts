import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ResolveActions } from "../support/ResolveActions";
import type { AdminRole } from "../../lib/access";
import { refundState, type RefundState } from "../../lib/support";

// Task D12 fix round 1: the Resolve card rendered for real (replaces the
// source-text regexes): who sees "Refund full order", and what a refund in
// progress locks.
const noop = () => {};
function render(role: AdminRole, opts: { pi?: boolean; member?: boolean; refund?: RefundState } = {}) {
  return renderToStaticMarkup(createElement(ResolveActions, {
    role, order: { hasPaymentIntent: opts.pi ?? true }, hasMember: opts.member ?? true, busy: false,
    refund: opts.refund ?? { pending: false }, onCredit: noop, onRefund: noop, onDecline: noop,
  }));
}
const button = (html: string, testId: string) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? null;
const disabled = (tag: string | null) => Boolean(tag && / disabled=""/.test(tag));

describe("ResolveActions", () => {
  test("the owner sees Refund full order on a card-paid order; a manager and a station never do", () => {
    expect(button(render("owner"), "refund-full")).not.toBeNull();
    expect(button(render("manager"), "refund-full")).toBeNull();
    expect(button(render("station"), "refund-full")).toBeNull();
    expect(button(render("owner", { pi: false }), "refund-full")).toBeNull();
  });

  test("no member: store credit is disabled with a note", () => {
    const html = render("manager", { member: false });
    expect(disabled(button(html, "give-credit"))).toBe(true);
    expect(html).toContain("No member account");
  });

  test("a refund in progress: banner, credit and decline locked, owner keeps Retry full refund", () => {
    const refund: RefundState = { pending: true, stale: false, startedAt: "2026-09-28T03:00:00Z", startedBy: "user_owner" };
    const owner = render("owner", { refund });
    expect(owner).toContain("Card refund in progress");
    expect(disabled(button(owner, "give-credit"))).toBe(true);
    expect(disabled(button(owner, "decline"))).toBe(true);
    const retry = button(owner, "refund-full");
    expect(disabled(retry)).toBe(false);
    expect(owner).toContain("Retry full refund");
    const manager = render("manager", { refund });
    expect(manager).toContain("Card refund in progress");
    expect(button(manager, "refund-full")).toBeNull();
  });

  test("a stale refund claim: decline and close work again, credit stays locked", () => {
    const html = render("manager", { refund: { pending: true, stale: true, startedAt: null, startedBy: null } });
    expect(html).toContain("Card refund stalled");
    expect(disabled(button(html, "decline"))).toBe(false);
    expect(disabled(button(html, "give-credit"))).toBe(true);
  });
});

describe("refundState", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const base = { status: "OPEN" as const, resolution: "FULL_REFUND", resolvedBy: "u", resolutionDetail: { refundPending: true } };
  test("pending while the lease runs, stale after it; nothing on a plain or closed case", () => {
    expect(refundState({ ...base, resolvedAt: "2026-09-28T11:58:00Z" }, 5 * 60 * 1000, now)).toMatchObject({ pending: true, stale: false });
    expect(refundState({ ...base, resolvedAt: "2026-09-28T11:50:00Z" }, 5 * 60 * 1000, now)).toMatchObject({ pending: true, stale: true });
    expect(refundState({ ...base, resolution: null, resolvedAt: null }, 5 * 60 * 1000, now)).toEqual({ pending: false });
    expect(refundState({ ...base, status: "RESOLVED", resolvedAt: "2026-09-28T11:58:00Z" }, 5 * 60 * 1000, now)).toEqual({ pending: false });
  });
});
