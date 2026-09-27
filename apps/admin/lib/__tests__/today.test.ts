import { expect, test } from "vitest";
import { attentionRows, type TodayPayload } from "../today";

const base: TodayPayload = { date: "2026-09-27T06:00:00.000Z", ordersToday: 12, activeDiners: 4, openPodCalls: 2, shopToShip: 3, cateringNext7: 1 };

test("manager sees operational rows only, zero counts dropped", () => {
  const rows = attentionRows({ ...base, shopToShip: 0 }, "manager");
  expect(rows.map((r) => r.key)).toEqual(["podCalls", "catering"]);
  expect(rows[0]).toMatchObject({ label: "Open pod calls", count: 2, href: "/kitchen", tone: "alert" });
});

test("owner also sees plan rows; missing countersigner is a single alert", () => {
  const rows = attentionRows({ ...base, unansweredQuestions: 2, countersignerMissing: true, salesCents: 1 }, "owner");
  expect(rows.map((r) => r.key)).toEqual(["podCalls", "shop", "catering", "planQuestions", "countersigner"]);
  expect(rows.find((r) => r.key === "countersigner")).toMatchObject({ label: "Adopt your NDA countersignature", count: 1, href: "/plan-access" });
});

test("the header date is the Denver day, even from the UTC midnight boundary", async () => {
  const { denverDayLabel } = await import("../today");
  expect(denverDayLabel("2026-09-27T06:00:00.000Z")).toBe("Sunday, Sep 27");
  expect(denverDayLabel("2026-12-01T07:00:00.000Z")).toBe("Tuesday, Dec 1");
});
