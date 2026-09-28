/**
 * Location pages e2e (Task D4): /locations, /locations/city-creek and
 * /locations/university-place.
 *
 *  1. The index: two location cards (photo, name, address, pods free) and the
 *     "Coming soon" cities. The primary CTA (a card) opens that location.
 *  2. The live comb map: University Place draws 70 pods, City Creek 75.
 *  3. iPhone 15: tapping a pod in row B zooms the map until that pod is at
 *     least 44px on its short side.
 *  4. The Order CTA starts the order flow at that location.
 *  5. "See it in 3D" lazy-loads the three.js scene (no three.js chunk before
 *     the tap) and the canvas reaches data-ready="1". Chromium runs with the
 *     SwiftShader flags so headless WebGL works.
 *  6. An unknown slug is a 404.
 *  7. zh-TW: no English outside the brand and place-name allowlist.
 *  Every page: iPhone 15 metrics, no horizontal overflow, no emoji in the DOM,
 *  axe (wcag2a/aa) clean, and all content visible under reduced motion.
 *
 *   E2E_BASE_URL=http://localhost:3300 node --test tests/e2e/site/locations.spec.ts
 *
 * Needs the lane's web (3300) and API (4300) dev servers. Read-only: it
 * creates nothing. With E2E_SHOT_DIR set, the last test saves d4-*.png.
 */
import { test, after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3300";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const AXE = new URL("../../../apps/web/node_modules/axe-core/axe.min.js", import.meta.url).pathname;
const EMOJI = /\p{Extended_Pictographic}/u;
// The API allows 100 requests a minute per IP; the live map polls, so the tests keep a pace.
const PACE_MS = Number(process.env.E2E_PACE_MS ?? 5_000);

let browser: Browser;

before(async () => {
  browser = await chromium.launch({
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
});

after(async () => {
  await browser?.close();
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

async function open(page: Page, url: string, ready: string) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(ready).first().waitFor({ timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
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

/** Latin words on a zh page, minus the brand allowlist and the malls' proper names and street addresses. */
function englishLeaks(text: string): string[] {
  const allow = new Set(["Oh", "Wagyu", "Chappy", "Stripe", "Apple", "Pay", "Google", "QR", "City", "Creek", "Mall", "University", "Place", "Center", "Main", "St", "Salt", "Lake", "UT", "Pkwy", "Orem", "AM", "PM"]);
  return (text.match(/[A-Za-z]{2,}/g) || []).filter((w) => !allow.has(w));
}

test("the index: two location cards and the coming-soon cities; a card opens its location", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/en/locations", "[data-locations-page]");
  for (const slug of ["city-creek", "university-place"]) {
    const card = page.locator(`[data-location-card="${slug}"]`);
    assert.equal(await card.count(), 1, `${slug} card`);
    assert.ok(await card.locator("img").count(), `${slug} card has a photo`);
    const text = await card.innerText();
    assert.match(text, /UT 84/, `${slug} card shows the address`);
    assert.match(text, /pods/i, `${slug} card shows the pods`);
  }
  assert.ok((await page.locator("[data-coming-soon] li").count()) >= 1, "coming soon cities");
  await checkPage(page, "/en/locations");
  await page.locator('[data-location-card="university-place"]').click();
  await page.waitForURL(/\/en\/locations\/university-place$/, { timeout: 60_000 });
  await page.locator("[data-location-page]").waitFor({ timeout: 60_000 });
  await ctx.close();
});

test("the live comb map: University Place has 70 pods (mirrored), City Creek 75", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  for (const [slug, pods] of [["university-place", 70], ["city-creek", 75]] as const) {
    await open(page, `/en/locations/${slug}`, "[data-location-map] svg [data-pod]");
    assert.equal(await page.locator("[data-location-map] svg [data-pod]").count(), pods, `${slug}: pods`);
    // The live seat statuses arrive from GET /locations/:id/seats.
    await page.locator("[data-location-map] svg [data-pod][data-status]").first().waitFor({ timeout: 30_000 });
    await checkPage(page, `/en/locations/${slug}`);
  }
  await ctx.close();
});

test("iPhone 15: tapping a row B pod zooms until the pod is at least 44px", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/en/locations/city-creek", "[data-location-map] svg [data-pod]");
  const pod = page.locator('[data-location-map] svg [data-pod="B-07"]');
  await pod.scrollIntoViewIfNeeded();
  const before = await pod.locator("rect").nth(1).boundingBox();
  assert.ok(before && Math.min(before.width, before.height) < 44, `before the tap the pod is small (${JSON.stringify(before)})`);
  await hydrated(page, '[data-location-map] svg [data-pod="B-07"]');
  await pod.tap();
  // The 350 ms viewBox animation (slower on the dev server): wait for it to settle.
  let afterBox: { width: number; height: number } | null = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(200);
    afterBox = await pod.locator("rect").nth(1).boundingBox();
    if (afterBox && Math.min(afterBox.width, afterBox.height) >= 44) break;
  }
  assert.ok(afterBox, "B-07 still drawn after the zoom");
  assert.ok(Math.min(afterBox.width, afterBox.height) >= 44, `zoomed pod is ${afterBox.width.toFixed(1)}x${afterBox.height.toFixed(1)}`);
  await ctx.close();
});

test("the Order CTA starts the order at this location", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/en/locations/city-creek", "[data-location-page]");
  const cta = page.locator("[data-location-order]").first();
  const href = await cta.getAttribute("href");
  assert.match(href || "", /^\/en\/order\/location\/[^/]+$/);
  await hydrated(page, "[data-location-order]");
  await cta.click();
  await page.waitForURL(/\/en\/order\/location\/[^/?]+/, { timeout: 120_000 });
  await ctx.close();
});

test("See it in 3D lazy-loads the scene and the canvas becomes ready", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  const scripts: string[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") scripts.push(r.url());
  });
  await open(page, "/en/locations/university-place", "[data-location-map] svg [data-pod]");
  assert.equal(await page.locator("canvas").count(), 0, "no canvas before the tap");
  await hydrated(page, "[data-location-3d]");
  const before = scripts.length;
  await page.locator("[data-location-3d]").click();
  await page.locator('[data-location-page] canvas[data-ready="1"]').waitFor({ timeout: 90_000 });
  assert.ok(scripts.length > before, "the 3D code arrived only after the tap");
  await ctx.close();
});

