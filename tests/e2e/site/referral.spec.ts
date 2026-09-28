/**
 * Referral and challenges e2e (Task D9): /{locale}/referral,
 * /{locale}/challenges and /{locale}/challenges/meal-for-stranger.
 *
 *  1. Signed out, /en/referral: the pitch with the program's amounts and the
 *     cap ("Up to 10 paid referrals every 30 days", from GET
 *     /membership/program), and a sign-in panel where the link would be.
 *  2. Signed in: the member's link is /order?ref=<their code>; the numbers are
 *     the REFERRAL CreditLots (earned $10, 2 first bowls), friends joined,
 *     the cap meter; Share hands the link to navigator.share; with no share
 *     sheet, Copy puts it on the clipboard; the QR sheet opens.
 *  3. zh-TW, signed in: no English on the page (brand allowlist aside).
 *  4. /challenges: the DB challenges with their localized names (en and
 *     zh-TW from Challenge.i18n); the Give a meal card opens the giving page.
 *  5. Giving a meal: a signed-in member pays $25.00 with the test card; the
 *     MealGift row is funded by a PaymentIntent that Stripe reports as
 *     succeeded for exactly 2500 with metadata type meal_gift, this giver and
 *     this location.
 *  6. Reduced motion: every section is visible on all three pages.
 *  Every page: iPhone 15 metrics, no horizontal overflow, no emoji, axe
 *  (wcag2a/aa) clean.
 *
 *   E2E_BASE_URL=http://localhost:3300 node --env-file=.env --test tests/e2e/site/referral.spec.ts
 *
 * Needs the lane's web (3300) and API (4300) dev servers, CLERK_SECRET_KEY
 * for the Clerk DEVELOPMENT instance and STRIPE_SECRET_KEY (test mode).
 * Creates a throwaway `+clerk_test` Clerk user, DB users, lots, events and a
 * meal gift, and removes them afterwards. With E2E_SHOT_DIR set, the last
 * test saves d9-*.png.
 */
import { test, after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Frame, type Page } from "playwright";
import { PrismaClient } from "../../../packages/db/index.js";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3300";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const CLERK_KEY = process.env.CLERK_SECRET_KEY || "";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const AXE = new URL("../../../apps/web/node_modules/axe-core/axe.min.js", import.meta.url).pathname;
const EMOJI = /\p{Extended_Pictographic}/u;
const PACE_MS = Number(process.env.E2E_PACE_MS ?? 5_000);
const CITY_CREEK = "cmip6jbz700022nnnxxpmm5hf";
const DAY = 864e5;

const prisma = new PrismaClient();
const tag = `e2e-d9-${Date.now()}`;
const email = `${tag}+clerk_test@example.com`;
let browser: Browser;
let clerkUserId = "";
let dbUserId = "";
let referralCode = "";
const friendIds: string[] = [];

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
  assert.ok(STRIPE_KEY.startsWith("sk_test_"), "STRIPE_SECRET_KEY must be a test key");
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const user = await clerk("/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Mei", last_name: "E2E", skip_password_requirement: true }) });
  clerkUserId = user.id;
  const row = await prisma.user.create({ data: { email: email.toLowerCase(), name: "Mei E2E", creditsCents: 1000 } });
  dbUserId = row.id;
  referralCode = row.referralCode;
  // Two friends joined with the link; both finished a first bowl (two REFERRAL lots, $5 each).
  for (const n of [1, 2]) {
    const f = await prisma.user.create({ data: { email: `${tag}-friend${n}@example.com`, name: `Friend ${n}`, referredById: dbUserId } });
    friendIds.push(f.id);
  }
  await prisma.creditLot.createMany({
    data: [
      { userId: dbUserId, source: "REFERRAL", amountCents: 500, remainingCents: 500, expiresAt: new Date(Date.now() + 80 * DAY), note: tag, createdAt: new Date(Date.now() - 10 * DAY) },
      { userId: dbUserId, source: "REFERRAL", amountCents: 500, remainingCents: 500, expiresAt: new Date(Date.now() + 88 * DAY), note: tag, createdAt: new Date(Date.now() - 2 * DAY) },
    ],
  });
  await prisma.creditEvent.createMany({
    data: [
      { userId: dbUserId, type: "REFERRAL_ORDER", amountCents: 500, description: tag, createdAt: new Date(Date.now() - 10 * DAY) },
      { userId: dbUserId, type: "REFERRAL_ORDER", amountCents: 500, description: tag, createdAt: new Date(Date.now() - 2 * DAY) },
    ],
  });
});

