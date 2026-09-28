/**
 * Member passport e2e (Task D8): /member, /member/orders, /member/credits,
 * the welcome sheet on first sign-in and the tier-up moment.
 *
 *  1. Signed out: /member shows a translated sign-in state with a link to
 *     /rewards (no Clerk redirect).
 *  2. A fresh member sees the welcome sheet (4 screens) once; finishing it
 *     records welcomeSeenAt and a reload shows the passport without it.
 *  3. The passport: arcs read orders 3/10 and referrals 1/2 from the seeded
 *     profile, the free bowl has a countdown and links to /order (the primary
 *     CTA), the expiring-soon alert shows, the earned seal is filled, no
 *     overflow on the iPhone 15 profile, axe clean, and reduced motion shows
 *     every section.
 *  4. After forcing a tier (Prisma on the lane DB; the lane has no
 *     ADMIN_API_KEY), the tier-up moment shows once with the free-bowl reveal
 *     and a vibration, and never again after it is closed.
 *  5. zh-TW: the passport, credits and orders pages show no English.
 *  6. Orders and credits subpages: translated statuses and events, no
 *     overflow, axe clean. 1440: no overflow.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here):
 *
 *   E2E_BASE_URL=http://localhost:3200 node --env-file=.env --test tests/e2e/site/member.spec.ts
 *
 * Sign-in: the D5/A10 approach. A throwaway `+clerk_test` user is created
 * through the Clerk Backend API (DEVELOPMENT instance, CLERK_SECRET_KEY from
 * .env, checked to be sk_test_), the matching DB user is seeded in the lane
 * DB, and each browser context signs in with a one-time sign-in token
 * (`signIn.create({strategy: "ticket"})`). Everything it creates is removed
 * afterwards.
 *
 * Screenshots: with E2E_SHOT_DIR set, the tests save d8-*.png there.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import { PrismaClient } from "../../../packages/db/index.js";
import { englishLeaks } from "../../../apps/web/lib/site/i18n-allowlist.ts";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3200";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const CLERK_KEY = process.env.CLERK_SECRET_KEY || "";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../../../apps/web");
const requireFromWeb = createRequire(path.join(WEB, "package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");
const DAY = 864e5;

const prisma = new PrismaClient();
const tag = `e2e-d8-${Date.now()}`;
const email = `${tag}+clerk_test@example.com`;
let browser: Browser;
let clerkUserId = "";
let dbUserId = "";
const orderIds: string[] = [];

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
  const user = await clerk("/users", {
    method: "POST",
    body: JSON.stringify({ email_address: [email], first_name: "Mei", last_name: "Passport", skip_password_requirement: true }),
  });
  clerkUserId = user.id;
  const row = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: "Mei Passport",
      membershipTier: "CHOPSTICK",
      tierProgressOrders: 3,
      tierProgressReferrals: 1,
      currentStreak: 2,
      longestStreak: 4,
      lifetimeOrderCount: 3,
      creditsCents: 700,
      referralCode: `D8${Date.now().toString(36).toUpperCase()}`,
    },
  });
  dbUserId = row.id;
  await prisma.reward.create({ data: { userId: dbUserId, type: "FREE_BOWL", issuedFor: tag, windowEndsAt: new Date(Date.now() + 20 * DAY) } });
  // $7.00 of credit; $2.00 of it expires in 4 days (the expiring-soon alert).
  await prisma.creditLot.createMany({
    data: [
      { userId: dbUserId, source: "CASHBACK", amountCents: 200, remainingCents: 200, expiresAt: new Date(Date.now() + 4 * DAY), note: `${tag} [expiry-warned]` },
      { userId: dbUserId, source: "REFERRAL", amountCents: 500, remainingCents: 500, expiresAt: new Date(Date.now() + 60 * DAY), note: tag },
    ],
  });
  await prisma.creditEvent.createMany({
    data: [
      { userId: dbUserId, type: "REFERRAL_ORDER", amountCents: 500, description: "Referral credit" },
      { userId: dbUserId, type: "CASHBACK", amountCents: 200, description: "Cashback" },
      { userId: dbUserId, type: "CREDIT_APPLIED", amountCents: -150, description: "Credits used" },
    ],
  });
  const firstOrder = await prisma.badge.findUnique({ where: { slug: "first-order" } });
  if (firstOrder) await prisma.userBadge.create({ data: { userId: dbUserId, badgeId: firstOrder.id } });
  // Two paid orders for /member/orders.
  const location = await prisma.location.findFirst({ where: { name: "City Creek" } });
  const bowl = location
    ? await prisma.menuItem.findFirst({ where: { tenantId: location.tenantId, name: "Classic Beef Noodle Soup" } })
    : null;
  if (location && bowl) {
    for (const [i, status] of (["COMPLETED", "PREPPING"] as const).entries()) {
      const o = await prisma.order.create({
        data: {
          orderNumber: `ORD-${tag}-${i}`,
          kitchenOrderNumber: `00${i + 4}`,
          status,
          paymentStatus: "PAID",
          totalCents: 1599 + i * 200,
          tenantId: location.tenantId,
          locationId: location.id,
          userId: dbUserId,
          createdAt: new Date(Date.now() - (i === 0 ? 9 : 0) * DAY - 3600e3),
          items: { create: [{ menuItemId: bowl.id, quantity: 1, priceCents: 1599 }] },
        },
      });
      orderIds.push(o.id);
    }
  }
});

after(async () => {
  await browser?.close();
  const tryDel = async (label: string, fn: () => Promise<unknown>) =>
    fn().catch((e) => console.log(`[cleanup] ${label}: ${String(e.message).split("\n").pop()}`));
  await tryDel("orderItem", () => prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }));
  await tryDel("order", () => prisma.order.deleteMany({ where: { id: { in: orderIds } } }));
  if (dbUserId) {
    await tryDel("creditEvent", () => prisma.creditEvent.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("creditLot", () => prisma.creditLot.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("reward", () => prisma.reward.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("userBadge", () => prisma.userBadge.deleteMany({ where: { userId: dbUserId } }));
    await tryDel("user", () => prisma.user.delete({ where: { id: dbUserId } }));
  }
  if (clerkUserId) await clerk(`/users/${clerkUserId}`, { method: "DELETE" }).catch((e) => console.log(`[cleanup] clerk: ${e.message}`));
  await prisma.$disconnect();
});

type Ctx = Parameters<Browser["newContext"]>[0];

// iPhone 15 metrics, driven through Chromium (WebKit isn't installed here).
function iphone15(extra: Ctx = {}): Ctx {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return { ...d, ...extra };
}

async function shot(page: Page, name: string, fullPage = false) {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
}

/** A context signed in as the test member (one-time Clerk sign-in token). */
async function signedIn(opts: Ctx, locale = "en"): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => {
    (window as unknown as { __vibrations: unknown[] }).__vibrations = [];
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (p: unknown) => {
        (window as unknown as { __vibrations: unknown[] }).__vibrations.push(p);
        return true;
      },
    });
  });
  const page = await ctx.newPage();
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.goto(`${BASE}/${locale}/rewards`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true, null, { timeout: 60_000 });
  await page.evaluate(async (ticket) => {
    const Clerk = (window as unknown as { Clerk: any }).Clerk;
    const si = await Clerk.client.signIn.create({ strategy: "ticket", ticket });
    await Clerk.setActive({ session: si.createdSessionId });
  }, token);
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user), null, { timeout: 30_000 });
  return { ctx, page };
}

