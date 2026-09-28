/**
 * Order flow e2e (Task D5): location, bowl, arrival, pod, savings, pay.
 *
 *  1. en: a best-pod order paid with the Stripe test card reaches the status
 *     page, and the pod label shown on the pay step is the order's pod.
 *  2. zh-TW: "Choose my own" picks A-03 on the CombMap, and the order has A-03.
 *  3. en: a seeded FREE_BOWL reward makes the bowl line $0.00 and the total
 *     equal to the tax alone (ruling Q2: the reward comes off before tax, so a
 *     bowl-only order is $0.00 tax and $0.00 total); it pays with no card.
 *  4. Changing the locale mid-flow keeps the cart (sessionStorage
 *     `oh-order-draft`).
 *  5. Signed out: the bowl builder is browsable, and the arrival step asks
 *     the guest to sign in with the draft kept.
 *  Every step: iPhone 15 metrics, no horizontal overflow, the dock hidden
 *  and a Back chevron in the top bar, axe (wcag2a/aa) clean, and all content
 *  visible under reduced motion (test 3 runs with it).
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here):
 *
 *   E2E_BASE_URL=http://localhost:3300 E2E_API_URL=http://localhost:4300 \
 *     node --env-file=.env --test tests/e2e/site/order.spec.ts
 *
 * Needs the lane's web (3300) and API (4300) dev servers, Stripe in TEST
 * mode, dine-in ordering on, and CLERK_SECRET_KEY for the Clerk DEVELOPMENT
 * instance (from .env). Sign-in: a throwaway `+clerk_test` user is created
 * through the Clerk Backend API, and each browser context signs in with a
 * one-time sign-in token (`signIn.create({strategy: "ticket"})`), the same
 * approach as Task A10. The matching DB user, a FREE_BOWL reward and a
 * credit lot are seeded in the lane DB. Everything it creates (orders, pod
 * holds, the user, its lots and reward, and the Clerk user) is removed
 * afterwards.
 *
 * Screenshots: with E2E_SHOT_DIR set, the last test walks every step at 390
 * (en, zh-TW), 360 (es) and 1440 (en) and saves d5-<step>-<width>-<locale>.png.
 */
import { test, after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Page, type Frame } from "playwright";
import { PrismaClient } from "../../../packages/db/index.js";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3300";
const API = process.env.E2E_API_URL || "http://localhost:4300";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const CLERK_KEY = process.env.CLERK_SECRET_KEY || "";
const AXE = new URL("../../../apps/web/node_modules/axe-core/axe.min.js", import.meta.url).pathname;
const CITY_CREEK = "cmip6jbz700022nnnxxpmm5hf";

const prisma = new PrismaClient();
const tag = `e2e-d5-${Date.now()}`;
const email = `${tag}+clerk_test@example.com`;
let browser: Browser;
let clerkUserId = "";
let dbUserId = "";
let rewardId = "";
// Fix round 1: a referrer (whose ?ref= code the test user arrives with) and the meal gift they paid forward.
let referrerId = "";
let referralCode = "";
let mealGiftId = "";
const createdOrders = new Set<string>();

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
  assert.ok(CLERK_KEY.startsWith("sk_test_"), "CLERK_SECRET_KEY must be the Clerk development key");
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const user = await clerk("/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Mei", last_name: "E2E", skip_password_requirement: true }) });
  clerkUserId = user.id;
  const row = await prisma.user.create({ data: { email: email.toLowerCase(), name: "Mei E2E", membershipTier: "NOODLE_MASTER" } });
  dbUserId = row.id;
  const reward = await prisma.reward.create({ data: { userId: dbUserId, type: "FREE_BOWL", issuedFor: tag, windowEndsAt: new Date(Date.now() + 14 * 864e5) } });
  rewardId = reward.id;
  // $7.00 of credit, $2.00 of it expiring in 5 days (the "expiring soon" hint).
  await prisma.creditLot.createMany({
    data: [
      { userId: dbUserId, source: "ADMIN", amountCents: 200, remainingCents: 200, expiresAt: new Date(Date.now() + 5 * 864e5), note: tag },
      { userId: dbUserId, source: "ADMIN", amountCents: 500, remainingCents: 500, expiresAt: new Date(Date.now() + 60 * 864e5), note: tag },
    ],
  });
  const referrer = await prisma.user.create({ data: { email: `${tag}-referrer@example.com`, name: "Lin Referrer" } });
  referrerId = referrer.id;
  referralCode = referrer.referralCode;
  // A funded gift, dated first so it is the location's next one (FIFO).
  const gift = await prisma.mealGift.create({
    data: {
      giverId: referrerId,
      locationId: CITY_CREEK,
      amountCents: 2000,
      messageFromGiver: "Enjoy the soup.",
      status: "PENDING",
      paidAt: new Date(),
      stripePaymentIntentId: `pi_${tag.replace(/-/g, "_")}_gift`,
      createdAt: new Date("2020-01-01T00:00:00Z"),
      expiresAt: new Date(Date.now() + 864e5),
    },
  });
  mealGiftId = gift.id;
});

