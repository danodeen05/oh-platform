import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { RefundDialogContent, REFUND_EXPLAINER } from "../support/RefundDialog";

// Task D12: a card refund is always the whole order. The dialog shows the
// total and what happens, and never offers an amount to type.
test("the refund dialog shows the full total and the explainer, and renders no input of any kind", () => {
  const html = renderToStaticMarkup(createElement(RefundDialogContent, { totalCents: 1924, orderNumber: "A100" }));
  expect(html).toContain("$19.24");
  expect(html).toContain(REFUND_EXPLAINER);
  expect(REFUND_EXPLAINER).toBe("This refunds the entire order to the card. Credits and gift card amounts used are restored as store credit.");
  expect(html).not.toMatch(/<input|<textarea|<select|contenteditable/i);
});

test("the refund dialog source has no amount field or money input", () => {
  const src = readFileSync(path.resolve(__dirname, "../support/RefundDialog.tsx"), "utf8");
  expect(src).not.toMatch(/MoneyInput|NumberInput|TextInput|<input|amountCents/);
});

