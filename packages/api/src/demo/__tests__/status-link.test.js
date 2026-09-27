/** The guest's texts carry the live order status link. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { orderConfirmationText, orderStatusUrl } from "../../notifications.js";

const order = { orderNumber: "ORD-XYZ-000123", kitchenOrderNumber: "A12", totalCents: 2346, orderQrCode: "ORDER-abc-1" };

test("status link uses WEB_APP_URL and the order's code", () => {
  assert.equal(orderStatusUrl(order, "en", { WEB_APP_URL: "https://devwebapp.ohbeef.com/" }), "https://devwebapp.ohbeef.com/en/order/status?orderQrCode=ORDER-abc-1");
  assert.equal(orderStatusUrl(order, "zh-TW", {}), "https://www.ohbeef.com/zh-TW/order/status?orderQrCode=ORDER-abc-1");
  assert.equal(orderStatusUrl({ ...order, orderQrCode: null }), null);
});

test("confirmation text links to the live status page, no em dashes", () => {
  const text = orderConfirmationText(order, {});
  assert.match(text, /^Oh! Order #A12 confirmed\. Total: \$23\.46\. Follow it live, crack your fortune cookie and order more to your pod: https:\/\/www\.ohbeef\.com\/en\/order\/status\?orderQrCode=ORDER-abc-1$/);
  assert.ok(!text.includes("—"));
  assert.match(orderConfirmationText({ ...order, orderQrCode: null }, {}), /Show this text at check-in\.$/);
});
