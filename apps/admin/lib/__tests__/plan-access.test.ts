import { describe, expect, test } from "vitest";
import { canCopyLink, formatDate, formatMinutes, ndaBadge, scenarioForAudience, sessionsSummary, shortDate, statusTone } from "../plan-access";

describe("formatMinutes", () => {
  test("seconds under a minute", () => expect(formatMinutes(45)).toBe("45s"));
  test("minutes under an hour", () => expect(formatMinutes(125)).toBe("2 min"));
  test("hours and minutes", () => expect(formatMinutes(3900)).toBe("1h 5m"));
});

describe("formatDate / shortDate", () => {
  test("never for a null value", () => expect(formatDate(null)).toBe("never"));
  test("shortDate drops everything after the first comma", () => {
    const full = formatDate("2026-09-27T18:00:00Z");
    expect(shortDate("2026-09-27T18:00:00Z")).toBe(full.split(",")[0]);
  });
});

describe("statusTone", () => {
  test("maps each status to a tone", () => {
    expect(statusTone("ACTIVE")).toBe("good");
    expect(statusTone("REVOKED")).toBe("alert");
    expect(statusTone("EXPIRED")).toBe("pending");
  });
});

describe("ndaBadge", () => {
  test("signed shows the short signed date", () => {
    expect(ndaBadge({ ndaStatus: "SIGNED", ndaSignedAt: "2026-09-27T18:00:00Z" })).toMatchObject({ tone: "good" });
  });
  test("pending is Awaiting", () => {
    expect(ndaBadge({ ndaStatus: "PENDING", ndaSignedAt: null })).toEqual({ label: "Awaiting", tone: "pending" });
  });
  test("not required", () => {
    expect(ndaBadge({ ndaStatus: "NOT_REQUIRED", ndaSignedAt: null })).toEqual({ label: "Not required", tone: "neutral" });
  });
});

describe("canCopyLink", () => {
  test("only ACTIVE codes can be copied", () => {
    expect(canCopyLink({ status: "ACTIVE" })).toBe(true);
    expect(canCopyLink({ status: "REVOKED" })).toBe(false);
    expect(canCopyLink({ status: "EXPIRED" })).toBe(false);
  });
});

describe("scenarioForAudience", () => {
  test("LENDER forces CONSERVATIVE", () => expect(scenarioForAudience("LENDER", "AGGRESSIVE")).toBe("CONSERVATIVE"));
  test("other audiences keep the chosen scenario", () => expect(scenarioForAudience("INVESTOR", "AGGRESSIVE")).toBe("AGGRESSIVE"));
});

describe("sessionsSummary", () => {
  test("with a max", () => expect(sessionsSummary({ sessionCount: 2, maxSessions: 5 })).toBe("2 / 5"));
  test("unlimited", () => expect(sessionsSummary({ sessionCount: 2, maxSessions: null })).toBe("2"));
});
