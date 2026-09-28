/**
 * Store and gift cards e2e (Task D10).
 *
 *  1. en: /store, /store/cart, /gift-cards, /gift-cards/balance and
 *     /store/scan render; the category filter works; the shelf's primary CTA
 *     scrolls to the shelf; under reduced motion every section still shows.
 *  2. zh-CN: a store cart. Two products from the shelf, a quantity change in
 *     the bag, a guest checkout with shipping; the review shows the SERVER's
 *     totals (they equal the stored order) and the test card pays it; the
 *     order is PAID with an SO- number.
 *  3. es: a gift card bought with the test card (custom amount, Gold face).
 *     The page has no promo code or credit controls at all, and the card is
 *     issued for exactly the amount paid.
 *  4. A 409 CREDIT_SHORT at confirm (the member's credit is drained between
 *     review and payment) shows "You were not charged ..." calmly, the
 *     charge is refunded in full, and the next review re-prices the order
 *     without the credit and pays.
 *  Every page: iPhone 15 metrics, no horizontal overflow, axe (wcag2a/aa)
 *  clean.
 *
 *   E2E_BASE_URL=http://localhost:3100 E2E_API_URL=http://localhost:4100 \
 *     node --env-file=.env --test tests/e2e/site/store.spec.ts
 *
 * Needs the worktree's web (3100) and API (4100) dev servers, Stripe TEST
 * mode, the shop products in the DB (packages/db/seed-shop-products.js) and
 * CLERK_SECRET_KEY for the Clerk development instance (test 4 signs in a
 * throwaway `+clerk_test` user with a one-time sign-in token, as in
 * order.spec.ts). Everything it creates is removed afterwards.
 *
 * Screenshots: with E2E_SHOT_DIR set, the last test saves
 * d10-<route>-<width>-<locale>.png at 390 (en, zh-TW), 360 (es) and 1440 (en).
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Page, type Frame } from "playwright";
import { PrismaClient } from "../../../packages/db/index.js";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3100";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const CLERK_KEY = process.env.CLERK_SECRET_KEY || "";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const AXE = new URL("../../../apps/web/node_modules/axe-core/axe.min.js", import.meta.url).pathname;

const prisma = new PrismaClient();
const tag = `e2e-d10-${Date.now()}`;
const email = `${tag}+clerk_test@example.com`;
let browser: Browser;
let clerkUserId = "";
let dbUserId = "";
const shopOrderIds = new Set<string>();
const giftCardIds = new Set<string>();

async function clerk(p: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.clerk.com/v1${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${CLERK_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Clerk ${p} ${res.status} ${JSON.stringify(body)}`);
  return body;
}

before(async () => {
  assert.ok(STRIPE_KEY.startsWith("sk_test_"), "Stripe must be in TEST mode");
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const products = await prisma.shopProduct.count({ where: { slug: { in: ["chili-oil", "ceramic-noodle-bowl"] }, isAvailable: true } });
  assert.equal(products, 2, "the shop products are seeded (packages/db/seed-shop-products.js)");
});

after(async () => {
  await browser?.close();
  const tryDel = async (label: string, fn: () => Promise<unknown>) => fn().catch((e) => console.log(`[cleanup] ${label}: ${String(e.message).split("\n").pop()}`));
  const orders = await prisma.shopOrder.findMany({ where: { OR: [{ id: { in: [...shopOrderIds] } }, { userId: dbUserId || "none" }] } });
  const numbers = orders.map((o) => o.orderNumber);
  const guestIds = orders.map((o) => o.guestId).filter((g): g is string => Boolean(g));
  await tryDel("supportCase", () => prisma.supportCase.deleteMany({ where: { orderId: { in: numbers } } }));
  await tryDel("shopOrderItem", () => prisma.shopOrderItem.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } }));
  await tryDel("shopOrder", () => prisma.shopOrder.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } }));
  await tryDel("guest", () => prisma.guest.deleteMany({ where: { id: { in: guestIds } } }));
  await tryDel("giftCard", () => prisma.giftCard.deleteMany({ where: { id: { in: [...giftCardIds] } } }));
  if (dbUserId) {
    await tryDel("creditEvent", () => prisma.creditEvent.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("creditLot", () => prisma.creditLot.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("user", () => prisma.user.delete({ where: { id: dbUserId } }));
  }
  if (clerkUserId) await clerk(`/users/${clerkUserId}`, { method: "DELETE" }).catch((e) => console.log(`[cleanup] clerk: ${e.message}`));
  await prisma.$disconnect();
  console.log(`E2E_CLEANED ${orders.length} shop orders, ${giftCardIds.size} gift cards`);
});

function iphone15(): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return d;
}

async function newContext(opts: Parameters<Browser["newContext"]>[0] = iphone15()): Promise<BrowserContext> {
  const ctx = await browser.newContext(opts);
  if (process.env.E2E_DEBUG) {
    ctx.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 300)));
    ctx.on("weberror", (e) => console.log("[pageerror]", e.error().message.slice(0, 2000)));
  }
  ctx.on("response", async (res) => {
    const u = new URL(res.url());
    if (res.request().method() !== "POST" || !res.ok()) return;
    if (u.pathname === "/shop/orders") {
      const body = await res.json().catch(() => null);
      if (body?.id) shopOrderIds.add(body.id);
    }
    if (u.pathname === "/gift-cards") {
      const body = await res.json().catch(() => null);
      if (body?.id) giftCardIds.add(body.id);
    }
  });
  return ctx;
}

/** Hide the Next.js dev-mode badge (dev servers only). */
async function hideDevBadge(page: Page) {
  await page.addInitScript(() => {
    const hide = () => {
      const st = document.createElement("style");
      st.textContent = "nextjs-portal{display:none!important}";
      document.head?.appendChild(st);
    };
    if (document.head) hide();
    else document.addEventListener("DOMContentLoaded", hide);
  });
}

