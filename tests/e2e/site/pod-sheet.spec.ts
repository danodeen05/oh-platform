/**
 * Pod map sheet regression (follow-up D). "Choose my own" on the order
 * flow's Your Pod step opens the CombMap in a Sheet. The sheet used to render
 * in place, inside the step body's `.oh-step-in` wrapper, whose `transform`
 * animation (fill-mode both) made it the containing block of the sheet's
 * `position: fixed` and a stacking context under the z-40 top bar: the sheet
 * was pushed up past the top of the screen and the top bar and desktop nav
 * painted over it. The Sheet now renders through a portal.
 *
 * At 390x844 (iPhone 15) and at 768x1024, 1024x768, 1280x800 and 1440x900
 * (desktop Chromium), with the sheet open:
 *  - the panel's top is at 0 or below and the whole panel fits the viewport;
 *  - the CombMap (the SVG and its zoom controls) is fully in view, above the
 *    sticky Confirm bar, and the Confirm button is in view;
 *  - `document.elementFromPoint` just inside the panel's top edge hits the
 *    dialog, and at the top bar's row it hits the sheet's backdrop, never the
 *    top bar or its nav;
 *  - the page behind is scroll-locked, focus is inside the dialog, and Esc
 *    closes it with focus back on "Choose my own".
 *
 *   E2E_BASE_URL=http://localhost:3400 E2E_API_URL=http://localhost:4400 \
 *     node --env-file=.env --test tests/e2e/site/pod-sheet.spec.ts
 *
 * Needs web + API dev servers, dine-in ordering on and CLERK_SECRET_KEY for
 * the Clerk DEVELOPMENT instance. Signs in like order.spec.ts: a throwaway
 * `+clerk_test` user and a one-time sign-in token. It never places an order;
 * the Clerk user and its DB row are removed afterwards.
 *
 * Screenshots: with E2E_SHOT_DIR set, saves <E2E_SHOT_PREFIX>-<width>.png
 * (prefix defaults to fu-D-after) with the sheet open, before asserting.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import { PrismaClient } from "../../../packages/db/index.js";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3400";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const PREFIX = process.env.E2E_SHOT_PREFIX || "fu-D-after";
const CLERK_KEY = process.env.CLERK_SECRET_KEY || "";
const CITY_CREEK = "cmip6jbz700022nnnxxpmm5hf";

const prisma = new PrismaClient();
const tag = `e2e-fuD-${Date.now()}`;
const email = `${tag}+clerk_test@example.com`;
let browser: Browser;
let clerkUserId = "";
let dbUserId = "";

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
  const user = await clerk("/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Pod", last_name: "E2E", skip_password_requirement: true }) });
  clerkUserId = user.id;
  const row = await prisma.user.create({ data: { email: email.toLowerCase(), name: "Pod E2E" } });
  dbUserId = row.id;
});

after(async () => {
  await browser?.close();
  if (dbUserId) {
    // Nothing is ordered; a failed step may still have left an order behind.
    const orders = await prisma.order.findMany({ where: { userId: dbUserId } });
    if (orders.length) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: dbUserId } }).catch((e) => console.log(`[cleanup] user: ${e.message.split("\n").pop()}`));
  }
  if (clerkUserId) await clerk(`/users/${clerkUserId}`, { method: "DELETE" }).catch((e) => console.log(`[cleanup] clerk: ${e.message}`));
  await prisma.$disconnect();
});

function iphone15(): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return d;
}

async function newContext(opts: Parameters<Browser["newContext"]>[0]): Promise<BrowserContext> {
  const ctx = await browser.newContext(opts);
  // The Next.js dev badge sits in a corner and can cover what we measure.
  await ctx.addInitScript(() => {
    const hide = () => {
      const st = document.createElement("style");
      st.textContent = "nextjs-portal{display:none!important}";
      document.head?.appendChild(st);
    };
    if (document.head) hide();
    else document.addEventListener("DOMContentLoaded", hide);
  });
  return ctx;
}

async function signIn(page: Page) {
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.goto(`${BASE}/en/order`, { waitUntil: "domcontentloaded", timeout: 120_000 });
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

async function step(page: Page, name: string) {
  await page.locator(`[data-order-step="${name}"]`).waitFor({ state: "visible", timeout: 60_000 });
}

async function cta(page: Page) {
  await page
    .waitForFunction(() => {
      const b = document.querySelector("[data-order-cta]") as HTMLButtonElement | null;
      return b && !b.disabled && b.getAttribute("aria-busy") !== "true";
    }, null, { timeout: 60_000 })
    .catch(async (err) => {
      const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
      const onStep = await page.locator("[data-order-step]").getAttribute("data-order-step").catch(() => null);
      throw new Error(`the CTA never became ready on step ${onStep} (alerts: ${JSON.stringify(alerts)}): ${err.message.split("\n")[0]}`);
    });
  await page.locator("[data-order-cta]").click();
}

/** Location, the default bowl, as soon as possible, then the pod step. */
async function toPodStep(page: Page) {
  await page.goto(`${BASE}/en/order`, { waitUntil: "domcontentloaded" });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator(`[data-location-card="${CITY_CREEK}"]`).click();
    if (await page.locator('[data-order-step="bowl"]').waitFor({ state: "visible", timeout: 12_000 }).then(() => true, () => false)) break;
  }
  await step(page, "bowl");
  await cta(page);
  await step(page, "arrival");
  await page.locator('[data-arrival="asap"]').click();
  await cta(page);
  await step(page, "pod");
}

type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number };