after(async () => {
  await browser?.close();
  const orders = await prisma.order.findMany({ where: { OR: [{ id: { in: [...createdOrders] } }, { userId: dbUserId || "none" }] } });
  const seatIds = orders.flatMap((o) => [o.seatId, o.dualPartnerSeatId]).filter((s): s is string => Boolean(s));
  if (seatIds.length) await prisma.seat.updateMany({ where: { id: { in: seatIds } }, data: { status: "AVAILABLE" } });
  const ids = orders.map((o) => o.id);
  const tryDel = async (label: string, fn: () => Promise<unknown>) => fn().catch((e) => console.log(`[cleanup] ${label}: ${e.message.split("\n").pop()}`));
  if (dbUserId) {
    await tryDel("creditEvent", () => prisma.creditEvent.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("creditLot", () => prisma.creditLot.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("reward", () => prisma.reward.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("userBadge", () => prisma.userBadge.deleteMany({ where: { userId: dbUserId } }));
  }
  if (mealGiftId) {
    await tryDel("mealGiftChain", () => prisma.mealGiftChain.deleteMany({ where: { mealGiftId } }));
    await tryDel("mealGift", () => prisma.mealGift.delete({ where: { id: mealGiftId } }));
  }
  await tryDel("orderItem", () => prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }));
  await tryDel("order", () => prisma.order.deleteMany({ where: { id: { in: ids } } }));
  if (dbUserId) await tryDel("user", () => prisma.user.delete({ where: { id: dbUserId } }));
  if (referrerId) {
    await tryDel("referrer lots", () => prisma.creditLot.deleteMany({ where: { userId: referrerId } }));
    await tryDel("referrer events", () => prisma.creditEvent.deleteMany({ where: { userId: referrerId } }));
    await tryDel("referrer", () => prisma.user.delete({ where: { id: referrerId } }));
  }
  if (clerkUserId) await clerk(`/users/${clerkUserId}`, { method: "DELETE" }).catch((e) => console.log(`[cleanup] clerk: ${e.message}`));
  await prisma.$disconnect();
  console.log(`E2E_CLEANED ${ids.length} orders`);
});

// The API allows 100 requests a minute per IP, and every test here is one
// visitor's whole order from the same 127.0.0.1: pause between tests so one
// test's traffic doesn't rate-limit the next. E2E_PACE_MS=0 turns it off.
const PACE_MS = Number(process.env.E2E_PACE_MS ?? 35_000);
afterEach(() => new Promise((r) => setTimeout(r, PACE_MS)));

// iPhone 15 metrics, driven through Chromium (WebKit isn't installed here).
function iphone15(): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return d;
}

async function newContext(opts: Parameters<Browser["newContext"]>[0] = iphone15()): Promise<BrowserContext> {
  const ctx = await browser.newContext(opts);
  if (process.env.E2E_DEBUG) {
    ctx.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 300)));
    ctx.on("weberror", (e) => console.log("[pageerror]", e.error().message.slice(0, 4000)));
    ctx.on("framenavigated", (f) => f === f.page().mainFrame() && console.log("[nav]", f.url()));
  }
  ctx.on("response", async (res) => {
    if (res.request().method() === "POST" && new URL(res.url()).pathname === "/orders" && res.ok()) {
      const body = await res.json().catch(() => null);
      if (body?.id) createdOrders.add(body.id);
    }
  });
  return ctx;
}