async function noOverflow(page: Page, name: string) {
  const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
  assert.ok(sw <= w, `${name}: document scrollWidth ${sw} > ${w}`);
}

/** Pages the test itself runs under reduced motion (axe leaves their setting alone). */
const reducedPages = new WeakSet<Page>();

/**
 * axe (wcag2a/aa). The shelf's cards reveal on scroll (animation-timeline:
 * view()), so a card below the fold sits at its reveal's start (faded) and
 * axe would blend its text into the page. Audit the final, static state:
 * reduced motion for the audit, then back.
 */
async function axe(page: Page, name: string) {
  const keep = reducedPages.has(page);
  if (!keep) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(250);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 10_000 }).catch(() => undefined);
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: any }).axe.run(
      { exclude: [["iframe"], ["[data-clerk-portal]"], [".cl-rootBox"], ["nextjs-portal"]] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } },
    );
    return r.violations.map((v: any) => `${v.id}: ${v.nodes.slice(0, 3).map((n: any) => `${n.target.join(" ")} [${(n.any?.[0]?.message || "").slice(0, 160)}] ${String(n.html).slice(0, 160)}`).join(" | ")}`);
  });
  if (!keep) await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.deepEqual(violations, [], `${name}: axe violations ${JSON.stringify(violations)}`);
}

/** Taps an element after centering it (the sticky top bar and CTA bar would cover it at the viewport's edges). */
async function tap(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 60_000 });
  await el.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await el.click();
}

async function check(page: Page, name: string, selector: string) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 90_000 });
  // Hydrated before anything is tapped (a tap on server HTML before React attaches is lost).
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await noOverflow(page, name);
  await axe(page, name);
}

async function stripeFrame(page: Page, field = "number"): Promise<Frame> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (!/js\.stripe\.com/.test(frame.url())) continue;
      const input = frame.locator(`input[name="${field}"]`);
      if (await input.isVisible().catch(() => false)) return frame;
      const cardTab = frame.locator('button[value="card"], [data-value="card"]').first();
      if (await cardTab.count().catch(() => 0)) await cardTab.click().catch(() => undefined);
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Stripe card fields never appeared");
}