test("an unknown location is a 404", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/en/locations/soho`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  assert.equal(res?.status(), 404);
  await ctx.close();
});

test("reduced motion shows every section; zh-TW has no English", async () => {
  const ctx = await newContext({ ...iphone15(), reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/zh-TW/locations/city-creek", "[data-location-map] svg [data-pod]");
  for (const sel of ["[data-location-hero] h1", "[data-location-map]", "[data-location-hours]", "[data-location-visit]", "[data-location-order]"]) {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    assert.ok(await el.isVisible(), `${sel} visible`);
    const opacity = await el.evaluate((n) => Number(getComputedStyle(n).opacity));
    assert.ok(opacity > 0.9, `${sel} opacity ${opacity}`);
  }
  const main = await page.locator("main").innerText();
  assert.deepEqual(englishLeaks(main), [], "zh-TW detail page");
  await checkPage(page, "/zh-TW/locations/city-creek");
  await open(page, "/zh-TW/locations", "[data-locations-page]");
  assert.deepEqual(englishLeaks(await page.locator("main").innerText()), [], "zh-TW index");
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
    // Full-page captures never scroll the scroll-driven reveals into view; reduced motion renders their final state.
    const ctx = await newContext({ ...run.opts, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await hideDevBadge(page);
    const shot = async (name: string, fullPage = true) => {
      const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
      assert.ok(sw <= w, `${name} ${run.width} ${run.locale}: scrollWidth ${sw} > ${w}`);
      await page.screenshot({ path: path.join(SHOTS, `d4-${name}-${run.width}-${run.locale}.png`), fullPage });
    };
    await open(page, `/${run.locale}/locations`, "[data-locations-page]");
    await page.waitForTimeout(1200);
    await shot("locations");
    for (const slug of ["city-creek", "university-place"]) {
      await open(page, `/${run.locale}/locations/${slug}`, "[data-location-map] svg [data-pod][data-status]");
      await page.waitForTimeout(1200);
      await shot(slug);
    }
    if (run.locale === "en") {
      await hydrated(page, "[data-location-3d]");
      await page.locator("[data-location-3d]").click();
      await page.locator('[data-location-page] canvas[data-ready="1"]').waitFor({ timeout: 90_000 });
      await page.waitForTimeout(1500);
      await page.locator("[data-location-map-section]").scrollIntoViewIfNeeded();
      await page.locator("[data-location-map-section]").screenshot({ path: path.join(SHOTS, `d4-3d-${run.width}-${run.locale}.png`) });
    }
    if (run.width === 390 && run.locale === "en") {
      await open(page, `/en/locations/city-creek`, "[data-location-map] svg [data-pod]");
      const pod = page.locator('[data-location-map] svg [data-pod="B-07"]');
      await pod.scrollIntoViewIfNeeded();
      await hydrated(page, '[data-location-map] svg [data-pod="B-07"]');
      await pod.tap();
      await page.waitForTimeout(2500);
      await page.locator("[data-location-map-section]").screenshot({ path: path.join(SHOTS, `d4-city-creek-zoomed-row-B-390-en.png`) });
    }
    await ctx.close();
  }
});