/** Signs the context in as the test user with a one-time Clerk sign-in token. */
async function signIn(page: Page, locale = "en", path = `/${locale}/order`) {
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true, null, { timeout: 60_000 });
  await page.evaluate(async (ticket) => {
    const Clerk = (window as unknown as { Clerk: any }).Clerk;
    const si = await Clerk.client.signIn.create({ strategy: "ticket", ticket });
    await Clerk.setActive({ session: si.createdSessionId });
  }, token);
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user), null, { timeout: 30_000 });
  // Clerk refreshes the router when the session becomes active; a tap during that refresh is
  // superseded by it. Let it settle (a real visitor never taps within milliseconds of signing in).
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

/** Hide the Next.js dev-mode badge (dev servers only) so screenshots show the CTA bar's total. */
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

/**
 * Taps City Creek on the location step. On this dev setup the server renders the shell signed
 * out while the browser is signed in (Clerk's dev handshake on localhost), so React re-renders
 * the page after hydration and a tap in that window is lost. Tap again if the bowl step
 * hasn't opened. (A production server sees the session, so the markup matches.)
 */
async function chooseLocation(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator(`[data-location-card="${CITY_CREEK}"]`).click();
    const opened = await page.locator('[data-order-step="bowl"]').waitFor({ state: "visible", timeout: 12_000 }).then(() => true, () => false);
    if (opened) return;
  }
}

async function step(page: Page, name: string) {
  await page
    .locator(`[data-order-step="${name}"]`)
    .waitFor({ state: "visible", timeout: 60_000 })
    .catch(async (err) => {
      const onPage = await page.locator("[data-order-step]").getAttribute("data-order-step").catch(() => null);
      const heading = await page.locator("h1").first().textContent().catch(() => null);
      throw new Error(`step "${name}" never showed on ${page.url()} (showing: ${onPage}, h1: ${heading}): ${err.message.split("\n")[0]}`);
    });
}

/** The page-level checks every step gets. */
async function checkStep(page: Page, name: string) {
  await step(page, name);
  // The pay step's CTA changes from its loading state to Pay / Place order once the
  // PaymentIntent is back; check the settled page, not the swap.
  if (name === "pay") await page.locator("[data-pay-free], [data-pay-submit]").first().waitFor({ state: "visible", timeout: 60_000 });
  const width = await page.evaluate(() => window.innerWidth);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollW <= width, `${name}: document scrollWidth ${scrollW} > ${width}`);
  // The dock hides in the order flow; the top bar carries a Back chevron instead.
  assert.equal(await page.locator("[data-site-dock]").count(), 0, `${name}: the dock is hidden`);
  if (name !== "location") {
    const back = await page.locator("[data-order-back]").waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false);
    assert.ok(back, `${name}: Back chevron in the top bar`);
  }
  await axe(page, name);
}

async function axe(page: Page, name: string) {
  // Let entrance animations finish: axe blends colors through a running opacity fade.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 10_000 }).catch(() => undefined);
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: any }).axe.run(
      { exclude: [["iframe"], ["[data-clerk-portal]"], [".cl-rootBox"]] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } },
    );
    return r.violations.map((v: any) => `${v.id}: ${v.nodes.slice(0, 3).map((n: any) => `${n.target.join(" ")} [${(n.any?.[0]?.message || "").slice(0, 160)}] ${String(n.html).slice(0, 160)}`).join(" | ")}`);
  });
  assert.deepEqual(violations, [], `${name}: axe violations ${JSON.stringify(violations)}`);
}

