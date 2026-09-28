/**
 * Task D11 e2e: contact (posts to the support queue), the legal pages
 * (privacy, accessibility, SMS consent), the group lobby and group payment,
 * CNY strings, and the cleanup (/tenants is gone).
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here), against the lane's web and API servers:
 *
 *   E2E_BASE_URL=http://localhost:3100 E2E_API_URL=http://localhost:4100 \
 *     node --env-file=.env --test tests/e2e/site/misc.spec.ts
 *
 * Writes: one CONTACT support case (from the form, as a visitor sends it),
 * and a group with two orders for the lobby tests. Every row it creates is
 * deleted afterwards. SUPPORT_NOTIFY=log (the worktree .env) keeps the case
 * from texting or emailing anyone. With ADMIN_API_KEY set, pass it as
 * E2E_ADMIN_API_KEY for the admin read (never committed).
 *
 * Screenshots (d11-*.png) go to E2E_SHOT_DIR when set.
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

const BASE = process.env.E2E_BASE_URL || "http://localhost:3100";
const API = process.env.E2E_API_URL || "http://localhost:4100";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const KEY = process.env.E2E_ADMIN_API_KEY || "";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../../../apps/web");
const requireFromWeb = createRequire(path.join(WEB, "package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");

function messages(locale: string): Record<string, any> {
  return JSON.parse(readFileSync(path.join(WEB, "messages", `${locale}.json`), "utf8"));
}

const prisma = new PrismaClient();
const tag = `e2e-d11-${Date.now()}`;
const created = { cases: [] as string[], orders: [] as string[], groups: [] as string[], guests: [] as string[] };
let browser: Browser;
let groupCode = "";
let hostToken = "";
let orderIds: string[] = [];
/** Database copy the page shows as is: the location name and address when the row has no zh-TW i18n (F1a data, not page copy). */
let dbCopy: string[] = [];