after(async () => {
  await browser?.close();
  const tryDel = async (label: string, fn: () => Promise<unknown>) => fn().catch((e) => console.log(`[cleanup] ${label}: ${String(e.message).split("\n").pop()}`));
  if (dbUserId) {
    const gifts = await prisma.mealGift.findMany({ where: { giverId: dbUserId } });
    await tryDel("mealGiftChain", () => prisma.mealGiftChain.deleteMany({ where: { mealGiftId: { in: gifts.map((g) => g.id) } } }));
    await tryDel("mealGift", () => prisma.mealGift.deleteMany({ where: { giverId: dbUserId } }));
    await tryDel("creditEvent", () => prisma.creditEvent.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("creditLot", () => prisma.creditLot.deleteMany({ where: { userId: dbUserId } }));
  }
  for (const id of friendIds) await tryDel("friend", () => prisma.user.delete({ where: { id } }));
  if (dbUserId) await tryDel("user", () => prisma.user.delete({ where: { id: dbUserId } }));
  if (clerkUserId) await tryDel("clerk", () => clerk(`/users/${clerkUserId}`, { method: "DELETE" }));
  await prisma.$disconnect();
});

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

async function open(page: Page, url: string, ready: string) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(ready).first().waitFor({ timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
}

async function signIn(page: Page, url: string, ready: string) {
  await open(page, url, ready);
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true, null, { timeout: 60_000 });
  await page.evaluate(async (ticket) => {
    const Clerk = (window as unknown as { Clerk: any }).Clerk;
    const si = await Clerk.client.signIn.create({ strategy: "ticket", ticket });
    await Clerk.setActive({ session: si.createdSessionId });
  }, token);
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user), null, { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
}

/** Wait until React has attached its handlers to the element (the dev server hydrates slowly). */
async function hydrated(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    },
    selector,
    { timeout: 90_000 },
  );
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

async function checkPage(page: Page, name: string) {
  const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
  assert.ok(sw <= w, `${name}: document scrollWidth ${sw} > ${w}`);
  const text = await page.evaluate(() => document.body.innerText);
  assert.ok(!EMOJI.test(text), `${name}: emoji in the DOM: ${text.match(EMOJI)?.[0]}`);
  await axe(page, name);
}

/** Latin words on a zh page, minus the brand allowlist. */
function englishLeaks(text: string): string[] {
  const allow = new Set(["Oh", "Wagyu", "Chappy", "Stripe", "Apple", "Pay", "Google", "QR"]);
  return (text.match(/[A-Za-z]{2,}/g) || []).filter((w) => !allow.has(w));
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

test("signed out: the pitch, the program's cap, and a sign-in panel", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/en/referral", "[data-referral-signin]");
  const text = await page.locator("[data-referral-page]").innerText();
  assert.match(text, /Give \$5\. Get \$5\./);
  assert.match(text, /Up to 10 paid referrals every 30 days\./);
  assert.match(text, /not cash and never go back to a card/);
  assert.equal(await page.locator("[data-referral-link]").count(), 0, "no link for a guest");
  await checkPage(page, "referral signed out");
  await ctx.close();
});

test("signed in: the member's link, REFERRAL-lot earnings, share, copy and QR", async () => {
  const ctx = await newContext();
  await ctx.addInitScript(() => {
    (window as unknown as { __shared: unknown[] }).__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: unknown) => void (window as unknown as { __shared: unknown[] }).__shared.push(data),
    });
  });
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await signIn(page, "/en/referral", "[data-referral-page]");
  const link = page.locator("[data-referral-link]");
  await link.waitFor({ timeout: 60_000 });
  const url = await link.inputValue();
  assert.equal(url, `${BASE}/order?ref=${encodeURIComponent(referralCode)}`);
  // CountUp runs once the stats scroll into view.
  await page.locator("[data-referral-stat=\"earned\"]").scrollIntoViewIfNeeded();
  await page.locator('[data-referral-stat="earned"]').getByText("$10", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal((await page.locator('[data-referral-stat="joined"] dd').innerText()).trim(), "2");
  assert.equal((await page.locator('[data-referral-stat="paid"] dd').innerText()).trim(), "2");
  assert.match(await page.locator("[data-referral-cap]").innerText(), /8 of 10 left/);
  assert.equal(await page.locator("[data-referral-history] li").count(), 2);
  await checkPage(page, "referral signed in");

  // Primary CTA: the share sheet gets the link.
  await hydrated(page, "[data-referral-share]");
  await page.locator("[data-referral-share]").click();
  const shared = (await page.evaluate(() => (window as unknown as { __shared: { url: string }[] }).__shared)) as { url: string; text: string }[];
  assert.equal(shared.length, 1);
  assert.equal(shared[0].url, url);
  assert.match(shared[0].text, /\$5/);

  // QR sheet.
  await page.locator("[data-referral-qr]").click();
  await page.locator("[data-referral-qr-sheet] svg").first().waitFor({ timeout: 30_000 });
  await axe(page, "referral QR sheet");
  await page.keyboard.press("Escape");
  await ctx.close();

  // No share sheet (desktop): Copy puts the link on the clipboard.
  const desk = await newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const dp = await desk.newPage();
  await hideDevBadge(dp);
  await signIn(dp, "/en/referral", "[data-referral-page]");
  await dp.locator("[data-referral-link]").waitFor({ timeout: 60_000 });
  await hydrated(dp, "[data-referral-copy]");
  await dp.locator("[data-referral-copy]").click();
  await dp.locator("[data-referral-status]").getByText("Link copied").waitFor({ timeout: 10_000 });
  assert.equal(await dp.evaluate(() => navigator.clipboard.readText()), url);
  await checkPage(dp, "referral 1440");
  await desk.close();
});