async function noOverflow(page: Page, label: string) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw, `${label}: scrollWidth ${sw} > innerWidth ${iw}`);
}

async function axe(page: Page, label: string) {
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 10_000 })
    .catch(() => undefined);
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: any }).axe.run(
      { exclude: [["iframe"], ["[data-clerk-portal]"], [".cl-rootBox"]] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } },
    );
    return r.violations.map((v: any) => `${v.id}: ${v.nodes.slice(0, 3).map((n: any) => n.target.join(" ")).join(" | ")}`);
  });
  assert.deepEqual(violations, [], `${label}: axe violations ${JSON.stringify(violations)}`);
}

async function passportReady(page: Page) {
  await page.locator('[data-passport-state="ready"]').waitFor({ state: "visible", timeout: 90_000 });
}

async function setUser(data: Record<string, unknown>) {
  await prisma.user.update({ where: { id: dbUserId }, data });
}

/**
 * Visible text plus alt/aria-label/placeholder/title, as the English-leak
 * crawl collects it. The member's own name and member number are their
 * data, not copy, so they are left out.
 */
const MEMBER_DATA = ["[data-member-name]", "[data-member-code]"];
async function leaks(page: Page, extraSkip: string[] = []): Promise<string[]> {
  const skip = [...MEMBER_DATA, ...extraSkip];
  const lines = await page.evaluate((skipSelectors) => {
    const root = document.querySelector("#site-main") as HTMLElement;
    const clone = root.cloneNode(true) as HTMLElement;
    for (const sel of skipSelectors) clone.querySelectorAll(sel).forEach((n) => n.remove());
    const out: string[] = [];
    document.body.appendChild(clone);
    clone.style.position = "absolute";
    clone.style.left = "-99999px";
    out.push(...clone.innerText.split("\n"));
    clone.querySelectorAll("[alt],[aria-label],[placeholder],[title]").forEach((el) => {
      for (const a of ["alt", "aria-label", "placeholder", "title"]) {
        const v = el.getAttribute(a);
        if (v) out.push(v);
      }
    });
    clone.remove();
    return out;
  }, skip);
  return lines.filter((l) => englishLeaks(l).length > 0);
}