async function cta(page: Page) {
  const button = page.locator("[data-order-cta]");
  await button.waitFor({ state: "visible" });
  await page
    .waitForFunction(() => {
      const b = document.querySelector("[data-order-cta]") as HTMLButtonElement | null;
      return b && !b.disabled && b.getAttribute("aria-busy") !== "true";
    }, null, { timeout: 60_000 })
    .catch(async (err) => {
      const alert = await page.locator('[role="alert"]').allTextContents().catch(() => []);
      throw new Error(`the CTA never became ready on ${page.url()} (alerts: ${JSON.stringify(alert)}): ${err.message}`);
    });
  await button.click();
}

/** Location, bowl (the default Classic unless `soup` says otherwise), arrival (as soon as possible). */
async function throughArrival(page: Page, locale: string, opts: { soup?: string; check?: boolean } = {}) {
  await page.goto(`${BASE}/${locale}/order`, { waitUntil: "domcontentloaded" });
  if (opts.check) await checkStep(page, "location");
  await chooseLocation(page);
  if (opts.check) await checkStep(page, "bowl");
  else await step(page, "bowl");
  if (opts.soup) await page.locator(`[data-soup="${opts.soup}"]`).click();
  await cta(page);
  if (opts.check) await checkStep(page, "arrival");
  else await step(page, "arrival");
  await page.locator('[data-arrival="asap"]').click();
  await cta(page);
}

async function stripeFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (!/js\.stripe\.com/.test(frame.url())) continue;
      const number = frame.locator('input[name="number"]');
      if (await number.isVisible().catch(() => false)) return frame;
      const cardTab = frame.locator('button[value="card"], [data-value="card"]').first();
      if (await cardTab.count().catch(() => 0)) await cardTab.click().catch(() => undefined);
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Stripe card fields never appeared");
}

async function orderOf(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { seat: true } });
}

function orderIdFromUrl(page: Page): string {
  const id = new URL(page.url()).searchParams.get("orderId");
  assert.ok(id, `an orderId in ${page.url()}`);
  return id;
}

test("en: a best-pod order paid with the test card reaches the status page with its pod label", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (err) => console.log("[page error]", err.message));
  await signIn(page, "en");
  await throughArrival(page, "en", { check: true });

  await checkStep(page, "pod");
  const best = page.locator('[data-pod-mode="best"]');
  assert.equal(await best.getAttribute("aria-checked"), "true", "Best pod for you is the default");
  await cta(page);

  await checkStep(page, "savings");
  await cta(page);

  await checkStep(page, "pay");
  const orderId = orderIdFromUrl(page);
  const label = (await page.locator("[data-pod-label]").textContent())?.match(/[A-C]-\d{2}/)?.[0];
  assert.ok(label, "the pay step shows the pod label");
  const frame = await stripeFrame(page);
  await frame.locator('input[name="number"]').fill("4242424242424242");
  await frame.locator('input[name="expiry"]').fill("12 / 34");
  await frame.locator('input[name="cvc"]').fill("123");
  const zip = frame.locator('input[name="postalCode"]');
  if (await zip.count()) await zip.fill("84101");
  await page.locator("[data-pay-submit]").click();

  await page.waitForURL(/\/en\/order\/status\?orderQrCode=/, { timeout: 90_000 });
  const order = await orderOf(orderId);
  assert.equal(order?.paymentStatus, "PAID");
  assert.equal(order?.seat?.label, label, "the order's pod is the one the pay step showed");
  await page.getByText(label, { exact: false }).first().waitFor({ timeout: 30_000 });
  await ctx.close();
});

test("zh-TW: Choose my own picks A-03 on the pod map, and the order has A-03", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await signIn(page, "zh-TW");
  await throughArrival(page, "zh-TW", { check: true });

  await checkStep(page, "pod");
  await page.locator('[data-pod-mode="pick"]').click();
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ state: "visible" });
  const pod = sheet.locator('[data-pod="A-03"]');
  await pod.waitFor({ state: "visible", timeout: 30_000 });
  // Enter always selects (a pointer tap on a small pod zooms to its row first).
  await pod.focus();
  await page.keyboard.press("Enter");
  assert.equal(await pod.getAttribute("aria-pressed"), "true");
  await axe(page, "pod-pick");
  await sheet.locator("[data-pod-confirm]").click();
  await sheet.waitFor({ state: "hidden" });
  assert.match((await page.locator('[data-pod-mode="pick"]').textContent()) || "", /A-03/);
  await cta(page);

  await checkStep(page, "savings");
  await cta(page);
  await checkStep(page, "pay");
  const orderId = orderIdFromUrl(page);
  assert.match((await page.locator("[data-pod-label]").textContent()) || "", /A-03/);
  const order = await orderOf(orderId);
  assert.equal(order?.seat?.label, "A-03");
  assert.equal(order?.podSelectionMethod, "CUSTOMER_SELECTED");
  await ctx.close();
});

