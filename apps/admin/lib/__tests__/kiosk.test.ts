import { expect, test } from "vitest";
import { deviceStatus } from "../kiosk";

const now = new Date("2026-09-27T12:00:00Z");

test("status from heartbeat", () => {
  // Field name matches the /kiosk-devices response: lastHeartbeat, not lastSeenAt.
  expect(deviceStatus({ isActive: false, lastHeartbeat: now.toISOString() }, now).label).toBe("Disabled");
  expect(deviceStatus({ isActive: true, lastHeartbeat: null }, now).label).toBe("Never connected");
  expect(deviceStatus({ isActive: true, lastHeartbeat: "2026-09-27T11:59:00Z" }, now)).toMatchObject({ label: "Online", tone: "good" });
  expect(deviceStatus({ isActive: true, lastHeartbeat: "2026-09-27T11:55:00Z" }, now)).toMatchObject({ label: "Stale", tone: "pending" });
  expect(deviceStatus({ isActive: true, lastHeartbeat: "2026-09-27T11:00:00Z" }, now)).toMatchObject({ label: "Offline", tone: "alert" });
});

test("disabled takes priority over how long ago the heartbeat was", () => {
  expect(deviceStatus({ isActive: false, lastHeartbeat: "2026-09-27T11:59:00Z" }, now)).toMatchObject({ label: "Disabled", tone: "neutral" });
});