test("signed out: a translated sign-in state with a link to /rewards", async () => {
  for (const locale of ["en", "zh-TW"]) {
    const ctx = await browser.newContext(iphone15());
    const page = await ctx.newPage();
    const res = await page.goto(`${BASE}/${locale}/member`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    assert.equal(res?.status(), 200);
    await page.locator('[data-passport-state="signedOut"]').waitFor({ state: "visible", timeout: 60_000 });
    assert.equal(new URL(page.url()).pathname, `/${locale}/member`, "no redirect to Clerk");
    const href = await page.locator("[data-passport-rewards-link]").getAttribute("href");
    assert.equal(href, `/${locale}/rewards`);
    await page.locator("[data-passport-signin]").waitFor({ state: "visible" });
    await noOverflow(page, `signed out ${locale}`);
    if (locale === "zh-TW") assert.deepEqual(await leaks(page), [], "no English on the signed-out state");
    else await axe(page, "signed out");
    await shot(page, `d8-member-signedout-390-${locale}`, true);
    await ctx.close();
  }
});

test("a fresh member sees the welcome sheet once (4 screens)", async () => {
  const { ctx, page } = await signedIn(iphone15());
  await page.goto(`${BASE}/en/member`, { waitUntil: "domcontentloaded" });
  const sheet = page.locator("[data-welcome-sheet]");
  await sheet.waitFor({ state: "visible", timeout: 90_000 });
  for (let step = 1; step <= 4; step++) {
    await page.locator(`[data-welcome-step="${step}"]`).waitFor({ state: "visible" });
    await shot(page, `d8-welcome-${step}-390-en`);
    if (step === 1) await axe(page, "welcome sheet");
    if (step < 4) await page.locator("[data-welcome-next]").click();
  }
  await page.locator("[data-welcome-finish]").click();
  await sheet.waitFor({ state: "detached", timeout: 15_000 });
  await page.waitForFunction(async () => true);
  // The POST lands; welcomeSeenAt is recorded.
  let row = await prisma.user.findUnique({ where: { id: dbUserId } });
  for (let i = 0; i < 20 && !row?.welcomeSeenAt; i++) {
    await new Promise((r) => setTimeout(r, 250));
    row = await prisma.user.findUnique({ where: { id: dbUserId } });
  }
  assert.ok(row?.welcomeSeenAt, "welcomeSeenAt recorded");
  assert.equal(row?.lastTierCelebrated, "CHOPSTICK", "the starting tier counts as celebrated");
  // No tier-up for the starting tier.
  assert.equal(await page.locator("[data-tier-up]").count(), 0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await passportReady(page);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator("[data-welcome-sheet]").count(), 0, "welcome shows once");
  await ctx.close();
});

test("the passport: arcs, free bowl, credits, seals, CTA, overflow, axe", async () => {
  await setUser({ welcomeSeenAt: new Date(), lastTierCelebrated: "CHOPSTICK" });
  const { ctx, page } = await signedIn(iphone15({ reducedMotion: "reduce" }));
  await page.goto(`${BASE}/en/member`, { waitUntil: "domcontentloaded" });
  await passportReady(page);

  assert.equal((await page.locator('[data-arc="orders"] [data-arc-value]').innerText()).replace(/\s/g, ""), "3/10");
  assert.equal((await page.locator('[data-arc="referrals"] [data-arc-value]').innerText()).replace(/\s/g, ""), "1/2");

  const reward = page.locator('[data-reward="FREE_BOWL"]');
  await reward.waitFor({ state: "visible" });
  assert.match(await reward.locator("[data-reward-countdown]").innerText(), /\d/, "countdown shows a number");

  await page.locator("[data-expiring-alert]").waitFor({ state: "visible" });
  assert.match(await page.locator("[data-credits-balance]").innerText(), /\$7/);
  assert.equal(await page.locator('[data-seal="first-order"]').getAttribute("data-earned"), "true");
  assert.equal(await page.locator('[data-seal="100-orders"]').getAttribute("data-earned"), "false");
  await page.locator("[data-streak]").waitFor({ state: "visible" });

  // Reduced motion: every section heading is visible.
  const hidden = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#site-main h2")).filter((h) => {
      const r = h.getBoundingClientRect();
      return r.height === 0 || Number(getComputedStyle(h).opacity) < 0.99;
    }).length,
  );
  assert.equal(hidden, 0, "all headings visible under reduced motion");

  await noOverflow(page, "passport 390");
  await axe(page, "passport");

  // Primary CTA: the free bowl goes to the order builder.
  const cta = page.locator("[data-passport-cta]");
  assert.equal(await cta.getAttribute("href"), "/en/order");
  await Promise.all([page.waitForURL(/\/en\/order/, { timeout: 60_000 }), cta.click()]);
  await ctx.close();
});

