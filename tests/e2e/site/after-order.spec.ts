/**
 * After-order pages e2e (Task D6): status, confirmation, check-in, scan and
 * the pod page, plus the carried "Order again" prefill.
 *
 *  1. THE PLAN DEMO CONTRACT (binding; the business plan's phone embeds this
 *     page): /en/order/status?orderQrCode=DEMO-PLAN.PREPPING&embed=1&demoSync=parent
 *     at 390x844 has no dock, top bar, header, footer or Chappy, shows the
 *     PREPPING stage, changes to READY when the test posts
 *     { type: "oh-status-demo", stage: "READY" }, and still calls the AI
 *     routes (kitchen feed, fortune, roast, backstory) with the page locale.
 *  2. zh-CN: the demo renders with no English leak and no emoji.
 *  3. /en/plan/experience (plan code OH-PEPPER-7871) still shows the phone
 *     with the status page inside it.
 *  4. A real order, signed in: confirmation (QR code, pod, the track CTA,
 *     idempotent on refresh with the Stripe return params), check-in, scan,
 *     the status page's pod-moved notice, "I'm done eating", and the pod
 *     page's live CombMap with the guest's pod highlighted.
 *  5. "Order again": /en/order?reorder=<own order> rebuilds the cart at the
 *     arrival step (re-quoted, unavailable items named); another member's
 *     order id gives nothing.
 *  Every page: iPhone 15 metrics, no horizontal overflow, no emoji in the
 *  DOM, axe (wcag2a/aa) clean, and all content visible under reduced motion.
 *
 *   E2E_BASE_URL=http://localhost:3300 E2E_API_URL=http://localhost:4300 \
 *     node --env-file=.env --test tests/e2e/site/after-order.spec.ts
 *
 * Needs the lane's web (3300) and API (4300) dev servers and the Clerk
 * DEVELOPMENT key (sign-in works like order.spec.ts: a throwaway
 * `+clerk_test` user and a one-time sign-in token). Seeds its orders in the
 * lane DB and removes everything afterwards. The AI routes are answered by
 * stubs in the browser (the test checks they're called, not what the model
 * says). With E2E_SHOT_DIR set, the last test saves d6-*.png.
 */
import { test, after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import { PrismaClient } from "../../../packages/db/index.js";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3300";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const CLERK_KEY = process.env.CLERK_SECRET_KEY || "";
const AXE = new URL("../../../apps/web/node_modules/axe-core/axe.min.js", import.meta.url).pathname;
const CITY_CREEK = "cmip6jbz700022nnnxxpmm5hf";
const DEMO = (locale: string, stage: string, extra = "&embed=1&demoSync=parent") => `/${locale}/order/status?orderQrCode=DEMO-PLAN.${stage}${extra}`;
const EMOJI = /\p{Extended_Pictographic}/u;

const prisma = new PrismaClient();
const tag = `e2e-d6-${Date.now()}`;
const email = `${tag}+clerk_test@example.com`;
let browser: Browser;
let clerkUserId = "";
let dbUserId = "";
let otherUserId = "";
const orderIds: string[] = [];
const seatIds: string[] = [];

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
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
  const tryDel = async (label: string, fn: () => Promise<unknown>) => fn().catch((e) => console.log(`[cleanup] ${label}: ${String(e.message).split("\n").pop()}`));
  const orders = await prisma.order.findMany({ where: { OR: [{ id: { in: orderIds } }, { userId: { in: [dbUserId, otherUserId].filter(Boolean) } }] } });
  const ids = orders.map((o) => o.id);
  const seats = [...new Set([...seatIds, ...orders.flatMap((o) => [o.seatId, o.dualPartnerSeatId]).filter((s): s is string => Boolean(s))])];
  if (seats.length) await tryDel("seats", () => prisma.seat.updateMany({ where: { id: { in: seats } }, data: { status: "AVAILABLE" } }));
  await tryDel("staffCall", () => (prisma as any).staffCall?.deleteMany({ where: { orderId: { in: ids } } }) ?? Promise.resolve());
  await tryDel("orderItem", () => prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }));
  await tryDel("order", () => prisma.order.deleteMany({ where: { id: { in: ids } } }));
  for (const u of [dbUserId, otherUserId].filter(Boolean)) {
    await tryDel("creditEvent", () => prisma.creditEvent.deleteMany({ where: { userId: u } }));
    await tryDel("creditLot", () => prisma.creditLot.deleteMany({ where: { userId: u } }));
    await tryDel("userBadge", () => prisma.userBadge.deleteMany({ where: { userId: u } }));
    await tryDel("user", () => prisma.user.delete({ where: { id: u } }));
  }
  if (clerkUserId) await clerk(`/users/${clerkUserId}`, { method: "DELETE" }).catch((e) => console.log(`[cleanup] clerk: ${e.message}`));
  await prisma.$disconnect();
  console.log(`E2E_CLEANED ${ids.length} orders`);
});

