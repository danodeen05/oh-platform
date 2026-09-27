import { expect, test } from "vitest";
import { orderMeta, orderTitle, statusLabel, statusTone, STEP_LABELS } from "../orders";

test("status labels and tones cover every OrderStatus", () => {
  const all = ["PENDING_PAYMENT", "PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED", "CANCELLED"];
  for (const s of all) { expect(statusLabel(s)).not.toBe(s); expect(statusTone(s)).toBeTruthy(); }
  expect(statusTone("READY")).toBe("good");
  expect(statusTone("CANCELLED")).toBe("alert");
  expect(statusLabel("PENDING_PAYMENT")).toBe("Awaiting payment");
});
test("timeline steps have labels", () => {
  for (const k of ["createdAt", "paidAt", "arrivedAt", "queuedAt", "prepStartTime", "readyTime", "deliveredAt", "completedTime"]) expect(STEP_LABELS[k]).toBeTruthy();
});
test("row title and meta skip missing parts", () => {
  const now = new Date("2026-09-27T20:00:00Z");
  expect(orderTitle({ orderNumber: "A100", kitchenOrderNumber: "12" })).toBe("#A100 · K12");
  expect(orderTitle({ orderNumber: "A100", kitchenOrderNumber: null })).toBe("#A100");
  expect(orderMeta({ customerName: "Mei", locationName: "SoHo", seatNumber: 7, createdAt: "2026-09-27T19:55:00Z" }, now)).toBe("Mei · SoHo · Pod 7 · 5m ago");
  expect(orderMeta({ customerName: "Guest", locationName: null, seatNumber: null, createdAt: "2026-09-27T19:59:30Z" }, now)).toBe("Guest · Just now");
});
test("enum-ish values read as words", async () => {
  const { sourceLabel } = await import("../orders");
  expect(sourceLabel("KIOSK")).toBe("Kiosk");
  expect(sourceLabel("discover")).toBe("Discover");
  expect(sourceLabel(null)).toBe("");
});