function code6(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

before(async () => {
  browser = await chromium.launch({ args: ["--no-sandbox"] });

  // A CLOSED, host-pays group at the comb location, hosted by a guest (a
  // guest session cookie makes the browser the host), with two orders.
  const location = await prisma.location.findFirst({ where: { layoutKey: "comb-75" } });
  assert.ok(location, "a comb-75 location in the dev DB");
  const zh = (location.i18n as Record<string, { name?: string; address?: string }> | null)?.["zh-TW"];
  dbCopy = [zh?.address ? "" : location.address, zh?.name ? "" : location.name].filter(Boolean) as string[];
  const menu = await prisma.menuItem.findFirst({ where: { tenantId: location.tenantId } });
  const later = new Date(Date.now() + 25 * 60 * 1000);
  const dayLater = new Date(Date.now() + 24 * 3600 * 1000);
  hostToken = `gs_${tag}`;
  const host = await prisma.guest.create({ data: { name: "Mei Lin", sessionToken: hostToken, expiresAt: dayLater } });
  const friend = await prisma.guest.create({ data: { name: "Ana Ruiz", sessionToken: `gs_${tag}_2`, expiresAt: dayLater } });
  created.guests.push(host.id, friend.id);
  groupCode = code6();
  const group = await prisma.groupOrder.create({
    data: { code: groupCode, locationId: location.id, tenantId: location.tenantId, hostGuestId: host.id, status: "CLOSED", paymentMethod: "HOST_PAYS_ALL", expiresAt: later, closedAt: new Date() },
  });
  created.groups.push(group.id);
  for (const [i, g] of [host, friend].entries()) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${tag}-${i}`,
        tenantId: location.tenantId,
        locationId: location.id,
        guestId: g.id,
        groupOrderId: group.id,
        isGroupHost: i === 0,
        totalCents: 1924,
        amountDueCents: 1924,
        paymentStatus: "PENDING",
        status: "PENDING_PAYMENT",
        ...(menu ? { items: { create: [{ menuItemId: menu.id, quantity: 1, priceCents: 1799 }] } } : {}),
      },
    });
    created.orders.push(order.id);
    orderIds.push(order.id);
  }
});

after(async () => {
  await browser?.close();
  await prisma.supportCase.deleteMany({ where: { id: { in: created.cases } } });
  await prisma.supportCase.deleteMany({ where: { summary: { contains: tag } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: created.orders } } });
  await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
  await prisma.groupOrder.deleteMany({ where: { id: { in: created.groups } } });
  await prisma.guest.deleteMany({ where: { id: { in: created.guests } } });
  await prisma.$disconnect();
});

// iPhone 15 metrics, driven through Chromium (WebKit isn't installed here).
function iphone15(extra: Parameters<Browser["newContext"]>[0] = {}): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return { ...d, ...extra };
}
const desktop = (extra: Parameters<Browser["newContext"]>[0] = {}) => ({ viewport: { width: 1440, height: 900 }, ...extra });

async function withPage<T>(opts: Parameters<Browser["newContext"]>[0], url: string, ready: string, fn: (page: Page) => Promise<T>, setup?: (ctx: BrowserContext) => Promise<void>): Promise<T> {
  const ctx: BrowserContext = await browser.newContext(opts);
  // The main checkout's API is never called from here.
  await ctx.route(/localhost:4000/, (r) => r.abort());
  try {
    if (setup) await setup(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator(ready).first().waitFor({ state: "visible", timeout: 90_000 });
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  assert.ok(scrollWidth <= innerWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`);
}

async function axe(page: Page, selector: string) {
  // Settle the scroll-driven reveals first (a half-faded element reads as low contrast).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async (sel) => {
    // @ts-expect-error -- axe is injected above
    const result = await window.axe.run(document.querySelector(sel), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return result.violations.map((v: any) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target?.join(" ")})`);
  }, selector);
  assert.deepEqual(violations, []);
}

/** Visible text plus alt, aria-label, placeholder and title inside `selector`, minus the given data strings. */
async function leaks(page: Page, selector: string, strip: string[] = []): Promise<string[]> {
  const text = await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement | null;
    if (!root) return "";
    const attrs = Array.from(root.querySelectorAll("[alt],[aria-label],[placeholder],[title]")).flatMap((el) =>
      ["alt", "aria-label", "placeholder", "title"].map((a) => el.getAttribute(a) || ""),
    );
    return `${root.innerText}\n${attrs.join("\n")}`;
  }, selector);
  // Email addresses and URLs are data in every language.
  let rest = text.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, " ").replace(/https?:\/\/\S+/g, " ");
  for (const s of strip) if (s) rest = rest.split(s).join(" ");
  return englishLeaks(rest);
}

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  // Scroll-driven reveals only show what is on screen; reduced motion shows the whole page for a full-page shot.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
}

async function allContentVisible(page: Page, selector: string) {
  const hidden = await page.evaluate((sel) =>
    Array.from(document.querySelectorAll(`${sel} h1, ${sel} h2`)).filter((h) => {
      let el: Element | null = h;
      while (el) {
        const s = getComputedStyle(el);
        if (s.opacity === "0" || s.visibility === "hidden" || s.display === "none") return true;
        el = el.parentElement;
      }
      return false;
    }).length,
  selector);
  assert.equal(hidden, 0, "every heading is visible with reduced motion");
}

/* ------------------------------------------------------------ contact */

test("contact (iPhone 15, en): the form creates an OPEN CONTACT case and shows its reference", async () => {
  await withPage(iphone15(), "/en/contact", "[data-contact-form][data-ready='true']", async (page) => {
    await noHorizontalOverflow(page);
    await shot(page, "d11-contact-390-en");
    const form = page.locator("[data-contact-form]");
    await form.locator("input[name='name']").fill("E2E Visitor");
    await form.locator("input[name='email']").fill("e2e-d11@example.com");
    await form.locator("select[name='topic']").selectOption("order");
    await form.locator("textarea[name='message']").fill(`${tag} do you have gluten free noodles?`);
    // Inputs are at least 16px (no iOS zoom on focus).
    const fontSize = await form.locator("textarea[name='message']").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(fontSize >= 16, `input font ${fontSize}px`);
    await form.locator("[data-contact-submit]").click();
    const success = page.locator("[data-contact-success]");
    await success.waitFor({ state: "visible", timeout: 30_000 });
    const ref = (await success.locator("[data-case-ref]").innerText()).trim();
    assert.match(ref, /^[A-Z0-9]{6,}$/);
    await shot(page, "d11-contact-390-en-sent");

    // The case, as staff see it in the admin queue.
    const res = await fetch(`${API}/admin/support/cases?type=CONTACT&limit=50`, { headers: { "x-tenant-slug": "oh", ...(KEY ? { "x-admin-api-key": KEY } : {}) } });
    assert.equal(res.status, 200, "admin list");
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.cases;
    const mine = list.find((c: any) => typeof c.summary === "string" && c.summary.includes(tag));
    assert.ok(mine, "the case is in the admin queue");
    created.cases.push(mine.id);
    assert.equal(mine.status, "OPEN");
    assert.equal(mine.type, "CONTACT");
    assert.equal(mine.locale, "en");
    assert.equal(mine.contact?.email, "e2e-d11@example.com");
    assert.ok(mine.id.toUpperCase().endsWith(ref), `reference ${ref} is the case id's tail`);
  });
});