test("the tier-up moment shows once, with the free-bowl reveal and a vibration", async () => {
  await setUser({ welcomeSeenAt: new Date(), lastTierCelebrated: "CHOPSTICK", membershipTier: "NOODLE_MASTER", tierProgressOrders: 0, tierProgressReferrals: 0 });
  await prisma.reward.create({ data: { userId: dbUserId, type: "FREE_BOWL", issuedFor: "upgrade:NOODLE_MASTER", windowEndsAt: new Date(Date.now() + 30 * DAY) } });
  const { ctx, page } = await signedIn(iphone15());
  await page.goto(`${BASE}/en/member`, { waitUntil: "domcontentloaded" });
  const moment = page.locator("[data-tier-up]");
  await moment.waitFor({ state: "visible", timeout: 90_000 });
  assert.match(await moment.innerText(), /Noodle Master/);
  await page.locator("[data-free-bowl-reveal]").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(1600);
  await shot(page, "d8-tierup-390-en");
  const vibrations = await page.evaluate(() => (window as unknown as { __vibrations: unknown[] }).__vibrations);
  assert.deepEqual(vibrations, [30]);
  await axe(page, "tier-up");
  await page.locator("[data-tier-up-close]").click();
  await moment.waitFor({ state: "detached", timeout: 15_000 });
  let row = await prisma.user.findUnique({ where: { id: dbUserId } });
  for (let i = 0; i < 20 && row?.lastTierCelebrated !== "NOODLE_MASTER"; i++) {
    await new Promise((r) => setTimeout(r, 250));
    row = await prisma.user.findUnique({ where: { id: dbUserId } });
  }
  assert.equal(row?.lastTierCelebrated, "NOODLE_MASTER");

  await page.reload({ waitUntil: "domcontentloaded" });
  await passportReady(page);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator("[data-tier-up]").count(), 0, "tier-up shows once");
  await ctx.close();

  // Back to the seeded state for the rest of the file.
  await prisma.reward.deleteMany({ where: { userId: dbUserId, issuedFor: "upgrade:NOODLE_MASTER" } });
  await setUser({ membershipTier: "CHOPSTICK", lastTierCelebrated: "CHOPSTICK", tierProgressOrders: 3, tierProgressReferrals: 1 });
});