test("zh-TW signed in: no English on the referral page", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await signIn(page, "/zh-TW/referral", "[data-referral-page]");
  await page.locator("[data-referral-link]").waitFor({ timeout: 60_000 });
  const text = await page.locator("#site-main").innerText();
  assert.match(text, /分享我的連結/);
  // The link itself is a URL, not copy: read the text outside the input.
  assert.deepEqual(englishLeaks(text), [], "English on the zh-TW referral page");
  await checkPage(page, "referral zh-TW");
  await ctx.close();
});

test("challenges: localized DB names, and Give a meal opens the giving page", async () => {
  const rows = await prisma.challenge.findMany({ where: { isActive: true } });
  assert.ok(rows.length > 0, "active challenges in the DB");
  for (const locale of ["en", "zh-TW"] as const) {
    const ctx = await newContext();
    const page = await ctx.newPage();
    await hideDevBadge(page);
    await open(page, `/${locale}/challenges`, "[data-challenges-page]");
    for (const c of rows.filter((r) => r.slug !== "meal-for-stranger")) {
      const want = ((c.i18n as Record<string, { name?: string }> | null)?.[locale]?.name) || c.name;
      assert.match(await page.locator(`[data-challenge="${c.slug}"]`).innerText(), new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    if (locale === "zh-TW") assert.deepEqual(englishLeaks(await page.locator("#site-main").innerText()), [], "English on zh-TW challenges");
    await checkPage(page, `challenges ${locale}`);
    if (locale === "en") {
      await page.locator("[data-challenges-give]").click();
      await page.waitForURL(/\/en\/challenges\/meal-for-stranger$/, { timeout: 60_000 });
      await page.locator("[data-give-form]").waitFor();
    }
    await ctx.close();
  }
});

test("giving a meal: a verified PaymentIntent funds the gift", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (err) => console.log("[page error]", err.message));
  await hideDevBadge(page);
  await signIn(page, "/en/challenges/meal-for-stranger", "[data-give-form]");
  await checkPage(page, "give form signed in");
  await hydrated(page, `[data-give-location="${CITY_CREEK}"]`);
  await page.locator(`[data-give-location="${CITY_CREEK}"]`).click();
  await page.locator('[data-give-amount="2500"]').click();
  await page.locator("[data-give-message]").fill("Enjoy your bowl.");
  const cont = page.locator("[data-give-continue]");
  await cont.waitFor({ timeout: 60_000 });
  assert.match(await cont.innerText(), /\$25\.00/);
  await cont.click();

  await page.locator("[data-give-pay-step]").waitFor({ timeout: 60_000 });
  const frame = await stripeFrame(page);
  await frame.locator('input[name="number"]').fill("4242424242424242");
  await frame.locator('input[name="expiry"]').fill("12 / 34");
  await frame.locator('input[name="cvc"]').fill("123");
  const zip = frame.locator('input[name="postalCode"]');
  if (await zip.count()) await zip.fill("84101");
  await page.locator("[data-give-pay]").click();

  await page.locator("[data-give-done]").waitFor({ timeout: 90_000 });
  const gift = await prisma.mealGift.findFirst({ where: { giverId: dbUserId }, orderBy: { createdAt: "desc" } });
  assert.ok(gift, "a MealGift row for this giver");
  assert.equal(gift.amountCents, 2500);
  assert.equal(gift.locationId, CITY_CREEK);
  assert.equal(gift.status, "PENDING");
  assert.equal(gift.messageFromGiver, "Enjoy your bowl.");
  assert.ok(gift.paidAt, "paidAt set");
  assert.ok(gift.expiresAt.getTime() > Date.now(), "expires later");
  assert.ok(gift.stripePaymentIntentId?.startsWith("pi_"), "funded by a PaymentIntent");
  const pi = await (await fetch(`https://api.stripe.com/v1/payment_intents/${gift.stripePaymentIntentId}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } })).json();
  assert.equal(pi.status, "succeeded");
  assert.equal(pi.amount, 2500);
  assert.equal(pi.metadata?.type, "meal_gift");
  assert.equal(pi.metadata?.giverId, dbUserId);
  assert.equal(pi.metadata?.locationId, CITY_CREEK);
  await checkPage(page, "give done");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "d9-give-done-390-en.png"), fullPage: true });

  // Recording the same PaymentIntent again is refused (one gift per payment).
  const count = await prisma.mealGift.count({ where: { stripePaymentIntentId: gift.stripePaymentIntentId } });
  assert.equal(count, 1);
  await ctx.close();
});

test("reduced motion: every section is visible", async () => {
  const ctx = await newContext({ ...iphone15(), reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await hideDevBadge(page);
  for (const [url, ready, sections] of [
    ["/en/referral", "[data-referral-signin]", ["[data-referral-step]", "[data-referral-rules]", "[data-referral-more]"]],
    ["/en/challenges", "[data-challenges-page]", ["[data-challenges-give]", "[data-challenges-refer]", "[data-challenge]"]],
    ["/en/challenges/meal-for-stranger", "[data-give-form]", ["[data-give-steps]", "[data-give-form]"]],
  ] as const) {
    await open(page, url, ready);
    for (const sel of sections) {
      const el = page.locator(sel).last();
      await el.scrollIntoViewIfNeeded();
      assert.ok(await el.isVisible(), `${url} ${sel} visible`);
      const opacity = await el.evaluate((n) => {
        let o = 1;
        for (let e: Element | null = n; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
        return o;
      });
      assert.ok(opacity > 0.99, `${url} ${sel} fully opaque under reduced motion (${opacity})`);
    }
  }
  await ctx.close();
});

test("screenshots", { skip: !SHOTS }, async () => {
  const runs = [
    { locale: "en", width: 390, opts: iphone15() },
    { locale: "zh-TW", width: 390, opts: iphone15() },
    { locale: "es", width: 360, opts: { ...iphone15(), viewport: { width: 360, height: 780 }, screen: { width: 360, height: 780 } } },
    { locale: "en", width: 1440, opts: { viewport: { width: 1440, height: 900 } } },
    { locale: "zh-TW", width: 1440, opts: { viewport: { width: 1440, height: 900 } } },
  ];
  for (const run of runs.filter((r) => !process.env.E2E_SHOT_ONLY || `${r.locale}-${r.width}` === process.env.E2E_SHOT_ONLY)) {
    const ctx = await newContext({ ...run.opts, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await hideDevBadge(page);
    const shot = async (name: string) => {
      // Scroll through once so lazy photos load, then settle at the top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SHOTS, `d9-${name}-${run.width}-${run.locale}.png`), fullPage: true });
    };
    // Signed out first.
    await open(page, `/${run.locale}/referral`, "[data-referral-signin]");
    await shot("referral-signedout");
    await open(page, `/${run.locale}/challenges`, "[data-challenges-page]");
    await shot("challenges");
    await open(page, `/${run.locale}/challenges/meal-for-stranger`, "[data-give-form]");
    await shot("give-signedout");
    // Signed in.
    await signIn(page, `/${run.locale}/referral`, "[data-referral-page]");
    // The Clerk dev handshake after sign-in drops the context's reducedMotion emulation; set it again.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("[data-referral-link]").waitFor({ timeout: 60_000 });
    await shot("referral");
    if (run.width !== 1440) {
      await hydrated(page, "[data-referral-qr]");
      await page.locator("[data-referral-qr]").click();
      await page.locator("[data-referral-qr-sheet] svg").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SHOTS, `d9-referral-qr-${run.width}-${run.locale}.png`) });
      await page.keyboard.press("Escape");
    }
    await open(page, `/${run.locale}/challenges/meal-for-stranger`, "[data-give-form]");
    await page.locator("[data-give-continue]").waitFor({ timeout: 60_000 });
    await shot("give");
    await hydrated(page, "[data-give-continue]");
    await page.locator("[data-give-continue]").click();
    await page.locator("[data-give-pay-step]").waitFor({ timeout: 60_000 });
    await stripeFrame(page);
    await page.waitForTimeout(800);
    await shot("give-pay");
    await ctx.close();
  }
});
