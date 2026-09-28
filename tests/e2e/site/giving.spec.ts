/**
 * /giving e2e (site follow-up 2026-09-28, spec section 3): One Red Step At A
 * Time on the customer site.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here), against the lane's web server:
 *
 *   E2E_BASE_URL=http://localhost:3300 node --test tests/e2e/site/giving.spec.ts
 *
 * Checks: the page renders its seven sections with the hero title; Donate
 * goes to the foundation's /donate in a new tab (every external link has
 * rel="noopener noreferrer"); no dollar figures; the footer's One Red Step
 * block links to /giving on several routes; the desktop nav lists Giving; no
 * horizontal overflow at 360 / 390 / 1440; axe; zh-TW shows no English
 * outside the allowlist and translate="no" text; reduced motion draws the
 * thread. Read-only: no API writes.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type Browser, type Page } from "playwright";
import { englishLeaks } from "../../../apps/web/lib/site/i18n-allowlist.ts";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3300";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../../../apps/web");
const requireFromWeb = createRequire(path.join(WEB, "package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");

const SECTIONS = ["hero", "pledge", "foundation", "visit", "socks", "actions", "contact"];

function messages(locale: string): Record<string, any> {
  return JSON.parse(readFileSync(path.join(WEB, "messages", `${locale}.json`), "utf8"));
}

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  // Warm the dev server's compile.
  const ctx = await browser.newContext();
  try {
    await (await ctx.newPage()).goto(`${BASE}/en/giving`, { waitUntil: "load", timeout: 180_000 });
  } finally {
    await ctx.close();
  }
});

after(async () => {
  await browser?.close();
});

function iphone15(extra: Parameters<Browser["newContext"]>[0] = {}): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return { ...d, ...extra };
}

async function withPage<T>(opts: Parameters<Browser["newContext"]>[0], url: string, fn: (page: Page) => Promise<T>, ready = "[data-giving-page]"): Promise<T> {
  const ctx = await browser.newContext(opts);
  try {
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator(ready).first().waitFor({ state: "visible", timeout: 60_000 });
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  assert.ok(scrollWidth <= innerWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`);
}

test("iPhone 15 (en): the page renders its seven sections, the hero title and the foundation's facts", async () => {
  await withPage(iphone15(), "/en/giving", async (page) => {
    const m = messages("en").giving;
    const order = await page.locator("[data-giving-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-giving-section")));
    assert.deepEqual(order, SECTIONS);
    assert.equal((await page.locator("h1").innerText()).trim(), m.hero.title);
    assert.equal(await page.locator("h1").count(), 1);
    const identity = (await page.locator("[data-giving-identity]").innerText()).trim();
    assert.ok(identity.includes("33-7041706"), identity);
    // No dollar figures anywhere on the page (the plan's projections are NDA-gated).
    const text = await page.locator("[data-giving-page]").innerText();
    assert.ok(!/\$\s?\d/.test(text), "no dollar amounts on /giving");
    assert.ok(!/related-party|best friend|volunteer CTO/i.test(text), "no related-party disclosure");
    await noHorizontalOverflow(page);
  });
});

test("iPhone 15 (en): Donate goes to the foundation's /donate in a new tab; every external link is noopener noreferrer", async () => {
  await withPage(iphone15(), "/en/giving", async (page) => {
    const donate = page.locator("a[data-giving-donate]");
    assert.equal(await donate.getAttribute("href"), "https://www.oneredstepatatime.org/donate");
    assert.equal(await donate.getAttribute("target"), "_blank");
    const box = await donate.boundingBox();
    assert.ok(box && box.height >= 44, `Donate is ${box?.height}px tall`);
    assert.equal(await page.locator("a[data-giving-store]").getAttribute("href"), "https://www.oneredstepatatime.org/store");
    const external = await page.locator("[data-giving-page] a[href^='http']").evaluateAll((els) =>
      els.map((a) => ({ href: a.getAttribute("href"), rel: a.getAttribute("rel"), target: a.getAttribute("target") })),
    );
    assert.ok(external.length >= 8, `external links: ${external.length}`);
    for (const a of external) {
      assert.equal(a.rel, "noopener noreferrer", `${a.href} rel`);
      assert.equal(a.target, "_blank", `${a.href} target`);
    }
    assert.equal(await page.locator("[data-giving-chappy]").count(), 1);
  });
});

for (const url of ["/en", "/en/menu", "/en/experience", "/en/giving", "/zh-TW/rewards", "/es/locations"]) {
  test(`footer on ${url}: the One Red Step block links to /giving`, async () => {
    const locale = url.split("/")[1];
    await withPage(iphone15(), url, async (page) => {
      const block = page.locator("[data-site-footer] [data-footer-foundation]");
      assert.equal(await block.count(), 1);
      const link = block.locator("a[data-footer-giving]");
      assert.equal(await link.getAttribute("href"), `/${locale}/giving`);
      assert.equal((await link.innerText()).trim(), messages(locale).site.shell.footer.foundation.link);
      assert.equal(await block.locator("img").getAttribute("alt"), messages(locale).site.shell.footer.foundation.markAlt);
    }, "[data-site-footer]");
  });
}

test("1440: the desktop nav lists Giving, and the footer's route list does too", async () => {
  await withPage({ viewport: { width: 1440, height: 900 } }, "/en/giving", async (page) => {
    const nav = page.locator("[data-site-desktop-nav] [data-nav-item='giving']");
    assert.equal(await nav.getAttribute("href"), "/en/giving");
    assert.equal(await nav.getAttribute("aria-current"), "page");
    assert.ok((await page.locator("[data-site-footer] nav a[href='/en/giving']").count()) >= 1);
    await noHorizontalOverflow(page);
  });
});

for (const width of [360, 390]) {
  test(`${width}px (en, zh-TW, es): no horizontal overflow`, async () => {
    for (const locale of ["en", "zh-TW", "es"]) {
      await withPage({ ...iphone15(), viewport: { width, height: 800 } }, `/${locale}/giving`, noHorizontalOverflow);
    }
  });
}

for (const locale of ["en", "zh-TW"]) {
  test(`iPhone 15 (${locale}): axe finds no violations`, async () => {
    // Reduced motion: every Reveal is at its final state, so axe never samples mid-fade text.
    await withPage(iphone15({ reducedMotion: "reduce" }), `/${locale}/giving`, async (page) => {
      await page.addScriptTag({ content: AXE_SOURCE });
      const violations = await page.evaluate(async () => {
        // @ts-expect-error -- axe is injected above
        const result = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        });
        return result.violations.map((v: any) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target?.join(" ")})`);
      });
      assert.deepEqual(violations, []);
    });
  });
}

test("iPhone 15 (zh-TW): no English outside the allowlist and translate=no text", async () => {
  await withPage(iphone15(), "/zh-TW/giving", async (page) => {
    await page.waitForTimeout(1_500);
    const chunks = await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[translate="no"]'))) el.style.display = "none";
      const out: string[] = [document.body.innerText];
      for (const el of Array.from(document.querySelectorAll("[alt], [aria-label], [placeholder]"))) {
        for (const attr of ["alt", "aria-label", "placeholder"]) {
          const v = el.getAttribute(attr);
          if (v) out.push(v);
        }
      }
      return out;
    });
    const leaking = chunks.flatMap((c) => c.split("\n")).map((l) => l.trim()).filter((l) => l && englishLeaks(l).length > 0);
    assert.deepEqual(leaking, []);
    assert.equal((await page.locator("h1").innerText()).trim(), messages("zh-TW").giving.hero.title);
  });
});

test("reduced motion: the red thread is drawn and every section's copy is visible", async () => {
  await withPage(iphone15({ reducedMotion: "reduce" }), "/en/giving", async (page) => {
    const offset = await page.locator(".hm-thread-path").evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset));
    assert.equal(offset, 0);
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-giving-page] section :is(h1, h2, h3, p, li, blockquote)")).filter((node) => {
        let el: Element | null = node;
        while (el) {
          const s = getComputedStyle(el);
          if (s.opacity === "0" || s.visibility === "hidden" || s.display === "none") return true;
          el = el.parentElement;
        }
        return false;
      }).length,
    );
    assert.equal(hidden, 0);
  });
});