/** Waits until the panel has stopped moving (the spring has settled). */
async function settled(page: Page) {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const panel = document.querySelector('[role="dialog"]');
        if (!panel) return resolve(false);
        const a = panel.getBoundingClientRect().top;
        setTimeout(() => resolve(Math.abs(panel.getBoundingClientRect().top - a) < 0.5), 250);
      }),
    null,
    { timeout: 15_000 },
  );
}

async function checkSheet(page: Page, name: string) {
  const pick = page.locator('[data-pod-mode="pick"]');
  await pick.scrollIntoViewIfNeeded();
  await pick.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  await dialog.locator("svg[data-layout]").waitFor({ state: "visible", timeout: 60_000 });
  await dialog.locator("[data-pod]").first().waitFor({ state: "attached", timeout: 30_000 });
  await settled(page);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-${name}.png`) });

  const m = await page.evaluate(() => {
    const r = (el: Element | null): Rect | null => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height };
    };
    const panel = document.querySelector('[role="dialog"]') as HTMLElement;
    const inDialog = (el: Element | null) => Boolean(el && panel.contains(el));
    const inSheetRoot = (el: Element | null) => Boolean(el?.closest(".oh-sheet-root"));
    const describe = (el: Element | null) => (el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.getAttribute("class") || "").slice(0, 60)}` : "null");
    const p = r(panel)!;
    const topHit = document.elementFromPoint(p.left + p.width / 2, Math.max(0, p.top) + 10);
    const topBar = document.querySelector("[data-site-topbar]");
    const tb = r(topBar);
    const barHit = tb ? document.elementFromPoint(tb.left + tb.width / 2, Math.max(1, tb.top + tb.height / 2)) : null;
    const confirm = panel.querySelector("[data-pod-confirm]");
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      panel: p,
      svg: r(panel.querySelector("svg[data-layout]")),
      controls: r(panel.querySelector("[data-comb-controls]")),
      confirm: r(confirm),
      confirmBar: r(confirm?.parentElement ?? null),
      topHitInDialog: inDialog(topHit),
      topHit: describe(topHit),
      barHitInSheet: barHit ? inSheetRoot(barHit) : null,
      barHitInTopBar: barHit ? Boolean(topBar?.contains(barHit)) : null,
      barHit: describe(barHit),
      focusInDialog: inDialog(document.activeElement),
      bodyLocked: document.body.style.position === "fixed",
      scrollY: window.scrollY,
    };
  });
  const at = `${name} (${m.vw}x${m.vh})`;
  const eps = 1;

  assert.ok(m.panel.top >= -eps, `${at}: the sheet's top ${m.panel.top} is on screen`);
  assert.ok(m.panel.bottom <= m.vh + eps, `${at}: the sheet's bottom ${m.panel.bottom} fits in ${m.vh}`);
  assert.ok(m.panel.left >= -eps && m.panel.right <= m.vw + eps, `${at}: the sheet fits the width`);

  assert.ok(m.svg, `${at}: the CombMap is in the dialog`);
  assert.ok(m.svg.top >= m.panel.top - eps && m.svg.top >= -eps, `${at}: the map's top ${m.svg.top} is in view`);
  assert.ok(m.confirmBar, `${at}: the Confirm bar is in the dialog`);
  assert.ok(m.svg.bottom <= m.confirmBar.top + eps, `${at}: the map's bottom ${m.svg.bottom} is above the Confirm bar at ${m.confirmBar.top}`);
  assert.ok(m.svg.left >= -eps && m.svg.right <= m.vw + eps, `${at}: the map fits the width`);
  assert.ok(m.controls, `${at}: the map's zoom controls render`);
  assert.ok(m.controls.top >= m.panel.top - eps && m.controls.bottom <= m.confirmBar.top + eps, `${at}: the zoom controls (${m.controls.top}-${m.controls.bottom}) are in view above the Confirm bar at ${m.confirmBar.top}`);
  assert.ok(m.confirm && m.confirm.top >= 0 && m.confirm.bottom <= m.vh + eps, `${at}: the Confirm button is in view`);

  assert.ok(m.topHitInDialog, `${at}: the top of the sheet is the dialog, not ${m.topHit}`);
  if (m.barHitInSheet !== null) {
    assert.equal(m.barHitInTopBar, false, `${at}: the top bar paints over the sheet (${m.barHit})`);
    assert.equal(m.barHitInSheet, true, `${at}: the sheet's backdrop covers the top bar (hit ${m.barHit})`);
  }

  assert.ok(m.focusInDialog, `${at}: focus moved into the dialog`);
  assert.ok(m.bodyLocked, `${at}: the page behind is scroll-locked`);
  await page.mouse.move(m.vw / 2, Math.max(4, m.panel.top / 2));
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.scrollY), m.scrollY, `${at}: the page behind did not scroll`);

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-pod-mode")), "pick", `${at}: Esc returns focus to Choose my own`);
}

test("phone (iPhone 15 metrics): the pod map sheet is fully on screen, above the top bar", async () => {
  const ctx = await newContext({ ...iphone15(), viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage();
    await signIn(page);
    await toPodStep(page);
    await checkSheet(page, "390");
    // Safari with its toolbars showing: iPhone 15's default Playwright viewport.
    await page.setViewportSize({ width: 393, height: 659 });
    await page.waitForTimeout(300);
    await checkSheet(page, "393x659");
  } finally {
    await ctx.close();
  }
});

test("tablet and desktop: the pod map sheet is fully on screen, above the top bar and desktop nav", async () => {
  const ctx = await newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await ctx.newPage();
    await signIn(page);
    await toPodStep(page);
    // Two of us: the owner's report, and the duo pods light up.
    await page.locator('[data-party="2"]').click();
    for (const [w, h] of [
      [1280, 800],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      await checkSheet(page, String(w));
    }
  } finally {
    await ctx.close();
  }
});