test("contact: a missing email and phone is caught before sending, in the page's language", async () => {
  await withPage(iphone15(), "/zh-TW/contact", "[data-contact-form][data-ready='true']", async (page) => {
    const form = page.locator("[data-contact-form]");
    await form.locator("textarea[name='message']").fill("你好");
    await form.locator("[data-contact-submit]").click();
    const err = page.locator("[data-contact-error]");
    await err.waitFor({ state: "visible" });
    assert.equal((await err.innerText()).trim(), messages("zh-TW").contactPage.errors.contactRequired);
    assert.deepEqual(await leaks(page, "[data-contact-page]"), []);
    await shot(page, "d11-contact-390-zh-TW");
  });
});

test("contact: axe is clean; reduced motion shows everything; 1440 and es 360 fit", async () => {
  await withPage(iphone15(), "/en/contact", "[data-contact-form][data-ready='true']", async (page) => axe(page, "[data-contact-page]"));
  await withPage(iphone15({ reducedMotion: "reduce" }), "/en/contact", "[data-contact-page]", async (page) => allContentVisible(page, "[data-contact-page]"));
  await withPage(desktop(), "/en/contact", "[data-contact-page]", async (page) => {
    await noHorizontalOverflow(page);
    await shot(page, "d11-contact-1440-en");
  });
  await withPage({ ...iphone15(), viewport: { width: 360, height: 780 } }, "/es/contact", "[data-contact-page]", async (page) => {
    await noHorizontalOverflow(page);
    await shot(page, "d11-contact-360-es");
  });
});

/* ------------------------------------------------------------ legal */

for (const route of ["privacy", "accessibility", "sms-consent"] as const) {
  test(`${route}: renders in en and zh-TW with no overflow, no English in zh-TW, axe clean`, async () => {
    await withPage(iphone15(), `/en/${route}`, `[data-legal-page='${route}']`, async (page) => {
      await noHorizontalOverflow(page);
      await axe(page, `[data-legal-page='${route}']`);
      await shot(page, `d11-${route}-390-en`);
    });
    await withPage(iphone15(), `/zh-TW/${route}`, `[data-legal-page='${route}']`, async (page) => {
      await noHorizontalOverflow(page);
      // Email addresses, the site's own URL and the SMS keywords are data, not copy.
      const strip = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[data-legal-page] [data-literal]")).map((el) => (el as HTMLElement).innerText),
      );
      // STOP and HELP are the carriers' SMS keywords, WCAG and ADA are the standards' names, "Cookie" is the usual Chinese legal term, "Oh Beef Noodle Soup" is
      // the legal business name in the quoted consent text; "QR code" is main's hotfix wording (649ab65), left as is.
      assert.deepEqual(await leaks(page, `[data-legal-page='${route}']`, [...strip, "STOP", "HELP", "QR code", "WCAG", "ADA", "Oh Beef Noodle Soup", "Cookie"]), []);
      await shot(page, `d11-${route}-390-zh-TW`);
    });
    await withPage(iphone15({ reducedMotion: "reduce" }), `/en/${route}`, `[data-legal-page='${route}']`, async (page) => allContentVisible(page, `[data-legal-page='${route}']`));
    await withPage(desktop(), `/en/${route}`, `[data-legal-page='${route}']`, async (page) => {
      await noHorizontalOverflow(page);
      await shot(page, `d11-${route}-1440-en`, false);
    });
  });
}