test("zh-TW: passport, credits and orders show no English", async () => {
  const { ctx, page } = await signedIn(iphone15({ reducedMotion: "reduce" }), "zh-TW");
  await page.goto(`${BASE}/zh-TW/member`, { waitUntil: "domcontentloaded" });
  await passportReady(page);
  assert.deepEqual(await leaks(page), [], "passport");
  await noOverflow(page, "passport zh-TW");

  await page.goto(`${BASE}/zh-TW/member/credits`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-credits-page="ready"]').waitFor({ state: "visible", timeout: 90_000 });
  assert.deepEqual(await leaks(page), [], "credits");

  await page.goto(`${BASE}/zh-TW/member/orders`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-orders-page="ready"]').waitFor({ state: "visible", timeout: 90_000 });
  // Location names are proper nouns from the DB (location i18n arrives with F1a).
  assert.deepEqual(await leaks(page, ["[data-order-location]"]), [], "orders");
  await ctx.close();
});

test("orders and credits subpages: translated, no overflow, axe", async () => {
  const { ctx, page } = await signedIn(iphone15());
  await page.goto(`${BASE}/en/member/orders`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-orders-page="ready"]').waitFor({ state: "visible", timeout: 90_000 });
  assert.equal(await page.locator("[data-order-card]").count(), orderIds.length);
  const statuses = await page.locator("[data-order-status]").allInnerTexts();
  assert.ok(statuses.every((s) => !/[A-Z]{4,}/.test(s)), `statuses are words, not enum names: ${statuses}`);
  await noOverflow(page, "orders");
  await axe(page, "orders");

  await page.goto(`${BASE}/en/member/credits`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-credits-page="ready"]').waitFor({ state: "visible", timeout: 90_000 });
  assert.ok((await page.locator("[data-credit-event]").count()) >= 3);
  await page.locator("[data-expiring-alert]").waitFor({ state: "visible" });
  const text = await page.locator("#site-main").innerText();
  assert.ok(!text.includes("[expiry-warned]"), "no internal markers");
  await noOverflow(page, "credits");
  await axe(page, "credits");
  await ctx.close();
});

test("1440: the passport has no horizontal overflow", async () => {
  const { ctx, page } = await signedIn({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/member`, { waitUntil: "domcontentloaded" });
  await passportReady(page);
  await noOverflow(page, "passport 1440");
  await ctx.close();
});

test("screenshots", { skip: !SHOTS }, async () => {
  await setUser({ welcomeSeenAt: new Date(), lastTierCelebrated: "CHOPSTICK" });
  const runs: Array<[string, string, Ctx]> = [
    ["en", "390", iphone15({ reducedMotion: "reduce" })],
    ["zh-TW", "390", iphone15({ reducedMotion: "reduce" })],
    ["es", "360", { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" }],
    ["en", "1440", { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }],
  ];
  for (const [locale, width, opts] of runs) {
    const { ctx, page } = await signedIn(opts, locale);
    await page.goto(`${BASE}/${locale}/member`, { waitUntil: "domcontentloaded" });
    await passportReady(page);
    await shot(page, `d8-member-${width}-${locale}`, true);
    // Section-by-section viewport shots (the full page is too tall to read at phone scale).
    if (width !== "1440") {
      for (const [id, sel] of [
        ["cover", "[data-passport-cover]"],
        ["climb", "#climb-title"],
        ["rewards", "#rewards-title"],
        ["credits", "#credits-title"],
        ["seals", "#seals-title"],
        ["wallet", "#wallet-title"],
      ] as const) {
        await page.locator(sel).evaluate((el) => {
          el.scrollIntoView({ block: "start" });
          window.scrollBy(0, -72);
        });
        await shot(page, `d8-member-${width}-${locale}-${id}`);
      }
    }
    if (width !== "1440") {
      await page.goto(`${BASE}/${locale}/member/credits`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-credits-page="ready"]').waitFor({ state: "visible", timeout: 90_000 });
      await shot(page, `d8-credits-${width}-${locale}`, true);
      await page.goto(`${BASE}/${locale}/member/orders`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-orders-page="ready"]').waitFor({ state: "visible", timeout: 90_000 });
      await shot(page, `d8-orders-${width}-${locale}`, true);
    }
    await ctx.close();
  }
});