// The API allows 100 requests a minute per IP (hard-coded on this branch), shared by every test here.
const PACE_MS = Number(process.env.E2E_PACE_MS ?? 20_000);
afterEach(() => new Promise((r) => setTimeout(r, PACE_MS)));

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
  return ctx;
}

/** The AI routes answer from stubs (locale-tagged), and every call is recorded. */
type AiCalls = { feed: string[]; fortune: string[]; roast: string[]; backstory: string[]; fact: string[] };
async function stubAi(page: Page, locale: string): Promise<AiCalls> {
  const calls: AiCalls = { feed: [], fortune: [], roast: [], backstory: [], fact: [] };
  const zh = locale.startsWith("zh");
  const json = (body: unknown) => ({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  await page.route(/\/orders\/commentary\?/, (r) => {
    calls.feed.push(r.request().url());
    return r.fulfill(json({ commentary: zh ? "湯頭正在慢慢熬。" : "The broth is taking its time.", status: "PREPPING", source: "stub" }));
  });
  await page.route(/\/orders\/fortune\?/, (r) => {
    calls.fortune.push(r.request().url());
    return r.fulfill(json({ fortune: zh ? "好湯值得等待。" : "Good soup is worth the wait.", luckyNumbers: [3, 8, 21], thisDayInHistory: null, learnChinese: null, source: "stub" }));
  });
  await page.route(/\/orders\/roast\?/, (r) => {
    calls.roast.push(r.request().url());
    return r.fulfill(json({ roast: zh ? "寬麵加辣，你很懂。" : "Wide noodles and extra heat. Bold.", highlights: [zh ? "敢吃辣" : "Brave with spice"], source: "stub" }));
  });
  await page.route(/\/orders\/[^/]+\/backstory\?/, (r) => {
    calls.backstory.push(r.request().url());
    return r.fulfill(json({ backstories: [zh ? "這顆蛋滷了一整夜。" : "This egg rested in soy overnight."], source: "stub" }));
  });
  await page.route(/\/orders\/mental-health-fact\?/, (r) => {
    calls.fact.push(r.request().url());
    return r.fulfill(json({ question: zh ? "你知道嗎？" : "Did you know?", fact: zh ? "早期支持很重要。" : "Early support matters.", source: zh ? "世界衛生組織" : "WHO" }));
  });
  return calls;
}

async function signIn(page: Page, locale = "en", at = `/${locale}/order`) {
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.goto(`${BASE}${at}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
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

async function axe(page: Page, name: string) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 10_000 }).catch(() => undefined);
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: any }).axe.run(
      { exclude: [["iframe"], ["[data-clerk-portal]"], [".cl-rootBox"], ["nextjs-portal"]] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } },
    );
    return r.violations.map((v: any) => `${v.id}: ${v.nodes.slice(0, 3).map((n: any) => `${n.target.join(" ")} [${(n.any?.[0]?.message || "").slice(0, 160)}] ${String(n.html).slice(0, 160)}`).join(" | ")}`);
  });
  assert.deepEqual(violations, [], `${name}: axe violations ${JSON.stringify(violations)}`);
}

/** The checks every page gets: no horizontal overflow, no emoji, axe clean. */
async function checkPage(page: Page, name: string) {
  const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
  assert.ok(sw <= w, `${name}: document scrollWidth ${sw} > ${w}`);
  const text = await page.evaluate(() => document.body.innerText);
  assert.ok(!EMOJI.test(text), `${name}: emoji in the DOM: ${text.match(EMOJI)?.[0]}`);
  await axe(page, name);
}

/** Latin words on a zh page, minus the brand allowlist and proper place names from the database. */
function englishLeaks(text: string): string[] {
  const allow = new Set(["Oh", "Wagyu", "Chappy", "Stripe", "Apple", "Pay", "Google", "QR", "City", "Creek", "Mall", "University", "Place", "DEMO", "PLAN", "AM", "PM", "Alex"]); // Alex: the demo guest (API demo data, fixed by the plan contract)
  return (text.match(/[A-Za-z]{2,}/g) || []).filter((w) => !allow.has(w));
}

async function stage(page: Page, s: string) {
  await page.locator(`[data-status-page][data-status-stage="${s}"]`).waitFor({ state: "visible", timeout: 60_000 });
}

/* ------------------------------------------------------------ fixtures */

async function seedMember() {
  if (dbUserId) return;
  assert.ok(CLERK_KEY.startsWith("sk_test_"), "CLERK_SECRET_KEY must be the Clerk development key");
  const user = await clerk("/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Mei", last_name: "E2E", skip_password_requirement: true }) });
  clerkUserId = user.id;
  // A phone and SMS consent already on file, so the confirmation page's SMS sheet stays closed.
  dbUserId = (await prisma.user.create({ data: { email: email.toLowerCase(), name: "Mei E2E", phone: `+1801${String(Date.now()).slice(-7)}`, smsOptIn: true } })).id;
  otherUserId = (await prisma.user.create({ data: { email: `${tag}-other@example.com`, name: "Other Member" } })).id;
}

/** A free comb pod at City Creek, held for the test. */
async function freePod(skip: string[] = []): Promise<{ id: string; label: string; qrCode: string }> {
  const seat = await prisma.seat.findFirst({ where: { locationId: CITY_CREEK, status: "AVAILABLE", label: { not: null, notIn: skip }, podType: "SINGLE" }, orderBy: { label: "desc" } });
  assert.ok(seat, "a free pod at City Creek");
  await prisma.seat.update({ where: { id: seat.id }, data: { status: "RESERVED" } });
  seatIds.push(seat.id);
  return { id: seat.id, label: seat.label!, qrCode: seat.qrCode! };
}

async function menuIds() {
  const items = await prisma.menuItem.findMany({ where: { name: { in: ["Classic Beef Noodle Soup", "Wide Noodles", "Spice Level", "Soft-Boild Egg", "Mandarin Orange Sherbet"] } } });
  const by = (n: string) => items.find((i) => i.name === n)!;
  return { bowl: by("Classic Beef Noodle Soup"), noodles: by("Wide Noodles"), spice: by("Spice Level"), egg: by("Soft-Boild Egg"), dessert: by("Mandarin Orange Sherbet") };
}

async function seedOrder(opts: { userId: string; status: string; seatId?: string | null; podConfirmed?: boolean; arrived?: boolean; dessert?: boolean }) {
  const m = await menuIds();
  const { tenantId } = (await prisma.location.findUnique({ where: { id: CITY_CREEK } }))!;
  const n = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const now = Date.now();
  const at = (min: number) => new Date(now - min * 60_000);
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-${tag}-${n}`,
      kitchenOrderNumber: `D${n.slice(-2)}`,
      orderQrCode: `ORDER-${tag}-${n}`,
      status: opts.status as any,
      paymentStatus: "PAID",
      totalCents: 1798,
      subtotalCents: 1798,
      taxCents: 0,
      amountDueCents: 0,
      locationId: CITY_CREEK,
      userId: opts.userId,
      tenantId,
      seatId: opts.seatId ?? null,
      podSelectionMethod: opts.seatId ? "CUSTOMER_SELECTED" : null,
      podAssignedAt: opts.seatId ? at(12) : null,
      estimatedArrival: new Date(now + 5 * 60_000),
      paidAt: at(12),
      arrivedAt: opts.arrived ? at(8) : null,
      queuedAt: opts.arrived ? at(8) : null,
      podConfirmedAt: opts.podConfirmed ? at(8) : null,
      prepStartTime: ["PREPPING", "READY", "SERVING"].includes(opts.status) ? at(7) : null,
      readyTime: ["READY", "SERVING"].includes(opts.status) ? at(3) : null,
      deliveredAt: opts.status === "SERVING" ? at(2) : null,
      items: {
        create: [
          { menuItemId: m.bowl.id, quantity: 1, priceCents: 1599 },
          { menuItemId: m.noodles.id, quantity: 1, priceCents: 0 },
          { menuItemId: m.spice.id, quantity: 1, priceCents: 0, selectedValue: "Medium" },
          { menuItemId: m.egg.id, quantity: 1, priceCents: 199 },
          ...(opts.dessert ? [{ menuItemId: m.dessert.id, quantity: 1, priceCents: 0 }] : []),
        ],
      },
    } as any,
  });
  orderIds.push(order.id);
  return order;
}

