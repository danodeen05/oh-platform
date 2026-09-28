/**
 * Menu page e2e (Task D3): /{locale}/menu.
 *
 *  1. en: linen panels grouped by category from the live DB menu; every
 *     listed price is the database price; the spice marks are in-house SVG
 *     flames (no emoji anywhere in the DOM).
 *  2. The item sheet: tapping Classic opens it (photo, description, marks,
 *     "Order this" to /en/order?item=<id>); dragging the handle down
 *     dismisses it.
 *  3. "Order this" on Wagyu and on Bone Marrow: the order flow's bowl step
 *     has Wagyu chosen and one Bone Marrow in the draft (priced by the quote).
 *  4. zh-TW: every item name shown is the DB `nameZhTW`, slider options are
 *     the zh-TW `displayLabels`, and nothing on the page is English (brand
 *     allowlist aside).
 *  5. Reduced motion: every panel is visible, and the sheet still opens and
 *     closes.
 *  6. Early access: an item released in 2 days is hidden from a guest and
 *     shown, sealed "Early for members", to a signed-in NOODLE_MASTER (4
 *     days early).
 *  Every page: iPhone 15 metrics, no horizontal overflow, no emoji, axe
 *  (wcag2a/aa) clean.
 *
 *   E2E_BASE_URL=http://localhost:3300 node --env-file=.env --test tests/e2e/site/menu.spec.ts
 *
 * Needs the lane's web (3300) and API (4300) dev servers and, for test 6,
 * CLERK_SECRET_KEY for the Clerk DEVELOPMENT instance. Test 6 creates a
 * throwaway menu item, DB user and `+clerk_test` Clerk user and removes
 * them afterwards. With E2E_SHOT_DIR set, the last test saves d3-*.png.
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
const EMOJI = /\p{Extended_Pictographic}/u;
const PACE_MS = Number(process.env.E2E_PACE_MS ?? 5_000);
const CITY_CREEK = "cmip6jbz700022nnnxxpmm5hf";

const prisma = new PrismaClient();
const tag = `e2e-d3-${Date.now()}`;
let browser: Browser;
let earlyItemId = "";
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
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
  const tryDel = async (label: string, fn: () => Promise<unknown>) => fn().catch((e) => console.log(`[cleanup] ${label}: ${String(e.message).split("\n").pop()}`));
  if (earlyItemId) await tryDel("menuItem", () => prisma.menuItem.delete({ where: { id: earlyItemId } }));
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

async function open(page: Page, url: string, ready = "[data-menu-section]") {
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

/** Latin words on a zh page, minus the brand allowlist. */
function englishLeaks(text: string): string[] {
  const allow = new Set(["Oh", "Wagyu", "Chappy", "Stripe", "Apple", "Pay", "Google", "QR", "Pepsi"]);
  return (text.match(/[A-Za-z]{2,}/g) || []).filter((w) => !allow.has(w));
}

async function dbItem(name: string) {
  const row = await prisma.menuItem.findFirst({ where: { name, isAvailable: true } });
  assert.ok(row, `menu item ${name} in the DB`);
  return row;
}

/**
 * Taps a menu item until its sheet opens. The dev server re-renders the list once right after
 * hydration (Clerk finishing its load), and a tap inside that window is lost.
 */
async function openSheet(page: Page, sel: string) {
  await hydrated(page, sel);
  const dialog = page.getByRole("dialog");
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator(sel).first().click();
    if (await dialog.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false)) return dialog;
  }
  await dialog.waitFor({ state: "visible", timeout: 1_000 });
  return dialog;
}

async function dragDown(page: Page) {
  const grab = page.locator(".oh-sheet-grab-zone");
  const g = await grab.boundingBox();
  assert.ok(g, "grab zone has a box");
  const x = g.x + g.width / 2;
  const y = g.y + g.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 14; step++) await page.mouse.move(x, y + step * 45);
  await page.mouse.up();
}

test("en: linen panels by category, DB prices, in-house marks", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/en/menu");
  for (const key of ["soup", "noodles", "customize", "addons", "sides", "drinks"]) {
    const section = page.locator(`[data-menu-section="${key}"]`);
    assert.equal(await section.count(), 1, `${key} panel`);
    const bg = await section.evaluate((n) => getComputedStyle(n).backgroundColor);
    if (key !== "customize") assert.equal(bg, "rgb(237, 230, 218)", `${key} panel is linen`);
  }
  const classic = await dbItem("Classic Beef Noodle Soup");
  const card = page.locator(`[data-menu-item="${classic.id}"]`);
  assert.match(await card.innerText(), new RegExp(`\\$${(classic.basePriceCents / 100).toFixed(2).replace(".", "\\.")}`), "Classic shows its DB price");
  const marrow = await dbItem("Bone Marrow");
  assert.match(await page.locator(`[data-menu-item="${marrow.id}"]`).innerText(), new RegExp(`\\$${(marrow.basePriceCents / 100).toFixed(2).replace(".", "\\.")}`), "Bone Marrow shows its DB price");
  // Spice is drawn with Icon flames, one per level.
  const cukes = await dbItem("Spicy Cucumbers");
  const flame = page.locator(`[data-menu-item="${cukes.id}"] [data-mark="flame"]`);
  assert.equal(await flame.getAttribute("data-count"), String(cukes.spiceLevel));
  assert.equal(await flame.locator("svg").count(), cukes.spiceLevel);
  assert.equal(await page.locator("[data-menu-item] img[src*='allergens']").count(), 0, "no legacy allergen PNG badges");
  // Hidden rows: No Noodles never lists.
  const none = await prisma.menuItem.findFirst({ where: { name: "No Noodles" } });
  if (none) assert.equal(await page.locator(`[data-menu-item="${none.id}"]`).count(), 0, "No Noodles is not listed");
  // The slider panel shows the English display labels in en.
  assert.ok((await page.locator("[data-menu-slider] [data-slider-option]").count()) >= 3, "slider options listed");
  await checkPage(page, "/en/menu");
  // The page CTA starts an order.
  const cta = page.locator("[data-menu-order]");
  assert.equal(await cta.getAttribute("href"), "/en/order");
  await ctx.close();
});