/** Types the Stripe test card (each field looked up afresh: the Payment Element may re-layout as the number is typed). */
async function payWithTestCard(page: Page, submit: string) {
  for (const [field, value] of [["number", "4242424242424242"], ["expiry", "12 / 34"], ["cvc", "123"]] as const) {
    const frame = await stripeFrame(page, field);
    await frame.locator(`input[name="${field}"]`).fill(value, { timeout: 15_000 });
  }
  for (const frame of page.frames()) {
    const zip = frame.locator('input[name="postalCode"]');
    if (/js\.stripe\.com/.test(frame.url()) && (await zip.isVisible().catch(() => false))) await zip.fill("84101");
  }
  await page.locator(submit).click();
}

async function fillShipping(page: Page, who: { name: string; email: string }) {
  const fill = async (k: string, v: string) => {
    const el = page.locator(`[data-field="${k}"]`);
    await el.fill("");
    await el.fill(v);
  };
  await fill("name", who.name);
  await fill("email", who.email);
  await fill("address1", "50 S Main St");
  await fill("city", "Salt Lake City");
  await fill("state", "UT");
  await fill("zip", "84101");
}

async function waitReady(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const b = document.querySelector(sel) as HTMLButtonElement | null;
    return b && !b.disabled && b.getAttribute("aria-busy") !== "true";
  }, selector, { timeout: 90_000 });
}