/* ------------------------------------------------------------ 1-3: the plan demo */

test("plan demo contract: embedded, bare, PREPPING, follows the parent's stage, still calls the AI routes", async () => {
  const ctx = await newContext({ ...iphone15(), viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const ai = await stubAi(page, "en");
  await page.goto(BASE + DEMO("en", "PREPPING"), { waitUntil: "domcontentloaded", timeout: 120_000 });
  await stage(page, "PREPPING");
  assert.equal(await page.locator("[data-status-page]").getAttribute("data-demo"), "true");
  // No shell: no dock, top bar, header, footer or Chappy; the site wrapper (fonts, night palette) stays.
  assert.equal(await page.locator("[data-site-dock]").count(), 0);
  assert.equal(await page.locator("[data-site-topbar]").count(), 0);
  assert.equal(await page.locator("header").count(), 0);
  assert.equal(await page.locator("footer").count(), 0);
  assert.equal(await page.locator(".chappy-button, [data-chappy-legacy], [data-ask-chappy]").count(), 0);
  assert.equal(await page.locator('[data-site-shell="embed"]').count(), 1);
  // The pod the plan's journey walks to.
  assert.match(await page.locator("[data-pod-label]").first().innerText(), /32/);
  // The kitchen feed was asked for this stage in the page's language.
  await page.waitForFunction(() => document.querySelector("[data-kitchen-feed]")?.textContent?.includes("broth"), null, { timeout: 30_000 });
  assert.ok(ai.feed.some((u) => u.includes("orderQrCode=DEMO-PLAN.PREPPING") && u.includes("locale=en")), `feed called: ${ai.feed}`);
  await checkPage(page, "demo-embed");

  // The parent drives the stage.
  await page.evaluate(() => window.postMessage({ type: "oh-status-demo", stage: "READY" }, window.location.origin));
  await stage(page, "READY");
  // Anything else is ignored.
  await page.evaluate(() => window.postMessage({ type: "oh-status-demo", stage: "NOPE" }, window.location.origin));
  await page.evaluate(() => window.postMessage({ type: "other", stage: "PAID" }, window.location.origin));
  await page.waitForTimeout(1500);
  assert.equal(await page.locator("[data-status-page]").getAttribute("data-status-stage"), "READY");

  // Fortune, roast and backstory are still one tap away, and still reach the API.
  await page.locator("[data-line-open='fortune']").click();
  await page.locator("[data-line='fortune'] [data-line-text]").waitFor({ timeout: 30_000 });
  await page.locator("[data-line-open='roast']").click();
  await page.locator("[data-line='roast'] [data-line-text]").waitFor({ timeout: 30_000 });
  await page.locator("[data-line-open='backstory']").click();
  await page.locator("[data-line='backstory'] [data-line-text]").waitFor({ timeout: 30_000 });
  assert.ok(ai.fortune.some((u) => u.includes("DEMO-PLAN.READY") && u.includes("locale=en")), `fortune: ${ai.fortune}`);
  assert.ok(ai.roast.some((u) => u.includes("DEMO-PLAN.READY") && u.includes("locale=en")), `roast: ${ai.roast}`);
  assert.ok(ai.backstory.some((u) => u.includes("/orders/demo-plan/backstory") && u.includes("locale=en")), `backstory: ${ai.backstory}`);
  const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
  assert.ok(sw <= w, `after opening the lines: scrollWidth ${sw} > ${w}`);

  // "I'm done eating" on the demo is simulated by the API and finishes the visit.
  await page.evaluate(() => window.postMessage({ type: "oh-status-demo", stage: "SERVING" }, window.location.origin));
  await stage(page, "SERVING");
  const done = page.waitForResponse((r) => /\/orders\/demo-plan\/done$/.test(r.url()) && r.request().method() === "POST");
  await page.locator("[data-done-eating]").click();
  await page.locator("[data-done-confirm]").click();
  assert.equal((await done).status(), 200);
  await stage(page, "COMPLETED");
  await ctx.close();
});

test("plan demo: zh-CN has no English leak and no emoji; reduced motion shows everything", async () => {
  const ctx = await newContext({ ...iphone15(), reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await stubAi(page, "zh-CN");
  for (const s of ["PAID", "PREPPING", "SERVING"]) {
    await page.goto(BASE + DEMO("zh-CN", s), { waitUntil: "domcontentloaded", timeout: 120_000 });
    await stage(page, s);
    await page.waitForTimeout(1200);
    const text = await page.evaluate(() => document.body.innerText);
    assert.deepEqual(englishLeaks(text), [], `zh-CN ${s}: English on the page`);
    // Reduced motion: every section is visible (no element left at opacity 0).
    const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-status-section]")].filter((el) => getComputedStyle(el).opacity === "0").length);
    assert.equal(hidden, 0, `zh-CN ${s}: sections hidden under reduced motion`);
    await checkPage(page, `demo-zh-CN-${s}`);
  }
  await ctx.close();
});

test("the plan's experience page still shows the phone with the status page inside it", async () => {
  const ctx = await newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/plan/experience?c=OH-PEPPER-7871`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForURL(/\/en\/plan\/experience/, { timeout: 120_000 });
  const frameEl = page.locator('iframe[src*="/order/status"]').first();
  await frameEl.scrollIntoViewIfNeeded({ timeout: 60_000 });
  await frameEl.waitFor({ state: "visible", timeout: 60_000 });
  assert.match(String(await frameEl.getAttribute("src")), /orderQrCode=DEMO-PLAN.*embed=1/);
  const frame = await (await frameEl.elementHandle())!.contentFrame();
  assert.ok(frame, "the phone's iframe");
  await frame!.locator('[data-status-page][data-demo="true"]').waitFor({ state: "visible", timeout: 120_000 });
  assert.equal(await frame!.locator("[data-status-page]").getAttribute("data-demo"), "true");
  assert.equal(await frame!.locator("[data-site-dock], [data-site-topbar]").count(), 0);
  // The page fits the 390-wide phone: no sideways scroll inside the frame.
  const [w, sw] = await frame!.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
  assert.equal(w, 390);
  assert.ok(sw <= w, `phone frame: scrollWidth ${sw} > ${w}`);
  await ctx.close();
});

/* ------------------------------------------------------------ 4: a real order */

test("a real order: confirmation, check-in, scan, the pod-moved notice and done eating", async () => {
  await seedMember();
  const pod = await freePod();
  const order = await seedOrder({ userId: dbUserId, status: "PAID", seatId: pod.id });
  const ctx = await newContext();
  const page = await ctx.newPage();
  await stubAi(page, "en");
  await hideDevBadge(page);
  await signIn(page, "en");

  // Confirmation, as the Stripe return lands on it: confirmPayment runs, idempotently, and the page survives a refresh.
  const confirmUrl = `${BASE}/en/order/confirmation?orderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber)}&paid=true&podFrom=Z-99&payment_intent_client_secret=pi_${tag.replace(/-/g, "_")}_secret_x&redirect_status=succeeded`;
  const confirmCall = page.waitForResponse((r) => r.url().endsWith(`/orders/${order.id}/confirm-payment`) && r.request().method() === "POST", { timeout: 60_000 });
  await page.goto(confirmUrl, { waitUntil: "domcontentloaded" });
  assert.equal((await confirmCall).status(), 200, "confirmPayment on an already-paid order is a no-op 200");
  await page.locator("[data-confirmation-page] [data-order-qr]").waitFor({ timeout: 60_000 });
  assert.match(await page.locator("[data-pod-label]").first().innerText(), new RegExp(pod.label));
  assert.match(await page.locator("[data-pod-moved]").innerText(), new RegExp(pod.label), "the pod moved at payment");
  await checkPage(page, "confirmation");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-confirmation-page] [data-order-qr]").waitFor({ timeout: 60_000 });
  const again = await prisma.order.findUnique({ where: { id: order.id } });
  assert.equal(again?.paymentStatus, "PAID");

  // Primary CTA: check in (the kiosk step, from the phone).
  await page.locator("[data-confirmation-page] [data-cta='check-in']").click();
  await page.waitForURL(/\/en\/order\/check-in\?/, { timeout: 60_000 });
  await page.locator("[data-checkin-page]").waitFor();
  assert.equal(await page.locator("[data-site-dock]").count(), 1, "the shell is back on the after-order pages");
  await checkPage(page, "check-in");
  await page.locator("[data-checkin-submit]").click();
  await page.waitForURL(/\/en\/order\/status\?/, { timeout: 60_000 });
  // Checked in: the kitchen queues it, and the pod card asks the guest to confirm at the pod.
  await stage(page, "QUEUED");
  await page.locator("[data-at-pod]").waitFor({ timeout: 30_000 });
  assert.ok((await prisma.order.findUnique({ where: { id: order.id } }))?.arrivedAt, "checked in");

  // Scan: "I'm at my pod" on the status page leads to the confirm step.
  await page.locator("[data-at-pod]").click();
  await page.waitForURL(/\/en\/order\/scan\?/, { timeout: 60_000 });
  await page.locator("[data-scan-page][data-state='ready']").waitFor({ timeout: 60_000 });
  assert.match(await page.locator("[data-pod-label]").first().innerText(), new RegExp(pod.label));
  await checkPage(page, "scan");
  await page.locator("[data-scan-submit]").click();
  await page.waitForURL(/\/en\/order\/status\?/, { timeout: 60_000 });
  await stage(page, "QUEUED");
  await page.locator("[data-call-staff]").waitFor({ timeout: 30_000 });
  assert.ok((await prisma.order.findUnique({ where: { id: order.id } }))?.podConfirmedAt, "pod confirmed");
  await checkPage(page, "status-queued");

  // The kitchen serves it; the guest finishes.
  await prisma.order.update({ where: { id: order.id }, data: { status: "SERVING", prepStartTime: new Date(), readyTime: new Date(), deliveredAt: new Date() } });
  await page.goto(`${BASE}/en/order/status?orderQrCode=${encodeURIComponent(order.orderQrCode!)}&podFrom=Z-99`, { waitUntil: "domcontentloaded" });
  await stage(page, "SERVING");
  assert.match(await page.locator("[data-pod-moved]").innerText(), new RegExp(pod.label));
  const done = page.waitForResponse((r) => r.url().endsWith(`/orders/${order.id}/done`) && r.request().method() === "POST", { timeout: 60_000 });
  await page.locator("[data-done-eating]").click();
  await page.locator("[data-done-confirm]").click();
  const res = await done;
  assert.equal(res.status(), 200);
  assert.match(String(res.request().headers()["authorization"] || ""), /^Bearer /, "sent with the member's session");
  await stage(page, "COMPLETED");
  assert.equal((await prisma.order.findUnique({ where: { id: order.id } }))?.status, "COMPLETED");
  await ctx.close();
});

test("the pod page: the live map highlights your pod, and I'm here confirms it", async () => {
  await seedMember();
  const pod = await freePod();
  const order = await seedOrder({ userId: dbUserId, status: "QUEUED", seatId: pod.id, arrived: true });
  const ctx = await newContext({ ...iphone15(), reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await stubAi(page, "zh-TW");
  await signIn(page, "zh-TW", `/zh-TW/pod?qr=${encodeURIComponent(pod.qrCode)}`);
  await page.goto(`${BASE}/zh-TW/pod?qr=${encodeURIComponent(pod.qrCode)}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-pod-page]").waitFor({ timeout: 60_000 });
  await page.locator(`[data-pod-page] svg [data-pod="${pod.label}"][data-selected="true"]`).waitFor({ timeout: 60_000 });
  const text = await page.evaluate(() => document.body.innerText);
  assert.deepEqual(englishLeaks(text).filter((w) => !pod.label.includes(w)), [], "zh-TW pod page: English on the page");
  await checkPage(page, "pod");
  const arrival = page.waitForResponse((r) => r.url().endsWith("/pods/confirm-arrival") && r.request().method() === "POST", { timeout: 60_000 });
  await page.locator("[data-pod-confirm-arrival]").click();
  assert.equal((await arrival).status(), 200);
  await page.waitForURL(/\/zh-TW\/order\/status\?/, { timeout: 60_000 });
  assert.ok((await prisma.order.findUnique({ where: { id: order.id } }))?.podConfirmedAt);

  // An unknown pod code: a translated message, not the API's English.
  await page.goto(`${BASE}/zh-TW/pod?qr=POD-nope`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-pod-page][data-state='error']").waitFor({ timeout: 60_000 });
  assert.deepEqual(englishLeaks(await page.evaluate(() => document.body.innerText)), []);
  await ctx.close();
});

