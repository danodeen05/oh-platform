import { describe, expect, test } from "vitest";
import {
  EMPTY_RECIPIENT, canCopyLink, formatDate, formatMinutes, inviteMissing, inviteSummary, joinFields, ndaBadge, sameRecipient,
  scenarioForAudience, sessionsSummary, shortDate, statusTone, validateMaxSessions, validateRecipientEmail,
} from "../plan-access";

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

describe("validateMaxSessions", () => {
  test("empty means no limit, so it's valid", () => expect(validateMaxSessions("")).toBeUndefined());
  test("whitespace-only also means no limit", () => expect(validateMaxSessions("   ")).toBeUndefined());
  test("a positive whole number is valid", () => expect(validateMaxSessions("5")).toBeUndefined());
  test("1 is the minimum allowed", () => expect(validateMaxSessions("1")).toBeUndefined());
  test("0 is rejected", () => expect(validateMaxSessions("0")).toBeTruthy());
  test("a negative number is rejected", () => expect(validateMaxSessions("-1")).toBeTruthy());
  test("a decimal is rejected", () => expect(validateMaxSessions("1.5")).toBeTruthy());
  test("non-numeric text is rejected", () => expect(validateMaxSessions("abc")).toBeTruthy());
});

describe("plan invitation helpers", () => {
  test("recipient email is optional but must look like one", () => {
    expect(validateRecipientEmail("")).toBeUndefined();
    expect(validateRecipientEmail("  pat@lease.com ")).toBeUndefined();
    expect(validateRecipientEmail("pat@")).toBe("That email doesn't look right.");
  });
  test("inviteMissing names what is still needed, in form order", () => {
    expect(inviteMissing(null)).toEqual(["first name", "last name", "email"]);
    expect(inviteMissing({ firstName: "Pat", lastName: " ", email: "pat@lease.com" })).toEqual(["last name"]);
    expect(inviteMissing({ firstName: "Pat", lastName: "Lee", email: "pat@lease.com" })).toEqual([]);
    expect(joinFields(["first name", "last name", "email"])).toBe("first name, last name and email");
    expect(joinFields(["email"])).toBe("email");
  });
  test("inviteSummary says when and to whom", () => {
    expect(inviteSummary({ sentAt: null, sentTo: null, sendCount: 0 })).toBe("Not sent yet.");
    const once = inviteSummary({ sentAt: "2026-09-28T16:00:00Z", sentTo: "pat@lease.com", sendCount: 1 });
    expect(once).toBe(`Sent ${formatDate("2026-09-28T16:00:00Z")} to pat@lease.com.`);
    expect(inviteSummary({ sentAt: "2026-09-28T16:00:00Z", sentTo: "pat@lease.com", sendCount: 3 })).toMatch(/\(sent 3 times\)\.$/);
  });
  test("sameRecipient ignores surrounding space and email case", () => {
    expect(sameRecipient({ firstName: "Pat ", lastName: "Lee", email: "PAT@lease.com" }, { firstName: "Pat", lastName: "Lee", email: "pat@lease.com" })).toBe(true);
    expect(sameRecipient(EMPTY_RECIPIENT, { ...EMPTY_RECIPIENT, firstName: "P" })).toBe(false);
  });
});
