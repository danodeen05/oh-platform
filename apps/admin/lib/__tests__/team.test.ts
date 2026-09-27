import { describe, expect, test } from "vitest";
import { ROLE_EXPLANATION, sortMembers, type TeamMember } from "../team";

const member = (over: Partial<TeamMember>): TeamMember => ({ userId: "u", email: "a@x.com", name: "A", role: "manager", locked: false, ...over });

describe("sortMembers", () => {
  test("locked owners come before everyone else", () => {
    const members = [
      member({ userId: "1", name: "Bea", role: "manager" }),
      member({ userId: "2", name: "Owner A", role: "owner", locked: true }),
      member({ userId: "3", name: "Cee", role: "station" }),
    ];
    expect(sortMembers(members).map((m) => m.userId)).toEqual(["2", "1", "3"]);
  });

  test("sorts non-owners by name", () => {
    const members = [member({ userId: "1", name: "Zed" }), member({ userId: "2", name: "Amy" })];
    expect(sortMembers(members).map((m) => m.userId)).toEqual(["2", "1"]);
  });

  test("does not mutate the input array", () => {
    const members = [member({ userId: "1", name: "Zed" }), member({ userId: "2", name: "Amy" })];
    sortMembers(members);
    expect(members.map((m) => m.userId)).toEqual(["1", "2"]);
  });
});

describe("ROLE_EXPLANATION", () => {
  test("manager explains what is off-limits", () => {
    expect(ROLE_EXPLANATION.manager).toBe("Day-to-day tools. No plan access, money reports, setup or card refunds.");
  });
  test("station explains it is for shared tablets", () => {
    expect(ROLE_EXPLANATION.station).toBe("Kitchen and Cleaning displays only. For shared tablets.");
  });
});