test("en: a free-bowl reward makes the bowl line $0 and the total the tax alone; it pays with no card", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await hideDevBadge(page);
  await signIn(page, "en");
  await throughArrival(page, "en");
  await step(page, "pod");
  await cta(page);

  await checkStep(page, "savings");
  const quote = page.waitForResponse((r) => r.url().endsWith("/orders/quote") && r.ok() && r.request().postData()?.includes(rewardId) === true, { timeout: 60_000 });
  await page.locator(`[data-reward="${rewardId}"]`).click();
  const q = await (await quote).json();
  assert.equal(q.discounts.rewardCents, q.subtotalCents, "the reward covers the bowl");
  await page.waitForFunction(() => document.querySelector("[data-total]")?.getAttribute("data-cents") !== null);
  const bowlLine = page.locator('[data-receipt-line][data-main="true"]').first();
  await bowlLine.locator("text=$0.00").waitFor();
  const total = Number(await page.locator("[data-total]").getAttribute("data-cents"));
  assert.equal(total, q.taxCents, "total equals tax only");
  // Reduced motion still shows every section.
  for (const s of ["rewards", "credits", "promo", "giftCard"]) assert.ok(await page.locator(`[data-savings="${s}"]`).isVisible(), `${s} visible`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "d5-savings-reward-390-en.png"), fullPage: true });
  await cta(page);

  await checkStep(page, "pay");
  const orderId = orderIdFromUrl(page);
  await page.locator("[data-pay-free]").click();
  await page.waitForURL(/\/en\/order\/status\?orderQrCode=/, { timeout: 60_000 });
  const order = await orderOf(orderId);
  assert.equal(order?.paymentStatus, "PAID");
  assert.equal(order?.rewardDiscountCents, order?.subtotalCents);
  assert.ok((await prisma.reward.findUnique({ where: { id: rewardId } }))?.redeemedAt, "the reward is redeemed");
  await ctx.close();
});

test("changing the locale mid-flow keeps the cart", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await signIn(page, "en");
  await page.goto(`${BASE}/en/order/location/${CITY_CREEK}`, { waitUntil: "domcontentloaded" });
  await step(page, "bowl");
  const wagyu = page.locator("[data-soup]").filter({ hasText: /Wagyu/ }).first();
  await wagyu.click();
  await page.locator('[data-item="Soft-Boild Egg"] [data-inc]').click();
  await cta(page);
  await step(page, "arrival");
  const draft = await page.evaluate(() => sessionStorage.getItem("oh-order-draft"));
  assert.ok(draft && draft.includes(CITY_CREEK), "the draft lives in sessionStorage");

  // Switch to zh-TW through the More sheet, as a phone visitor would.
  await page.locator("[data-site-more-trigger]").click();
  await page.locator('[data-locale-option="zh-TW"]').first().click();
  await page.waitForURL(/\/zh-TW\/order\/location\/.*step=arrival/, { timeout: 60_000 });
  await step(page, "arrival");
  await page.locator("[data-order-back]").click();
  await step(page, "bowl");
  assert.equal(await wagyuChecked(page), "true", "Wagyu is still selected");
  assert.equal(await page.locator('[data-item="Soft-Boild Egg"] [data-qty]').textContent(), "1");
  await ctx.close();
});

async function wagyuChecked(page: Page) {
  return page.locator("[data-soup]").filter({ hasText: /和牛/ }).first().getAttribute("aria-checked");
}