/* ------------------------------------------------------------ 5: Order again */

test("Order again: your own order comes back re-quoted; someone else's gives nothing", async () => {
  await seedMember();
  const mine = await seedOrder({ userId: dbUserId, status: "COMPLETED" });
  const theirs = await seedOrder({ userId: otherUserId, status: "COMPLETED" });
  // The egg is off the menu today.
  const { egg } = await menuIds();
  await prisma.menuItem.update({ where: { id: egg.id }, data: { isAvailable: false } });
  try {
    const ctx = await newContext();
    const page = await ctx.newPage();
    await signIn(page, "en");
    const { bowl } = await menuIds();
    const quotes: { items: { menuItemId: string; priceCents?: number }[] }[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/orders/quote")) quotes.push(r.postDataJSON());
    });
    await page.goto(`${BASE}/en/order?reorder=${mine.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(new RegExp(`/en/order/location/${CITY_CREEK}\\?step=arrival`), { timeout: 90_000 });
    await page.locator("[data-reorder-note]").waitFor({ timeout: 30_000 });
    assert.match(await page.locator("[data-reorder-note]").innerText(), /Soft-Boild Egg|egg/i, "the unavailable item is named");
    // Re-priced by the server: a quote for the rebuilt cart, which holds the bowl and not the egg, with no prices.
    await page.locator("[data-due][data-cents]").waitFor({ timeout: 60_000 });
    const last = quotes[quotes.length - 1];
    assert.ok(last, "the rebuilt cart was quoted");
    assert.ok(last.items.some((i) => i.menuItemId === bowl.id), "the bowl came back");
    assert.ok(!last.items.some((i) => i.menuItemId === egg.id), "the unavailable egg isn't in the cart");
    assert.ok(last.items.every((i) => !("priceCents" in i)), "no old prices sent");
    const draft = await page.evaluate(() => sessionStorage.getItem("oh-order-draft"));
    assert.ok(draft && draft.includes(bowl.id) && !draft.includes(egg.id) && !/1599/.test(draft), "the cart carries the bowl, not the egg, and no old prices");

    // Another member's order id: nothing loads, and the page says so.
    await page.goto(`${BASE}/en/order?reorder=${theirs.id}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-reorder-missing]").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    assert.match(page.url(), /\/en\/order\?reorder=/, "stays on the location step");
    await ctx.close();
  } finally {
    await prisma.menuItem.update({ where: { id: egg.id }, data: { isAvailable: true } });
  }
});

