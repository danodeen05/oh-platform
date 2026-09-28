import { describe, expect, it } from "vitest";
import { orderTrackHref } from "../OrdersHistory";

describe("orderTrackHref (D8 carried fix)", () => {
  it("a live order with a QR code tracks on the status page", () => {
    expect(orderTrackHref({ id: "o1", status: "PREPPING", orderQrCode: "ORDER-1" }, "zh-TW")).toBe(
      "/zh-TW/order/status?orderQrCode=ORDER-1",
    );
  });

  it("a live order with no QR code still gets Track it, by id on the confirmation page", () => {
    for (const status of ["PAID", "QUEUED", "PREPPING", "READY", "SERVING"]) {
      expect(orderTrackHref({ id: "o 2", status, orderQrCode: null }, "en")).toBe("/en/order/confirmation?orderId=o%202");
    }
  });

  it("a finished or cancelled order has no track link (it offers Order again)", () => {
    for (const status of ["COMPLETED", "CANCELLED", "PENDING_PAYMENT"]) {
      expect(orderTrackHref({ id: "o3", status, orderQrCode: "ORDER-3" }, "en")).toBe(null);
    }
  });
});