test("signed out: the builder is browsable and the arrival step asks to sign in, keeping the draft", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/order/location/${CITY_CREEK}`, { waitUntil: "domcontentloaded" });
  await checkStep(page, "bowl");
  await page.locator('[data-item="Bone Marrow"] [data-inc]').click();
  await cta(page);
  await checkStep(page, "arrival");
  await page.locator("[data-order-signin]").waitFor({ state: "visible" });
  const draft = JSON.parse((await page.evaluate(() => sessionStorage.getItem("oh-order-draft"))) || "{}");
  assert.equal(Object.values(draft.extras || {}).includes(1), true, "the draft kept the add-on");
  await ctx.close();
});

test("a ?ref= link is credited once the visitor signs in, then forgotten (fix round 1)", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  // Arrive signed out through a referral link, then sign in on that page.
  await signIn(page, "en", `/en/order?ref=${encodeURIComponent(referralCode)}`);
  const deadline = Date.now() + 30_000;
  let referred: string | null = null;
  while (Date.now() < deadline && !referred) {
    referred = (await prisma.user.findUnique({ where: { id: dbUserId } }))?.referredById ?? null;
    if (!referred) await page.waitForTimeout(500);
  }
  assert.equal(referred, referrerId, "the member is attributed to the referrer");
  await page.waitForFunction(() => localStorage.getItem("pendingReferralCode") === null, null, { timeout: 15_000 });
  const welcome = await prisma.creditLot.count({ where: { userId: dbUserId, source: "WELCOME" } });
  assert.equal(welcome, 1, "one welcome credit");
  await ctx.close();
});

test("a meal paid forward can be claimed in savings and covers the bowl (fix round 1)", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await signIn(page, "en");
  await throughArrival(page, "en");
  await step(page, "pod");
  await cta(page);
  await checkStep(page, "savings");
  const gift = page.locator(`[data-meal-gift="${mealGiftId}"]`);
  await gift.waitFor({ state: "visible", timeout: 30_000 });
  assert.match((await gift.textContent()) || "", /Lin/, "the giver's first name");
  assert.doesNotMatch((await gift.textContent()) || "", /Referrer/, "never the giver's full name");
  const quote = page.waitForResponse((r) => r.url().endsWith("/orders/quote") && r.ok() && r.request().postData()?.includes(mealGiftId) === true, { timeout: 60_000 });
  await gift.click();
  const q = await (await quote).json();
  assert.ok(q.discounts.mealGiftCents > 0, "the server applies the gift");
  await cta(page);
  await checkStep(page, "pay");
  const orderId = orderIdFromUrl(page);
  const pay = (await page.locator("[data-pay-free]").count()) ? "[data-pay-free]" : null;
  assert.ok(pay, "a $20 gift covers a Classic bowl: nothing left to pay");
  await page.locator(pay).click();
  await page.waitForURL(/\/en\/order\/status\?orderQrCode=/, { timeout: 60_000 });
  const g = await prisma.mealGift.findUnique({ where: { id: mealGiftId } });
  assert.equal(g?.status, "ACCEPTED");
  assert.equal(g?.orderId, orderId);
  await ctx.close();
});

test("the status page's I'm done eating finishes a served order as its signed-in owner (fix round 2)", async () => {
  const location = await prisma.location.findUnique({ where: { id: CITY_CREEK } });
  const stamp = Date.now();
  const served = await prisma.order.create({
    data: {
      orderNumber: `${tag}-served`,
      orderQrCode: `ORDER-${tag}-served-${stamp}`,
      kitchenOrderNumber: "0999",
      tenantId: location!.tenantId,
      locationId: CITY_CREEK,
      userId: dbUserId,
      status: "SERVING",
      paymentStatus: "PAID",
      subtotalCents: 1599,
      taxCents: 151,
      totalCents: 1750,
      amountDueCents: 0,
    },
  });
  createdOrders.add(served.id);
  // (Who may use the kitchen route is pinned in packages/api/src/orders/__tests__/kitchen-status.test.js;
  // the lane's dev API has no ADMIN_API_KEY, so its dev bypass treats every caller as staff.)

  const ctx = await newContext();
  const page = await ctx.newPage();
  await signIn(page, "en");
  await page.goto(`${BASE}/en/order/status?orderQrCode=${encodeURIComponent(served.orderQrCode!)}`, { waitUntil: "domcontentloaded" });
  const doneRequest = page.waitForResponse((r) => r.url().endsWith(`/orders/${served.id}/done`) && r.request().method() === "POST", { timeout: 60_000 });
  // D6 rebuilt the status page: the confirm is inline (no dialog).
  await page.locator("[data-done-eating]").click();
  await page.locator("[data-done-confirm]").click();
  const res = await doneRequest;
  assert.equal(res.status(), 200, "the owner's call succeeds");
  assert.match(String(res.request().headers()["authorization"] || ""), /^Bearer /, "sent with the member's session");
  const after = await prisma.order.findUnique({ where: { id: served.id } });
  assert.equal(after?.status, "COMPLETED");
  await ctx.close();
});

test("screenshots: every step at 390 (en, zh-TW), 360 (es) and 1440 (en)", { skip: !SHOTS }, async () => {
  const runs: { locale: string; width: number; opts: Parameters<Browser["newContext"]>[0] }[] = [
    { locale: "en", width: 390, opts: iphone15() },
    { locale: "zh-TW", width: 390, opts: iphone15() },
    { locale: "es", width: 360, opts: { ...iphone15(), viewport: { width: 360, height: 780 }, screen: { width: 360, height: 780 } } },
    { locale: "en", width: 1440, opts: { viewport: { width: 1440, height: 900 } } },
  ];
  // The free-bowl test redeems the seeded reward; the walk gets its own (never redeemed: its orders stay unpaid).
  const shotRewardId = (await prisma.reward.create({ data: { userId: dbUserId, type: "FREE_BOWL", issuedFor: `${tag}-shots`, windowEndsAt: new Date(Date.now() + 14 * 864e5) } })).id;
  for (const run of runs) {
    const ctx = await newContext(run.opts);
    const page = await ctx.newPage();
    await hideDevBadge(page);
    const shot = async (name: string) => {
      const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
      assert.ok(sw <= w, `${name} ${run.width} ${run.locale}: scrollWidth ${sw} > ${w}`);
      await shotOnly(name);
    };
    const shotOnly = (name: string) => page.screenshot({ path: path.join(SHOTS, `d5-${name}-${run.width}-${run.locale}.png`), fullPage: true });
    await signIn(page, run.locale);
    await page.goto(`${BASE}/${run.locale}/order`, { waitUntil: "domcontentloaded" });
    await step(page, "location");
    await page.waitForTimeout(800);
    await shot("location");
    await chooseLocation(page);
    await step(page, "bowl");
    await page.locator('[data-item="Soft-Boild Egg"] [data-inc]').click();
    await page.waitForTimeout(1200);
    await shot("bowl");
    await cta(page);
    await step(page, "arrival");
    await page.locator('[data-arrival="asap"]').click();
    await shot("arrival");
    await cta(page);
    await step(page, "pod");
    await page.waitForTimeout(600);
    await shot("pod");
    await page.locator('[data-pod-mode="pick"]').click();
    await page.getByRole("dialog").locator('[data-pod="B-07"]').waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOTS, `d5-pod-pick-${run.width}-${run.locale}.png`) });
    await page.getByRole("dialog").locator('[data-pod="B-07"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, `d5-pod-picked-${run.width}-${run.locale}.png`) });
    await page.getByRole("dialog").locator("[data-pod-confirm]").click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await cta(page);
    await step(page, "savings");
    await page.locator(`[data-reward="${shotRewardId}"]`).click();
    await page.locator('[data-savings="credits"] [role="switch"]').click();
    await page.waitForTimeout(1500);
    await shot("savings");
    // Take the reward back off so the pay step has a card amount to show.
    await page.locator(`[data-reward="${shotRewardId}"]`).click();
    await page.waitForTimeout(1200);
    await cta(page);
    await step(page, "pay");
    await page.waitForTimeout(4000);
    await shot("pay");
    // Give the pod back and drop the unpaid order.
    const orderId = orderIdFromUrl(page);
    await fetch(`${API}/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }) });
    await ctx.close();
  }
});