/* ------------------------------------------------------------ screenshots */

test("screenshots: status at every stage (en, zh-TW 390), the embed at 390x844, confirmation, check-in, the pod map", { skip: !SHOTS }, async () => {
  await seedMember();
  for (const locale of ["en", "zh-TW"]) {
    const ctx = await newContext();
    const page = await ctx.newPage();
    await hideDevBadge(page);
    await stubAi(page, locale);
    for (const s of ["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"]) {
      await page.goto(BASE + DEMO(locale, s, "&demoSync=parent"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await stage(page, s);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `d6-status-${s.toLowerCase()}-390-${locale}.png`), fullPage: true });
    }
    await ctx.close();
  }
  {
    const ctx = await newContext({ ...iphone15(), viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await hideDevBadge(page);
    await stubAi(page, "en");
    await page.goto(BASE + DEMO("en", "PREPPING"), { waitUntil: "domcontentloaded", timeout: 120_000 });
    await stage(page, "PREPPING");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, "d6-embed-390x844-en.png") });
    await ctx.close();
  }
  for (const run of [
    { locale: "en", width: 390, opts: iphone15() },
    { locale: "zh-TW", width: 390, opts: iphone15() },
    { locale: "es", width: 360, opts: { ...iphone15(), viewport: { width: 360, height: 780 }, screen: { width: 360, height: 780 } } },
    { locale: "en", width: 1440, opts: { viewport: { width: 1440, height: 900 } } },
  ]) {
    const pod = await freePod();
    const order = await seedOrder({ userId: dbUserId, status: "PAID", seatId: pod.id });
    const ctx = await newContext(run.opts);
    const page = await ctx.newPage();
    await hideDevBadge(page);
    await stubAi(page, run.locale);
    await signIn(page, run.locale);
    const shot = async (name: string) => {
      const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
      assert.ok(sw <= w, `${name} ${run.width} ${run.locale}: scrollWidth ${sw} > ${w}`);
      await page.screenshot({ path: path.join(SHOTS, `d6-${name}-${run.width}-${run.locale}.png`), fullPage: true });
    };
    await page.goto(`${BASE}/${run.locale}/order/confirmation?orderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber)}&paid=true`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-confirmation-page] [data-order-qr]").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1200);
    await shot("confirmation");
    await page.goto(`${BASE}/${run.locale}/order/check-in?orderQrCode=${encodeURIComponent(order.orderQrCode!)}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-checkin-page]").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(800);
    await shot("check-in");
    await page.goto(`${BASE}/${run.locale}/order/scan?orderQrCode=${encodeURIComponent(order.orderQrCode!)}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-scan-page]").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(800);
    await shot("scan");
    await page.goto(`${BASE}/${run.locale}/pod?qr=${encodeURIComponent(pod.qrCode)}`, { waitUntil: "domcontentloaded" });
    await page.locator(`[data-pod-page] svg [data-pod="${pod.label}"][data-selected="true"]`).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1200);
    await shot("pod");
    await ctx.close();
  }
});
