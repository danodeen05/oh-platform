import { expect, test } from "vitest";
import { money, relativeTime } from "../format";

test("money", () => { expect(money(123456)).toBe("$1,234.56"); expect(money(0)).toBe("$0.00"); expect(money(null)).toBe("$0.00"); });
test("relativeTime", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  expect(relativeTime("2026-09-27T11:59:30Z", now)).toBe("Just now");
  expect(relativeTime("2026-09-27T11:45:00Z", now)).toBe("15m ago");
  expect(relativeTime("2026-09-27T09:00:00Z", now)).toBe("3h ago");
});