test("privacy: the SMS notifications section is there in every locale (hotfix 649ab65 keys)", async () => {
  for (const locale of ["en", "zh-TW", "zh-CN", "es"]) {
    const res = await fetch(`${BASE}/${locale}/privacy`);
    assert.equal(res.status, 200, `${locale} privacy`);
    const html = await res.text();
    assert.ok(html.includes(messages(locale).privacy.sections.smsNotifications.title), `${locale} shows the SMS section`);
  }
});

test("sms-consent: the opt-out address is the privacy policy's SMS address, in every locale (fix round 1)", async () => {
  for (const locale of ["en", "zh-TW", "zh-CN", "es"]) {
    const privacyEmail = (messages(locale).privacy.sections.smsNotifications.help as string).match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0];
    assert.equal(privacyEmail, "orders@ohbeefnoodlesoup.com", `${locale} privacy SMS address`);
    const html = await (await fetch(`${BASE}/${locale}/sms-consent`)).text();
    const optOut = html.slice(html.indexOf('id="opt-out"'));
    const mail = optOut.match(/href="mailto:([^"]+)"/)?.[1];
    assert.equal(mail, privacyEmail, `${locale} opt-out address`);
    assert.ok(!html.includes("eatoh.com"), `${locale}: the old address is gone`);
  }
});

/* ------------------------------------------------------------ cleanup */

test("/en/tenants is gone (404)", async () => {
  const res = await fetch(`${BASE}/en/tenants`, { redirect: "manual" });
  assert.equal(res.status, 404);
});

/* ------------------------------------------------------------ group lobby */

const asHost = async (ctx: BrowserContext) => {
  await ctx.addCookies([{ name: "oh_guest_session", value: hostToken, url: BASE }]);
};

test("group lobby (zh-TW, visitor): the CombMap shows, and nothing on the page is English", async () => {
  await withPage(iphone15(), `/zh-TW/group/${groupCode}`, "[data-group-lobby]", async (page) => {
    const map = page.locator("[data-group-map] svg[data-layout]");
    await map.waitFor({ state: "visible", timeout: 60_000 });
    const legend = await page.locator("[data-group-map]").innerText();
    assert.deepEqual(englishLeaks(legend), [], "the map and its legend are translated");
    // The group code and member names are data.
    assert.deepEqual(await leaks(page, "[data-group-lobby]", [groupCode, "Mei L.", "Ana R.", "Mei Lin", "Ana Ruiz", ...dbCopy]), []);
    await noHorizontalOverflow(page);
    await shot(page, "d11-group-390-zh-TW");
  });
});