test("the item sheet opens on tap and closes by drag", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/en/menu");
  const classic = await dbItem("Classic Beef Noodle Soup");
  const sel = `[data-menu-item="${classic.id}"]`;
  const sheet = await openSheet(page, sel);
  assert.equal(await sheet.locator(`[data-item-sheet="${classic.id}"]`).count(), 1);
  assert.ok(await sheet.locator("figure img").count(), "the sheet has the photo");
  const text = await sheet.innerText();
  assert.ok(text.includes(classic.name), "the sheet names the item");
  if (classic.description) assert.ok(text.includes(classic.description.slice(0, 30)), "the sheet shows the DB description");
  if (classic.spiceLevel > 0) assert.equal(await sheet.locator('[data-mark="flame"] svg').count(), classic.spiceLevel, "flames x spice level");
  assert.equal(await sheet.locator("[data-order-this]").getAttribute("href"), `/en/order?item=${classic.id}`);
  await page.waitForTimeout(700); // let the spring settle
  await checkPage(page, "/en/menu sheet");
  await dragDown(page);
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  await ctx.close();
});

test("Order this: Wagyu and Bone Marrow arrive preselected in the bowl step", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  const wagyu = await dbItem("American Wagyu Beef Noodle Soup");
  const marrow = await dbItem("Bone Marrow");
  for (const item of [wagyu, marrow]) {
    await open(page, "/en/menu");
    const sel = `[data-menu-item="${item.id}"]`;
    await openSheet(page, sel);
    await page.locator("[data-order-this]").click();
    await page.waitForURL(new RegExp(`/en/order\\?item=${item.id}$`), { timeout: 60_000 });
    const card = page.locator(`[data-location-card="${CITY_CREEK}"]`);
    await card.waitFor({ timeout: 60_000 });
    assert.equal(await card.getAttribute("href"), `/en/order/location/${CITY_CREEK}?item=${item.id}`);
    await hydrated(page, `[data-location-card="${CITY_CREEK}"]`);
    for (let attempt = 0; attempt < 3; attempt++) {
      await card.click();
      if (await page.locator('[data-order-step="bowl"]').waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)) break;
    }
    // The item param is consumed, and the draft holds the item.
    await page.waitForURL(new RegExp(`/en/order/location/${CITY_CREEK}$`), { timeout: 30_000 });
  }
  assert.equal(await page.locator(`[data-soup="${wagyu.id}"]`).getAttribute("aria-checked"), "true", "Wagyu is the soup");
  const draft = JSON.parse((await page.evaluate(() => sessionStorage.getItem("oh-order-draft"))) || "{}");
  assert.equal(draft.singles?.soup, wagyu.id, "draft soup");
  assert.equal(draft.extras?.[marrow.id], 1, "one Bone Marrow");
  assert.equal(await page.locator(`[data-item="Bone Marrow"] [data-qty]`).innerText(), "1");
  await ctx.close();
});

test("zh-TW: names from nameZhTW, slider displayLabels, no English", async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/zh-TW/menu");
  const listed = await page.locator("[data-menu-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-menu-item")));
  assert.ok(listed.length >= 10, `items listed (${listed.length})`);
  const rows = await prisma.menuItem.findMany({ where: { id: { in: listed as string[] } } });
  for (const row of rows) {
    assert.ok(row.nameZhTW, `${row.name} has a zh-TW name`);
    const text = await page.locator(`[data-menu-item="${row.id}"]`).innerText();
    assert.ok(text.includes(row.nameZhTW!), `${row.name} shows ${row.nameZhTW}`);
  }
  const spice = await dbItem("Spice Level");
  const zh = (spice.sliderConfig as { labelsI18n?: Record<string, string[]> } | null)?.labelsI18n?.["zh-TW"] || [];
  const shown = await page.locator(`[data-menu-slider="${spice.id}"] [data-slider-label]`).allInnerTexts();
  assert.deepEqual(shown.map((s) => s.trim()), zh, "Spice Level options are the zh-TW display labels");
  assert.deepEqual(englishLeaks(await page.locator("main").innerText()), [], "zh-TW page");
  // The sheet too.
  const classic = await dbItem("Classic Beef Noodle Soup");
  const sheet = await openSheet(page, `[data-menu-item="${classic.id}"]`);
  assert.deepEqual(englishLeaks(await sheet.innerText()), [], "zh-TW sheet");
  assert.equal((await sheet.locator("[data-order-this]").innerText()).trim(), "點這道");
  assert.equal(await sheet.locator("[data-order-this]").getAttribute("href"), `/zh-TW/order?item=${classic.id}`);
  await page.waitForTimeout(700);
  await checkPage(page, "/zh-TW/menu sheet");
  await ctx.close();
});