/** Signs the context in as the test user with a one-time Clerk sign-in token. */
async function signIn(page: Page, locale: string, where: string) {
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.goto(`${BASE}/${locale}${where}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true, null, { timeout: 60_000 });
  await page.evaluate(async (ticket) => {
    const Clerk = (window as unknown as { Clerk: any }).Clerk;
    const si = await Clerk.client.signIn.create({ strategy: "ticket", ticket });
    await Clerk.setActive({ session: si.createdSessionId });
  }, token);
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user), null, { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------

test("en: the store, bag, scan and gift-card pages render, filter and hold up under reduced motion", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  reducedPages.add(page);
  await page.goto(`${BASE}/en/store`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await check(page, "store", "[data-product-grid]");
  // Reduced motion: every product card and the gift band are visible.
  const cards = page.locator("[data-product]");
  assert.ok((await cards.count()) >= 8, "the shelf lists the products");
  for (let i = 0; i < (await cards.count()); i++) assert.ok(await cards.nth(i).isVisible(), `card ${i} visible`);
  assert.ok(await page.locator("#store-gift").isVisible());
  // The C6 imagery: the hero is store-interior, the bowl is bowl-empty, the chopsticks are chopsticks.
  assert.ok(await page.locator('[data-store-page] img[src*="/site/store-interior"]').count(), "hero is store-interior");
  assert.ok(await page.locator('[data-product="ceramic-noodle-bowl"] img[src*="/site/bowl-empty"]').count(), "bowl uses bowl-empty");
  assert.ok(await page.locator('[data-product="bamboo-chopsticks"] img[src*="/site/chopsticks"]').count(), "chopsticks use chopsticks");
  assert.equal(await page.locator('img[src*="placeholder.png"]').count(), 0, "no placeholder.png");
  // Primary CTA: to the shelf.
  await page.locator("[data-store-cta]").click();
  await page.waitForFunction(() => location.hash === "#shelf");
  // The filter.
  await page.locator('[data-category="APPAREL"]').click();
  assert.equal(await page.locator('[data-category="APPAREL"]').getAttribute("aria-pressed"), "true");
  await page.waitForFunction(() => document.querySelectorAll("[data-product]").length === 2);
  // A sized product needs a size first.
  await page.locator('[data-product="classic-tshirt"] button').first().click();
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ state: "visible" });
  await sheet.locator("[data-add-to-bag]").click();
  await sheet.getByRole("alert").waitFor();
  await sheet.locator('[data-size="M"]').click();
  await axe(page, "product sheet");
  await sheet.locator("[data-add-to-bag]").click();
  await sheet.waitFor({ state: "hidden" });
  await page.locator("[data-bag-bar]").waitFor({ state: "visible" });
  await noOverflow(page, "store with bag bar");

  await page.locator("[data-bag-bar]").click();
  await page.waitForURL(/\/en\/store\/cart$/);
  await check(page, "cart", '[data-cart-line="classic-tshirt"]');
  assert.match((await page.locator('[data-cart-line="classic-tshirt"]').textContent()) || "", /Size M/);
  await page.locator('[data-cart-line="classic-tshirt"] [data-remove]').click();
  await check(page, "cart empty", "[data-cart-empty]");

  await page.goto(`${BASE}/en/gift-cards`, { waitUntil: "domcontentloaded" });
  await check(page, "gift-cards", "[data-gift-cards-page]");
  for (const k of ["delivery", "spend", "discounts", "balance"]) assert.ok(await page.locator(`[data-faq="${k}"]`).isVisible(), `faq ${k}`);
  assert.ok(await page.locator('[data-gift-face] img[src*="/site/bowl-flatlay"]').count(), "the card visual is bowl-flatlay");
  await page.locator('[data-preset="75"]').click();
  await page.waitForURL(/\/en\/gift-cards\/purchase\?amount=75/);
  await check(page, "gift purchase amount", '[data-gift-step="amount"]');
  assert.equal(await page.locator('[data-amount="75"]').getAttribute("aria-checked"), "true", "the preset carries over");

  await page.goto(`${BASE}/en/gift-cards/balance`, { waitUntil: "domcontentloaded" });
  await check(page, "balance", "[data-gift-balance]");
  await page.locator('[data-field="balanceCode"]').fill("ABCD");
  await page.locator("[data-balance-check]").click();
  await page.locator("[data-gift-balance] [role=alert]").waitFor();

  await page.goto(`${BASE}/en/store/scan`, { waitUntil: "domcontentloaded" });
  await check(page, "scan", "[data-store-scan]");
  await page.locator('[data-field="tag"]').fill("oh-chili-oil");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/en\/store\/item\/OH-CHILI-OIL/);
  await check(page, "item", '[data-store-item="chili-oil"]');
  await ctx.close();
});

test("zh-CN: a store cart checks out as a guest with the server's totals and the test card", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await page.goto(`${BASE}/zh-CN/store`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await check(page, "zh-CN store", "[data-product-grid]");
  assert.match((await page.locator('[data-product="chili-oil"]').textContent()) || "", /招牌辣油/, "the product's own zh-CN name");
  await page.locator('[data-product="chili-oil"] [data-quick-add]').click();
  await page.locator('[data-product="ceramic-noodle-bowl"] [data-quick-add]').click();
  await page.locator("[data-bag-bar]").click();
  await page.waitForURL(/\/zh-CN\/store\/cart$/);
  await check(page, "zh-CN cart", '[data-cart-line="chili-oil"]');
  await page.locator('[data-cart-line="chili-oil"] [data-inc]').click();
  assert.equal(await page.locator('[data-cart-line="chili-oil"] [data-qty]').textContent(), "2");
  await page.locator("[data-checkout-cta]").click();
  await page.waitForURL(/\/zh-CN\/store\/checkout$/);
  await check(page, "zh-CN checkout", "[data-store-checkout]");
  // No client shipping or tax before the server prices it.
  assert.equal(await page.locator("[data-total]").count(), 0);

  // Review with a missing field: the page says what to fix.
  await page.locator("[data-review]").click();
  await page.locator('[data-store-alert="error"]').waitFor();
  await fillShipping(page, { name: "Mei Guest", email: `${tag}-guest@example.com` });
  await page.locator("[data-review]").click();
  await page.locator("[data-store-pay]").waitFor({ timeout: 60_000 });
  await page.locator("[data-total]").waitFor();
  const shownTotal = Number(await page.locator("[data-total]").getAttribute("data-cents"));
  const orderId = [...shopOrderIds].pop()!;
  const created = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  assert.ok(created, "the order exists");
  assert.equal(created!.subtotalCents, 1499 * 2 + 4200, "server subtotal from the product rows");
  assert.equal(created!.shippingCents, 899, "under $75 ships for $8.99 (server rule)");
  assert.equal(shownTotal, created!.totalCents, "the page shows the server's total");
  assert.match(created!.orderNumber, /^SO-/);
  assert.ok(created!.guestId, "owned by the guest session");
  await noOverflow(page, "zh-CN checkout priced");
  await axe(page, "zh-CN checkout priced");

  // Fix round 1: the first confirm after Stripe succeeds is lost on the network; the page
  // shows "Payment received" and retries with the same PaymentIntent (never Pay again).
  let dropped = 0;
  const confirmIds: string[] = [];
  await page.route(/\/shop\/orders\/[^/]+\/confirm-payment$/, async (route) => {
    confirmIds.push(JSON.parse(route.request().postData() || "{}").paymentIntentId);
    if (dropped++ === 0) return route.abort("connectionreset");
    return route.continue();
  });
  await waitReady(page, "[data-pay-submit]");
  await payWithTestCard(page, "[data-pay-submit]");
  await page.locator('[data-payment-received="finishing"]').waitFor({ state: "attached", timeout: 60_000 });
  await page.waitForURL(/\/zh-CN\/store\/confirmation\/SO-/, { timeout: 90_000 });
  assert.ok(confirmIds.length >= 2 && confirmIds.every((id) => id === confirmIds[0] && id?.startsWith("pi_")), `retried with one PaymentIntent: ${confirmIds}`);
  await check(page, "zh-CN confirmation", "[data-store-confirmation]");
  assert.equal(await page.locator("[data-order-number]").textContent(), created!.orderNumber);
  const paid = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  assert.equal(paid?.paymentStatus, "PAID");
  assert.ok(paid?.stripePaymentId?.startsWith("pi_"));
  const bag = await page.evaluate(() => localStorage.getItem("oh-shop-cart"));
  assert.equal(bag, "[]", "the bag is emptied");
  await ctx.close();
});

test("es: a gift card bought with the test card, with no promo or credit controls", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/create-payment-intent$|\/gift-cards$/.test(r.url())) bodies.push(r.postData() || "");
  });
  await page.goto(`${BASE}/es/gift-cards/purchase`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await check(page, "es gift amount", '[data-gift-step="amount"]');
  // Out of range: refused before anything is created.
  await page.locator('[data-field="customAmount"]').fill("600");
  await page.locator("[data-gift-next]").click();
  await page.locator("[data-gift-alert]").waitFor();
  await page.locator('[data-field="customAmount"]').fill("35");
  await page.locator('[data-design="gold"]').click();
  assert.equal(await page.locator('[data-gift-face="gold"]').count() > 0, true);
  await page.locator("[data-gift-next]").click();
  await check(page, "es gift recipient", '[data-gift-step="recipient"]');
  await page.locator('[data-field="recipientName"]').fill("Lucía");
  await page.locator('[data-field="recipientEmail"]').fill(`${tag}-gift@example.com`);
  await page.locator('[data-field="message"]').fill("Para un tazón en tu cumpleaños.");
  await page.locator("[data-gift-next]").click();
  await page.locator("[data-gift-summary]").waitFor();
  // No promo code or credit controls anywhere on a gift card.
  assert.equal(await page.locator("[data-savings-panel], [data-store-credits], [role=switch]").count(), 0, "no credit toggle");
  assert.equal(await page.locator('input[name*="promo" i], [data-field*="promo" i]').count(), 0, "no promo field");
  assert.ok(await page.locator("[data-no-discounts]").isVisible());
  assert.equal(Number(await page.locator("[data-total]").getAttribute("data-cents")), 3500);
  await waitReady(page, "[data-gift-pay]");
  await check(page, "es gift pay", "[data-gift-summary]");
  await payWithTestCard(page, "[data-gift-pay]");
  await page.locator("[data-gift-done]").waitFor({ timeout: 90_000 });
  await check(page, "es gift done", "[data-gift-done]");
  const code = (await page.locator("[data-gift-code]").textContent())?.trim() || "";
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const card = await prisma.giftCard.findUnique({ where: { code } });
  assert.ok(card, "the card was issued");
  giftCardIds.add(card!.id);
  assert.equal(card!.amountCents, 3500);
  assert.equal(card!.balanceCents, 3500);
  assert.equal(card!.designId, "gold");
  assert.ok(card!.stripePaymentId?.startsWith("pi_"), "funded by a verified PaymentIntent");
  for (const b of bodies) assert.doesNotMatch(b, /promo|credit/i, `no promo or credit fields sent: ${b}`);
  await ctx.close();
});

test("a 409 CREDIT_SHORT at confirm says the visitor was not charged, refunds, and the next review re-prices", async () => {
  assert.ok(CLERK_KEY.startsWith("sk_test_"), "CLERK_SECRET_KEY must be the Clerk development key");
  const user = await clerk("/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Ana", last_name: "E2E", skip_password_requirement: true }) });
  clerkUserId = user.id;
  const row = await prisma.user.create({ data: { email: email.toLowerCase(), name: "Ana E2E" } });
  dbUserId = row.id;
  const lot = await prisma.creditLot.create({ data: { userId: dbUserId, source: "ADMIN", amountCents: 500, remainingCents: 500, expiresAt: new Date(Date.now() + 60 * 864e5), note: tag } });

  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await signIn(page, "en", "/store");
  await page.goto(`${BASE}/en/store`, { waitUntil: "networkidle" });
  await page.locator('[data-product="chili-oil"] [data-quick-add]').click();
  await page.locator("[data-bag-bar]").waitFor();
  await page.goto(`${BASE}/en/store/checkout`, { waitUntil: "networkidle" });
  await page.locator("[data-store-checkout]").waitFor();
  await fillShipping(page, { name: "Ana E2E", email });
  const toggle = page.locator("[data-store-credits] [role=switch]");
  await page.waitForFunction(() => {
    const b = document.querySelector("[data-store-credits] [role=switch]") as HTMLButtonElement | null;
    return b && !b.disabled;
  }, null, { timeout: 60_000 });
  await tap(page, "[data-store-credits] [role=switch]");
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  await page.locator("[data-review]").click();
  await page.locator("[data-store-pay]").waitFor({ timeout: 60_000 });
  const first = await prisma.shopOrder.findUnique({ where: { id: [...shopOrderIds].pop()! } });
  assert.equal(first?.creditsApplied, 500, "the credit is recorded, not spent");
  assert.equal((await prisma.creditLot.findUnique({ where: { id: lot.id } }))?.remainingCents, 500, "nothing spent before payment");

  // The credit goes away between review and payment.
  await prisma.creditLot.update({ where: { id: lot.id }, data: { remainingCents: 0 } });
  await waitReady(page, "[data-pay-submit]");
  await payWithTestCard(page, "[data-pay-submit]");
  const alert = page.locator('[data-store-alert="calm"]');
  await alert.waitFor({ timeout: 90_000 });
  assert.equal((await alert.textContent())?.trim(), "You were not charged. Your credit changed, please review and pay again.");
  await noOverflow(page, "credit short");
  await axe(page, "credit short");
  const after409 = await prisma.shopOrder.findUnique({ where: { id: first!.id } });
  assert.equal(after409?.paymentStatus, "PENDING", "the first order is not paid");
  const piId = await (async () => {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents?limit=20`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
    const body = await res.json();
    return (body.data as { id: string; metadata: Record<string, string> }[]).find((p) => p.metadata?.shopOrderId === first!.id)?.id;
  })();
  assert.ok(piId, "the charged PaymentIntent");
  const refunds = await (await fetch(`https://api.stripe.com/v1/refunds?payment_intent=${piId}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } })).json();
  assert.equal(refunds.data.length, 1, "refunded once");
  assert.equal(refunds.data[0].amount, first!.totalCents, "refunded in full");
  assert.ok(await page.locator("[data-review]").isVisible(), "back to Review order");
  assert.equal(await page.locator("[data-locked]").count(), 0, "the form is editable again");

  // Review again: the server prices it without the credit, and it pays.
  await page.locator("[data-review]").click();
  await page.locator("[data-store-pay]").waitFor({ timeout: 60_000 });
  const second = await prisma.shopOrder.findUnique({ where: { id: [...shopOrderIds].pop()! } });
  assert.notEqual(second?.id, first!.id, "a fresh order");
  assert.equal(second?.creditsApplied, 0);
  assert.equal(Number(await page.locator("[data-total]").getAttribute("data-cents")), second!.totalCents);
  await waitReady(page, "[data-pay-submit]");
  await payWithTestCard(page, "[data-pay-submit]");
  await page.waitForURL(/\/en\/store\/confirmation\/SO-/, { timeout: 90_000 });
  assert.equal((await prisma.shopOrder.findUnique({ where: { id: second!.id } }))?.paymentStatus, "PAID");
  await ctx.close();
});

test("screenshots: store and gift-card pages at 390 (en, zh-TW), 360 (es) and 1440 (en)", { skip: !SHOTS }, async () => {
  const runs: { locale: string; width: number; opts: Parameters<Browser["newContext"]>[0] }[] = [
    { locale: "en", width: 390, opts: iphone15() },
    { locale: "zh-TW", width: 390, opts: iphone15() },
    { locale: "es", width: 360, opts: { ...iphone15(), viewport: { width: 360, height: 780 }, screen: { width: 360, height: 780 } } },
    { locale: "en", width: 1440, opts: { viewport: { width: 1440, height: 900 } } },
  ];
  for (const run of runs) {
    const ctx = await newContext(run.opts);
    const page = await ctx.newPage();
    await hideDevBadge(page);
    const shot = async (name: string, full = true) => {
      // A full-page capture shows every section in its final state (scroll reveals would be mid-way).
      if (full) await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(900);
      await noOverflow(page, `${name} ${run.width} ${run.locale}`);
      await page.screenshot({ path: path.join(SHOTS, `d10-${name}-${run.width}-${run.locale}.png`), fullPage: full });
      if (full) await page.emulateMedia({ reducedMotion: "no-preference" });
    };
    const go = async (p: string, sel: string) => {
      await page.goto(`${BASE}/${run.locale}${p}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator(sel).first().waitFor({ state: "visible", timeout: 90_000 });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    };
    await go("/store", "[data-product-grid]");
    await page.locator('[data-product="chili-oil"] [data-quick-add]').click();
    await page.locator('[data-product="bamboo-chopsticks"] [data-quick-add]').click();
    await page.locator("[data-bag-bar]").waitFor();
    await shot("store");
    await page.locator('[data-product="comfort-hoodie"] button').first().click();
    await page.getByRole("dialog").locator('[data-size="L"]').click();
    await shot("store-sheet", false);
    await page.keyboard.press("Escape");
    await go("/store/cart", '[data-cart-line="chili-oil"]');
    await shot("cart");
    await go("/store/checkout", "[data-store-checkout]");
    await shot("checkout");
    await go("/store/scan", "[data-store-scan]");
    await shot("scan");
    await go("/store/item/OH-CHILI-OIL", '[data-store-item="chili-oil"]');
    await shot("item");
    await go("/store/confirmation/SO-SAMPLE01?placed=1", "[data-store-confirmation]");
    await shot("confirmation");
    await go("/gift-cards", "[data-gift-cards-page]");
    await shot("gift-cards");
    await go("/gift-cards/purchase?amount=50&design=dark", '[data-gift-step="amount"]');
    await shot("gift-purchase");
    await page.locator("[data-gift-next]").click();
    await page.locator('[data-field="recipientName"]').fill("Mei");
    await page.locator('[data-field="recipientEmail"]').fill("mei@example.com");
    await shot("gift-recipient");
    await go("/gift-cards/balance", "[data-gift-balance]");
    await shot("gift-balance");
    await page.evaluate(() => localStorage.removeItem("oh-shop-cart"));
    await ctx.close();
  }
});
