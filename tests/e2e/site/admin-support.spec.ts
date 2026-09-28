/**
 * Admin Support queue e2e (Task D12).
 *
 *  1. A case from the contact form (POST /support/cases, anonymous with a
 *     contact) shows in the admin Support list.
 *  2. A member's case (seeded the way Chappy's report_issue stores one: a
 *     "[Chappy] ..." summary on the member's own order) opens to a detail
 *     page with the order (pod label), member and conversation context.
 *  3. The refund dialog shows the full order total and has NO amount field.
 *  4. Give $3 store credit: the case moves to Resolved and the member gets a
 *     300 cent ADMIN credit lot.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here):
 *
 *   E2E_ADMIN_URL=http://localhost:3301 E2E_API_URL=http://localhost:4300 \
 *     node --env-file=.env --test tests/e2e/site/admin-support.spec.ts
 *
 * Needs the worktree API and admin dev servers. Admin dev mode skips Clerk
 * (role owner, or ADMIN_DEV_ROLE), and the API's dev bypass applies while
 * ADMIN_API_KEY is unset; with ADMIN_API_KEY set in .env, pass it as
 * E2E_ADMIN_API_KEY and the spec sends it on its own API calls (never
 * committed). Rows it creates are deleted afterwards. SUPPORT_NOTIFY=log
 * keeps it from texting or emailing anyone.
 *
 * Screenshots (1440 wide) go to E2E_SHOT_DIR when set: d12-admin-support-list,
 * d12-admin-support-detail, d12-admin-support-refund-dialog.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { PrismaClient } from "../../../packages/db/index.js";

const ADMIN = process.env.E2E_ADMIN_URL || "http://localhost:3301";
const API = process.env.E2E_API_URL || "http://localhost:4300";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const KEY = process.env.E2E_ADMIN_API_KEY || "";
const HEADERS: Record<string, string> = { "Content-Type": "application/json", "x-tenant-slug": "oh", ...(KEY ? { "x-admin-api-key": KEY } : {}) };

const prisma = new PrismaClient();
const tag = `e2e-d12-${Date.now()}`;
const created = { cases: [] as string[], users: [] as string[], orders: [] as string[] };
let browser: Browser | null = null;
let memberCaseId = "";
let contactCaseId = "";

async function api(p: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${p}`, { ...init, headers: { ...HEADERS, ...(init.headers || {}) } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  // 1. The contact form path, exactly as the site calls it.
  const contact = await fetch(`${API}/support/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-slug": "oh", "x-forwarded-for": `10.9.${Date.now() % 250}.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ type: "CONTACT", summary: `${tag} contact: do you have gluten free noodles?`, contact: { name: "E2E Contact", email: "e2e-contact@example.com" }, locale: "en" }),
  });
  assert.equal(contact.status, 200, "contact form case");
  contactCaseId = (await contact.json()).caseId;
  created.cases.push(contactCaseId);

  // 2. A member case on the member's own paid order, as Chappy stores it.
  const tenant = await prisma.tenant.findFirst({ where: { slug: "oh" } });
  assert.ok(tenant, "tenant oh");
  const seat = await prisma.seat.findFirst({ where: { label: "B-07", retiredAt: null } });
  const menu = await prisma.menuItem.findFirst({ where: { tenantId: tenant.id } });
  const user = await prisma.user.create({ data: { email: `${tag}@example.com`, name: "Mei E2E", membershipTier: "NOODLE_MASTER" } });
  created.users.push(user.id);
  const order = await prisma.order.create({
    data: {
      orderNumber: `${tag}-A`, tenantId: tenant.id, userId: user.id, totalCents: 1924, paymentStatus: "PAID", status: "COMPLETED",
      stripePaymentId: `pi_${tag.replace(/-/g, "_")}`, seatId: seat?.id ?? null,
      ...(menu ? { items: { create: [{ menuItemId: menu.id, quantity: 1, priceCents: 1799 }] } } : {}),
    },
  });
  created.orders.push(order.id);
  const c = await prisma.supportCase.create({
    data: {
      type: "ORDER_ISSUE", status: "OPEN", summary: `[Chappy] cold: ${tag} my soup arrived cold`, userId: user.id, orderId: order.id, amountCents: 1924, locale: "en",
      transcript: [
        { role: "user", content: "My soup arrived cold." },
        { role: "assistant", content: [{ type: "text", text: "I'm sorry. I've sent this to the team, and they'll follow up soon." }] },
      ],
    },
  });
  memberCaseId = c.id;
  created.cases.push(c.id);
});

after(async () => {
  if (browser) await browser.close();
  await prisma.creditEvent.deleteMany({ where: { userId: { in: created.users } } }).catch(() => {});
  await prisma.creditLot.deleteMany({ where: { userId: { in: created.users } } }).catch(() => {});
  await prisma.supportCase.deleteMany({ where: { id: { in: created.cases } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: created.orders } } });
  await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.$disconnect();
});

async function openPage(): Promise<Page> {
  browser = browser || (await chromium.launch({ args: ["--no-sandbox"] }));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (KEY) await page.route(`${API}/**`, (route) => route.continue({ headers: { ...route.request().headers(), "x-admin-api-key": KEY } }));
  return page;
}
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };

test("the list shows cases from the contact form and from Chappy; the detail has order, member and conversation", async () => {
  const page = await openPage();
  await page.goto(`${ADMIN}/support`, { waitUntil: "networkidle" });
  // At 1440 the list is a table (the phone card list is in the DOM but hidden).
  const table = page.locator("table");
  await table.getByText(`${tag} contact`, { exact: false }).waitFor({ timeout: 30000 });
  await table.getByText(`${tag} my soup arrived cold`, { exact: false }).waitFor();
  await shot(page, "d12-admin-support-list");

  await table.getByRole("link", { name: new RegExp(`${tag} my soup`) }).click();
  await page.waitForURL(`**/support/${memberCaseId}`);
  await page.getByText("Mei E2E").first().waitFor();
  await page.getByText("Noodle Master").waitFor();
  await page.getByText("My soup arrived cold.").waitFor();
  await page.getByText("$19.24").first().waitFor();
  const seat = await prisma.seat.findFirst({ where: { label: "B-07", retiredAt: null } });
  if (seat) await page.getByText(/Pod B-07/).waitFor();
  await shot(page, "d12-admin-support-detail");
  await page.close();
});

test("the refund dialog shows the full total and has no amount field", async () => {
  const page = await openPage();
  await page.goto(`${ADMIN}/support/${memberCaseId}`, { waitUntil: "networkidle" });
  await page.getByTestId("refund-full").click();
  const dialog = page.getByRole("dialog", { name: "Refund full order" });
  await dialog.waitFor();
  await dialog.getByText("This refunds the entire order to the card. Credits and gift card amounts used are restored as store credit.").waitFor();
  assert.equal(await dialog.getByTestId("refund-total").textContent(), "$19.24");
  assert.equal(await dialog.locator("input, textarea, select, [contenteditable]").count(), 0, "no amount field anywhere in the refund dialog");
  await page.waitForTimeout(600); // let the sheet finish its open animation before the screenshot
  await shot(page, "d12-admin-support-refund-dialog");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  // Nothing moved.
  assert.equal((await prisma.order.findUnique({ where: { id: created.orders[0] } }))?.paymentStatus, "PAID");
  await page.close();
});

test("give $3 store credit: the case resolves and the member gets a 300 cent lot", async () => {
  const page = await openPage();
  await page.goto(`${ADMIN}/support/${memberCaseId}`, { waitUntil: "networkidle" });
  await page.getByTestId("give-credit").click();
  await page.getByTestId("credit-amount").fill("3");
  const confirm = page.getByTestId("credit-confirm");
  await confirm.click();
  await page.getByText("Gave $3.00 store credit.").waitFor({ timeout: 15000 });
  await page.getByText("Resolved").first().waitFor();

  const after = await api(`/admin/support/cases/${memberCaseId}`);
  assert.equal(after.status, 200);
  assert.equal(after.body.case.status, "RESOLVED");
  assert.equal(after.body.case.resolution, "STAFF_CREDIT");
  assert.equal(after.body.case.amountCents, 300);
  const lots = await prisma.creditLot.findMany({ where: { userId: created.users[0] } });
  assert.deepEqual(lots.map((l) => [l.source, l.amountCents]), [["ADMIN", 300]], "exactly one lot, no double submit");

  // The list's Resolved filter now has it.
  await page.goto(`${ADMIN}/support`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Resolved" }).click();
  await page.locator("table").getByText(`${tag} my soup arrived cold`, { exact: false }).waitFor();
  await page.close();
});
