/**
 * Payment integrity e2e (Task A7).
 *
 *  1. A web order paid with the Stripe test card 4242 4242 4242 4242 on the
 *     real payment page reaches PAID (the page confirms through
 *     POST /orders/:id/confirm-payment; the API verifies the PaymentIntent).
 *  2. A direct fetch(PATCH /orders/:id {paymentStatus: "PAID"}) from the page
 *     context is refused with 400, and the order stays unpaid.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here):
 *
 *   E2E_BASE_URL=http://localhost:3100 E2E_API_URL=http://localhost:4100 \
 *     node --test tests/e2e/site/payment-integrity.spec.ts
 *
 * Needs the worktree web (3100) and API (4100) running, Stripe in TEST mode,
 * and dine-in ordering on. The order is a guest order (no Clerk sign-in
 * needed); the guest session is the server-issued cookie the site uses.
 * Rows it creates are printed as E2E_CREATED for cleanup.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page, type Frame } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3100";
const API = process.env.E2E_API_URL || "http://localhost:4100";
const HEADERS = { "Content-Type": "application/json", "x-tenant-slug": "oh" };

const created: { orders: string[]; guests: string[] } = { orders: [], guests: [] };
let browser: Browser | null = null;

after(async () => {
  if (browser) await browser.close();
  console.log(`E2E_CREATED ${JSON.stringify(created)}`);
});

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...HEADERS, ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** A guest session plus an unpaid, server-priced web order for one Classic bowl. */
async function guestOrder() {
  const guest = await api("/guests", { method: "POST", body: JSON.stringify({ name: "E2E Guest" }) });
  assert.equal(guest.status, 200, "guest session");
  created.guests.push(guest.body.id);

  const locations = await api("/locations");
  const location = locations.body[0];
  const menu = await api("/menu");
  const items = Array.isArray(menu.body) ? menu.body : menu.body.items;
  const bowl = items.find((i: { name: string; categoryType: string }) => i.categoryType === "MAIN" && /^Classic Beef Noodle Soup$/.test(i.name));
  assert.ok(bowl, "a Classic bowl on the menu");

  const order = await api("/orders", {
    method: "POST",
    body: JSON.stringify({ locationId: location.id, tenantId: location.tenantId, items: [{ menuItemId: bowl.id, quantity: 1 }], guestId: guest.body.id }),
  });
  assert.equal(order.status, 200, `order created: ${JSON.stringify(order.body)}`);
  created.orders.push(order.body.id);
  assert.equal(order.body.paymentStatus, "PENDING");
  assert.ok(order.body.amountDueCents > 0);
  return { guest: guest.body, order: order.body };
}

/** The order's payment status as the API sees it (confirm-payment on a PAID order is a no-op read). */
async function paymentStatusOf(orderId: string) {
  const res = await api(`/orders/${orderId}/confirm-payment`, { method: "POST", body: "{}" });
  return res.status === 200 ? res.body.paymentStatus : `unpaid (${res.status} ${res.body?.error})`;
}

async function openPaymentPage(page: Page, order: { id: string; orderNumber: string; totalCents: number }, guest: { sessionToken: string }) {
  const url = new URL(BASE);
  await page.context().addCookies([{ name: "oh_guest_session", value: guest.sessionToken, domain: url.hostname, path: "/", sameSite: "Lax" }]);
  await page.goto(`${BASE}/en/order/payment?orderId=${order.id}&orderNumber=${order.orderNumber}&total=${order.totalCents}`, { waitUntil: "domcontentloaded" });
}

/**
 * The Payment Element's frame, with its "Card" tab selected (the account has
 * other methods enabled, and Stripe may preselect one of them).
 */
async function stripeFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (!/js\.stripe\.com/.test(frame.url())) continue;
      const cardTab = frame.getByRole("tab", { name: /^Card$/i }).or(frame.locator('button[value="card"], [data-value="card"]')).first();
      if (await cardTab.count().catch(() => 0)) await cardTab.click().catch(() => undefined);
      const number = frame.locator('input[name="number"]');
      if (await number.isVisible().catch(() => false)) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Stripe card fields never appeared");
}

test("a direct PATCH {paymentStatus: 'PAID'} from the page context is refused with 400", async () => {
  browser = browser || (await chromium.launch({ args: ["--no-sandbox"] }));
  const { guest, order } = await guestOrder();
  const page = await browser.newPage();
  await openPaymentPage(page, order, guest);

  const result = await page.evaluate(
    async ({ api, id }) => {
      const res = await fetch(`${api}/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "PAID" }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { api: API, id: order.id },
  );
  assert.equal(result.status, 400);
  assert.match(String(result.body?.error), /unknown field: paymentStatus/);
  assert.notEqual(await paymentStatusOf(order.id), "PAID");
  await page.close();
});

test("a web order paid with the Stripe test card reaches PAID", async () => {
  browser = browser || (await chromium.launch({ args: ["--no-sandbox"] }));
  const { guest, order } = await guestOrder();
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.log("[page error]", err.message));
  await openPaymentPage(page, order, guest);

  // Guest checkout needs a name before the pay button is enabled.
  const name = page.locator('input[autocomplete="name"], input[name="name"], input[placeholder*="name" i]').first();
  await name.waitFor({ timeout: 60_000 });
  await name.fill("E2E Guest");

  const frame = await stripeFrame(page);
  await frame.locator('input[name="number"]').fill("4242424242424242");
  await frame.locator('input[name="expiry"]').fill("12 / 34");
  await frame.locator('input[name="cvc"]').fill("123");
  const zip = frame.locator('input[name="postalCode"]');
  if (await zip.count()) await zip.fill("84101");

  const pay = page.getByRole("button", { name: /^Pay\b/i }).last();
  await pay.waitFor({ timeout: 30_000 });
  await pay.click();

  await page.waitForURL(/\/order\/confirmation/, { timeout: 90_000 });
  assert.equal(await paymentStatusOf(order.id), "PAID");
  await page.close();
});