test("reduced motion: every panel is visible, the sheet still opens and closes", async () => {
  const ctx = await newContext({ ...iphone15(), reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/es/menu");
  for (const sel of ["[data-menu-page] h1", ...["soup", "noodles", "customize", "addons", "sides", "drinks"].map((k) => `[data-menu-section="${k}"]`), "[data-menu-legend]", "[data-menu-order]"]) {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    assert.ok(await el.isVisible(), `${sel} visible`);
    const opacity = await el.evaluate((n) => Number(getComputedStyle(n).opacity));
    assert.ok(opacity > 0.9, `${sel} opacity ${opacity}`);
  }
  await checkPage(page, "/es/menu reduced");
  const first = page.locator("[data-menu-item]").first();
  await first.scrollIntoViewIfNeeded();
  const sheet = await openSheet(page, "[data-menu-item]");
  await sheet.locator("[data-item-sheet-close]").click();
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  await ctx.close();
});

test("early access: hidden from a guest, sealed for a Noodle Master", { skip: !CLERK_KEY.startsWith("sk_test_") && "needs the Clerk development key" }, async () => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "oh" } });
  assert.ok(tenant);
  const item = await prisma.menuItem.create({
    data: {
      tenantId: tenant.id,
      name: "Tomato Beef Noodle Soup",
      nameZhTW: "番茄牛肉麵",
      nameZhCN: "番茄牛肉面",
      nameEs: "Sopa de Fideos con Res y Tomate",
      category: "main01",
      categoryType: "MAIN",
      selectionMode: "SINGLE",
      displayOrder: 99,
      basePriceCents: 1799,
      releaseAt: new Date(Date.now() + 2 * 864e5),
    },
  });
  earlyItemId = item.id;
  const email = `${tag}+clerk_test@example.com`;
  const user = await clerk("/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Mei", last_name: "E2E", skip_password_requirement: true }) });
  clerkUserId = user.id;
  dbUserId = (await prisma.user.create({ data: { email: email.toLowerCase(), name: "Mei E2E", membershipTier: "NOODLE_MASTER" } })).id;

  // Guest: not listed.
  const guest = await newContext();
  const gp = await guest.newPage();
  await hideDevBadge(gp);
  await open(gp, "/en/menu");
  assert.equal(await gp.locator(`[data-menu-item="${item.id}"]`).count(), 0, "a guest doesn't see it");
  await guest.close();

  // Member: listed, with the seal, after the signed-in refetch.
  const ctx = await newContext();
  const page = await ctx.newPage();
  await hideDevBadge(page);
  await open(page, "/en/menu");
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true, null, { timeout: 60_000 });
  await page.evaluate(async (ticket) => {
    const Clerk = (window as unknown as { Clerk: any }).Clerk;
    const si = await Clerk.client.signIn.create({ strategy: "ticket", ticket });
    await Clerk.setActive({ session: si.createdSessionId });
  }, token);
  const early = page.locator(`[data-menu-item="${item.id}"]`);
  await early.waitFor({ timeout: 60_000 });
  assert.equal(await early.locator("[data-menu-early]").count(), 1, "sealed Early for members");
  assert.match(await early.innerText(), /Early for members/);
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
  const classic = await dbItem("Classic Beef Noodle Soup");
  const cukes = await dbItem("Spicy Cucumbers");
  for (const run of runs.filter((r) => !process.env.E2E_SHOT_ONLY || `${r.locale}-${r.width}` === process.env.E2E_SHOT_ONLY)) {
    // Full-page captures never scroll the reveals into view; reduced motion renders their final state.
    const ctx = await newContext({ ...run.opts, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await hideDevBadge(page);
    await open(page, `/${run.locale}/menu`);
    await page.waitForTimeout(1200);
    const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
    assert.ok(sw <= w, `${run.locale} ${run.width}: scrollWidth ${sw} > ${w}`);
    await page.screenshot({ path: path.join(SHOTS, `d3-menu-${run.width}-${run.locale}.png`), fullPage: true });
    for (const [name, id] of [["classic", classic.id], ["cucumbers", cukes.id]] as const) {
      if (run.width === 1440 && name === "cucumbers") continue;
      const sel = `[data-menu-item="${id}"]`;
      await page.locator(sel).scrollIntoViewIfNeeded();
      await openSheet(page, sel);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SHOTS, `d3-sheet-${name}-${run.width}-${run.locale}.png`) });
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
    }
    await ctx.close();
  }
});
