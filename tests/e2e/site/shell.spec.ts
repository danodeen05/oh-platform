/**
 * Site shell e2e (Task C4): top bar, dock, More sheet, desktop nav, locale
 * switch, and the embed contract.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here), against the dev-only lab route
 * /{locale}/lab/shell, which renders inside the (site) group's SiteShell:
 *
 *   E2E_BASE_URL=http://localhost:3200 node --test tests/e2e/site/shell.spec.ts
 *
 * Needs the lane's web server running (next dev, so the lab route exists).
 * No API writes; nothing to clean up.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3200";
const LAB = "/en/lab/shell";
const DEMO_EMBED = "/en/order/status?orderQrCode=DEMO-PLAN.PREPPING&embed=1";

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
});

// iPhone 15 metrics, driven through Chromium (WebKit isn't installed here).
function iphone15(): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return d;
}

async function open(ctx: BrowserContext, path: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 120_000 });
  return page;
}

async function withPage<T>(opts: Parameters<Browser["newContext"]>[0], path: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext(opts);
  try {
    const page = await open(ctx, path);
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

test("iPhone 15: the dock is visible with 4 targets of at least 44x44", async () => {
  await withPage(iphone15(), LAB, async (page) => {
    const dock = page.locator("[data-site-dock]");
    await dock.waitFor({ state: "visible" });
    const items = dock.locator("[data-dock-item]");
    assert.equal(await items.count(), 4);
    const keys = await items.evaluateAll((els) => els.map((e) => e.getAttribute("data-dock-item")));
    assert.deepEqual(keys, ["order", "menu", "rewards", "chappy"]);
    for (let i = 0; i < 4; i++) {
      const box = await items.nth(i).boundingBox();
      assert.ok(box, `dock item ${i} has a box`);
      assert.ok(box.width >= 44 && box.height >= 44, `dock item ${keys[i]} is ${box.width}x${box.height}`);
    }
    // The dock height is published for page padding.
    const dockH = await page.evaluate(() =>
      getComputedStyle(document.querySelector("[data-site-shell]")!).getPropertyValue("--dock-h").trim(),
    );
    assert.ok(dockH.length > 0, "--dock-h is set on the shell");
  });
});

test("iPhone 15: the top bar is at most 56px tall and gains a background on scroll", async () => {
  await withPage(iphone15(), LAB, async (page) => {
    const bar = page.locator("[data-site-topbar]");
    await bar.waitFor({ state: "visible" });
    const box = await bar.boundingBox();
    assert.ok(box && box.height <= 56, `top bar height ${box?.height}`);
    assert.equal(await bar.getAttribute("data-scrolled"), "false");
    await page.mouse.wheel(0, 800);
    await page.waitForFunction(() => document.querySelector("[data-site-topbar]")?.getAttribute("data-scrolled") === "true");
  });
});

test("iPhone 15: the More sheet opens, closes with Esc, and closes with a drag", async () => {
  await withPage(iphone15(), LAB, async (page) => {
    const trigger = page.locator("[data-site-more-trigger]");
    const sheet = page.getByRole("dialog");

    await trigger.click();
    await sheet.waitFor({ state: "visible" });
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });

    await trigger.click();
    await sheet.waitFor({ state: "visible" });
    // Let the spring settle before dragging.
    await page.waitForTimeout(600);
    const grab = page.locator(".oh-sheet-grab-zone");
    const g = await grab.boundingBox();
    assert.ok(g, "grab zone has a box");
    const x = g.x + g.width / 2;
    const y = g.y + g.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(x, y + step * 40);
    }
    await page.mouse.up();
    await sheet.waitFor({ state: "detached", timeout: 5_000 });
  });
});

test("iPhone 15: the locale switch goes from /en/lab/shell to /zh-TW/lab/shell, keeping the query", async () => {
  await withPage(iphone15(), `${LAB}?from=test`, async (page) => {
    await page.locator("[data-site-more-trigger]").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.locator('[data-locale-option="zh-TW"]').click();
    await page.waitForURL(/\/zh-TW\/lab\/shell\?from=test$/);
    await page.locator("[data-site-dock]").waitFor({ state: "visible" });
    assert.equal(await page.locator("html").getAttribute("lang"), "zh-TW");
  });
});

for (const locale of ["zh-TW", "es"]) {
  for (const width of [360, 390]) {
    test(`${width}px ${locale}: dock labels fit and nothing overflows horizontally`, async () => {
      await withPage({ ...iphone15(), viewport: { width, height: 800 } }, `/${locale}/lab/shell`, async (page) => {
        await page.locator("[data-site-dock]").waitFor({ state: "visible" });
        const overflowing = await page.locator("[data-site-dock] [data-dock-label]").evaluateAll((els) =>
          els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
        );
        assert.deepEqual(overflowing, []);
        const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(docWidth <= width, `document scrollWidth ${docWidth} > ${width}`);
      });
    });
  }
}

test("1440: no dock, and a desktop nav with the same items", async () => {
  await withPage({ viewport: { width: 1440, height: 900 } }, LAB, async (page) => {
    const nav = page.locator("[data-site-desktop-nav]");
    await nav.waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-site-dock]").isVisible(), false);
    const keys = await nav.locator("[data-nav-item]").evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute("data-nav-item")),
    );
    for (const k of ["order", "menu", "rewards", "chappy", "locations", "experience", "store", "giftCards", "contact"]) {
      assert.ok(keys.includes(k), `desktop nav shows ${k} (got ${keys.join(",")})`);
    }
    assert.equal(await page.locator("[data-site-more-trigger]").isVisible(), false);
  });
});

test("?embed=1 on a site route: children only, no top bar, dock or Chappy", async () => {
  await withPage(iphone15(), `${LAB}?embed=1`, async (page) => {
    await page.locator("[data-testid=shell-lab]").waitFor({ state: "attached" });
    await page.waitForTimeout(1500);
    assert.equal(await page.locator("[data-site-dock]").count(), 0);
    assert.equal(await page.locator("[data-site-topbar]").count(), 0);
    assert.equal(await page.locator("[data-site-shell]").count(), 0);
    assert.equal(await page.locator(".chappy-button, .chappy-panel").count(), 0);
  });
});

test("the legacy /en/menu still shows the legacy header and no site dock", async () => {
  await withPage(iphone15(), "/en/menu", async (page) => {
    await page.locator(".legacy-ui header").first().waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-site-dock]").count(), 0);
    assert.equal(await page.locator("[data-site-topbar]").count(), 0);
  });
});

test("the plan's DEMO status embed renders bare: no dock, no header, no Chappy", async () => {
  await withPage(iphone15(), DEMO_EMBED, async (page) => {
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);
    assert.equal(await page.locator("[data-site-dock]").count(), 0);
    assert.equal(await page.locator("[data-site-topbar]").count(), 0);
    assert.equal(await page.locator("header").count(), 0);
    assert.equal(await page.locator("footer").count(), 0);
    assert.equal(await page.locator(".chappy-button").count(), 0);
  });
});