test("group lobby (iPhone 15, en, host): pick a pod per member on the map, then pay carries the picks", async () => {
  await withPage(
    iphone15(),
    `/en/group/${groupCode}`,
    "[data-group-picker][data-ready='true']",
    async (page) => {
      await noHorizontalOverflow(page);
      await shot(page, "d11-group-390-en-host");
      const picker = page.locator("[data-group-picker]");
      // The first member is active; choose a free pod with the keyboard (a tap zooms the row first on a phone).
      const free = picker.locator("svg [data-label][data-status='AVAILABLE']").first();
      const label = await free.getAttribute("data-label");
      assert.ok(label, "a free pod");
      await free.focus();
      await page.keyboard.press("Enter");
      await picker.locator(`[data-member-pod='${orderIds[0]}']`).filter({ hasText: label! }).waitFor({ timeout: 10_000 });
      // Pick for the rest: every member has a pod, none shared.
      await picker.locator("[data-pick-rest]").click();
      const pods = await picker.locator("[data-member-pod]").allInnerTexts();
      assert.equal(pods.length, 2);
      assert.notEqual(pods[0].trim(), pods[1].trim());
      const href = await page.locator("[data-group-pay]").getAttribute("href");
      assert.ok(href && href.includes(`pods=`) && href.includes(orderIds[0]) && href.includes(label!), `pay link ${href}`);
      await shot(page, "d11-group-390-en-picked");
      await axe(page, "[data-group-lobby]");
    },
    asHost,
  );
});

test("group lobby: reduced motion shows everything; 1440 fits", async () => {
  await withPage(iphone15({ reducedMotion: "reduce" }), `/en/group/${groupCode}`, "[data-group-lobby]", async (page) => allContentVisible(page, "[data-group-lobby]"));
  await withPage(desktop(), `/en/group/${groupCode}`, "[data-group-picker] svg[data-layout]", async (page) => {
    await noHorizontalOverflow(page);
    // Fix round 1: the pick map gets real width on a desktop (it was about 165px).
    const width = await page.locator("[data-group-picker] svg[data-layout]").evaluate((el) => el.getBoundingClientRect().width);
    assert.ok(width >= 560, `pick map is ${Math.round(width)}px wide at 1440`);
    await shot(page, "d11-group-1440-en");
  }, asHost);
  await withPage({ ...iphone15(), viewport: { width: 360, height: 780 } }, `/es/group/${groupCode}`, "[data-group-lobby]", async (page) => {
    await noHorizontalOverflow(page);
    await shot(page, "d11-group-360-es");
  }, asHost);
});

test("group lobby: an unknown code is a translated not-found page", async () => {
  await withPage(iphone15(), "/zh-TW/group/ZZZZZZ", "[data-group-missing]", async (page) => {
    assert.deepEqual(await leaks(page, "[data-group-missing]", ["ZZZZZZ"]), []);
  });
});

test("group payment (zh-TW, signed out): asks the host to sign in, translated, with the group summary", async () => {
  await withPage(iphone15(), `/zh-TW/order/group-payment?groupCode=${groupCode}&pods=${orderIds[0]}:B-07`, "[data-group-payment]", async (page) => {
    await page.locator("[data-group-signin]").waitFor({ state: "visible", timeout: 60_000 });
    assert.deepEqual(await leaks(page, "[data-group-payment]", [groupCode, "Mei L.", "Ana R.", "Mei Lin", "Ana Ruiz", ...dbCopy]), []);
    await noHorizontalOverflow(page);
    await shot(page, "d11-group-payment-390-zh-TW");
  });
});

/* ------------------------------------------------------------ CNY */

test("CNY (zh-TW): strings only, no English on the invite, details and RSVP pages", async () => {
  for (const [p, ready] of [["/zh-TW/cny", ".cny-page"], ["/zh-TW/cny/details", ".cny-page"], ["/zh-TW/cny/rsvp", ".cny-page"]] as const) {
    await withPage(iphone15(), p, ready, async (page) => {
      // The venue (Embold Clubroom & Kitchen, Lehi, UT) and the hosts (Dano, Kristy) are names.
      assert.deepEqual(await leaks(page, "body", ["Embold", "Clubroom", "Kitchen", "Lehi", "UT", "Dano", "Kristy"]), [], p);
      await shot(page, `d11-cny${p.replace("/zh-TW/cny", "").replace(/\//g, "-") || "-invite"}-390-zh-TW`);
    });
  }
});
