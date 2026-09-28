/**
 * Home story e2e (Task D1): the eight-chapter mobile scroll story.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here), against the lane's web and API servers:
 *
 *   E2E_BASE_URL=http://localhost:3200 E2E_API_URL=http://localhost:4200 \
 *     node --test tests/e2e/site/home.spec.ts
 *
 * Checks: the hero and Order CTA sit above the fold at 390x844 (clear of the
 * dock), all eight chapters render in order, the CTAs go where they should,
 * the live pill shows the API's real numbers (and hides when there are
 * none), no horizontal overflow at 390 / 360 / 1440, axe, reduced motion,
 * and LCP under 2.5 s on a throttled 4G CDP profile (1.6 Mbps, 150 ms RTT,
 * CPU 4x) with the storefront photo as the LCP element.
 *
 * Accessibility runs axe-core (an apps/web devDependency) injected into the
 * page; `@axe-core/playwright` is not installed in this workspace.
 * Read-only: no API writes.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3200";
const API = process.env.E2E_API_URL || "http://localhost:4200";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../../../apps/web");
const requireFromWeb = createRequire(path.join(WEB, "package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");

const CHAPTERS = ["arrive", "walk-in", "the-pod", "the-bowl", "no-tip", "rewards", "red-step", "locations"];

type Messages = { home: Record<string, any> };
function messages(locale: string): Messages {
  return JSON.parse(readFileSync(path.join(WEB, "messages", `${locale}.json`), "utf8"));
}

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  // Warm the dev server's compile so the timed runs below measure the page, not Turbopack.
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: "load", timeout: 180_000 });
  } finally {
    await ctx.close();
  }
});

after(async () => {
  await browser?.close();
});

// iPhone 15 metrics, driven through Chromium (WebKit isn't installed here).
function iphone15(extra: Parameters<Browser["newContext"]>[0] = {}): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return { ...d, ...extra };
}

async function withPage<T>(
  opts: Parameters<Browser["newContext"]>[0],
  url: string,
  fn: (page: Page, ctx: BrowserContext) => Promise<T>,
  setup?: (ctx: BrowserContext) => Promise<void>,
): Promise<T> {
  const ctx: BrowserContext = await browser.newContext(opts);
  try {
    if (setup) await setup(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("[data-home]").waitFor({ state: "visible", timeout: 60_000 });
    // Hydration: the live pill island marks itself ready (with or without data).
    await page.locator("[data-live-ready='true']").first().waitFor({ state: "attached", timeout: 60_000 });
    return await fn(page, ctx);
  } finally {
    await ctx.close();
  }
}

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(scrollWidth <= innerWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`);
}

async function locationBySlug(slug: string): Promise<{ id: string; seats: Array<{ status: string }> } | null> {
  const res = await fetch(`${API}/locations`, { headers: { "x-tenant-slug": "oh" } });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ id: string; slug: string | null }>;
  const row = rows.find((r) => r.slug === slug);
  if (!row) return null;
  const avail = await fetch(`${API}/locations/${row.id}/availability`);
  return avail.ok ? { id: row.id, ...(await avail.json()) } : null;
}

test("iPhone 15 (en): the hero and the Order CTA are above the fold, clear of the dock", async () => {
  await withPage(iphone15(), "/en", async (page) => {
    const m = messages("en");
    const h1 = page.locator("[data-chapter='arrive'] h1");
    assert.equal((await h1.innerText()).trim(), m.home.arrive.title);
    const cta = page.locator("[data-home-order]").first();
    await cta.waitFor({ state: "visible" });
    const probe = await cta.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const dock = document.querySelector("[data-site-dock]")?.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { top: r.top, bottom: r.bottom, dockTop: dock ? dock.top : window.innerHeight, onTop: !!hit && el.contains(hit), vh: window.innerHeight };
    });
    assert.ok(probe.top >= 0, `CTA top ${probe.top}`);
    assert.ok(probe.bottom <= probe.dockTop, `CTA bottom ${probe.bottom} under the dock at ${probe.dockTop}`);
    assert.ok(probe.onTop, "nothing covers the CTA");
    // The hero photo is the storefront, eager with high fetch priority.
    const img = page.locator("[data-chapter='arrive'] picture img").first();
    assert.equal(await img.getAttribute("fetchpriority"), "high");
    assert.equal(await img.getAttribute("loading"), "eager");
    assert.match((await img.getAttribute("src")) ?? "", /storefront-dusk/);
  });
});

test("iPhone 15 (en): all eight chapters are present, in order, with no horizontal overflow", async () => {
  await withPage(iphone15(), "/en", async (page) => {
    const order = await page.locator("[data-chapter]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chapter")));
    assert.deepEqual(order, CHAPTERS);
    for (const id of CHAPTERS) {
      assert.equal(await page.locator(`section#${id}[data-chapter='${id}']`).count(), 1, `section #${id}`);
    }
    await noHorizontalOverflow(page);
  });
});

for (const locale of ["en", "zh-TW"] as const) {
  test(`iPhone 15 (${locale}): the Order CTA leads to /${locale}/order`, async () => {
    await withPage(iphone15(), `/${locale}`, async (page) => {
      const cta = page.locator("[data-home-order]").first();
      assert.equal(new URL((await cta.getAttribute("href"))!, BASE).pathname, `/${locale}/order`);
      assert.equal((await cta.innerText()).trim(), messages(locale).home.arrive.order);
      await Promise.all([page.waitForURL(new RegExp(`/${locale}/order`), { timeout: 120_000 }), cta.click()]);
    });
  });
}

test("iPhone 15: the rewards teaser and the location cards link to their pages", async () => {
  await withPage(iphone15(), "/en", async (page) => {
    const rewards = page.locator("[data-chapter='rewards'] a[data-home-rewards]");
    assert.equal(await rewards.getAttribute("href"), "/en/rewards");
    for (const slug of ["city-creek", "university-place"]) {
      const card = page.locator(`[data-location-card='${slug}']`);
      assert.equal(await card.locator("a[data-location-link]").getAttribute("href"), `/en/locations/${slug}`);
      const directions = await card.locator("a[data-location-directions]").getAttribute("href");
      assert.match(directions ?? "", /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
    }
    const foundation = page.locator("[data-chapter='red-step'] a[data-red-step-link]");
    assert.match((await foundation.getAttribute("href")) ?? "", /^https:\/\/www\.oneredstepatatime\.org/);
    assert.equal(await foundation.getAttribute("target"), "_blank");
  });
});

test("iPhone 15: the live pill shows the API's real pods-free count for City Creek", async () => {
  const cc = await locationBySlug("city-creek");
  assert.ok(cc, "the lane API has a city-creek location");
  await withPage(iphone15(), "/en", async (page) => {
    const pill = page.locator("[data-chapter='arrive'] [data-live-pill]");
    await pill.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await pill.getAttribute("data-location"), "city-creek");
    const free = cc!.seats.filter((s) => s.status === "AVAILABLE").length;
    if ((cc as any).isOpen) {
      assert.equal(await pill.locator("[data-live-pods]").getAttribute("data-value"), String(free));
    }
    assert.equal(await pill.getAttribute("data-open"), String(Boolean((cc as any).isOpen)));
  });
});

test("iPhone 15: with no live data, the pill is hidden, never a made-up number", async () => {
  await withPage(
    iphone15(),
    "/en",
    async (page) => {
      await page.waitForTimeout(1_500);
      assert.equal(await page.locator("[data-live-pill]").count(), 0);
      assert.equal(await page.locator("[data-live-pods]").count(), 0);
    },
    async (ctx) => {
      await ctx.route(/\/locations\/[^/]+\/availability/, (r) => r.fulfill({ status: 503, body: "{}" }));
    },
  );
});

test("iPhone 15: axe finds no violations", async () => {
  await withPage(iphone15(), "/en", async (page) => {
    await page.addScriptTag({ content: AXE_SOURCE });
    const violations = await page.evaluate(async () => {
      // @ts-expect-error -- axe is injected above
      const result = await window.axe.run(document.querySelector("[data-home]"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
      return result.violations.map((v: any) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target?.join(" ")})`);
    });
    assert.deepEqual(violations, []);
  });
});

test("reduced motion: every chapter's content is visible and the pinned stories are static", async () => {
  await withPage(iphone15({ reducedMotion: "reduce" }), "/en", async (page) => {
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-home] section :is(h1, h2, h3, p, img, li)")).filter((node) => {
        let el: Element | null = node;
        while (el) {
          const s = getComputedStyle(el);
          if (s.opacity === "0" || s.visibility === "hidden" || s.display === "none") return true;
          el = el.parentElement;
        }
        return false;
      }).map((n) => n.outerHTML.slice(0, 80)),
    );
    assert.deepEqual(hidden, []);
    assert.equal(await page.locator(".oh-pinned-story--static").count(), 2);
    // The pod chapter shows all three photos with their captions.
    assert.equal(await page.locator("[data-chapter='the-pod'] [data-pod-step]").count(), 3);
    await noHorizontalOverflow(page);
  });
});

test("zh-TW 390 and es 360: translated story with no horizontal overflow", async () => {
  await withPage(iphone15(), "/zh-TW", async (page) => {
    assert.equal((await page.locator("[data-chapter='arrive'] h1").innerText()).trim(), messages("zh-TW").home.arrive.title);
    await noHorizontalOverflow(page);
  });
  await withPage(iphone15({ viewport: { width: 360, height: 780 } }), "/es", async (page) => {
    assert.equal((await page.locator("[data-chapter='arrive'] h1").innerText()).trim(), messages("es").home.arrive.title);
    await noHorizontalOverflow(page);
  });
});

test("desktop 1440: no horizontal overflow", async () => {
  await withPage({ viewport: { width: 1440, height: 900 } }, "/en", async (page) => {
    await noHorizontalOverflow(page);
  });
});

test("LCP is under 2.5 s on throttled 4G (1.6 Mbps, 150 ms RTT, CPU 4x), and it is the storefront photo", async () => {
  const ctx = await browser.newContext(iphone15());
  try {
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      (window as any).__lcp = null;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        (window as any).__lcp = { time: last.startTime, url: last.url || "", tag: last.element?.tagName || "" };
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(`${BASE}/en`, { waitUntil: "load", timeout: 180_000 });
    await page.waitForTimeout(1_000);
    const lcp = (await page.evaluate(() => (window as any).__lcp)) as { time: number; url: string; tag: string } | null;
    assert.ok(lcp, "an LCP entry was recorded");
    console.log(`# LCP ${Math.round(lcp!.time)} ms (${lcp!.tag} ${lcp!.url})`);
    assert.match(lcp!.url, /storefront-dusk/, `LCP element is ${lcp!.tag} ${lcp!.url}`);
    assert.ok(lcp!.time < 2500, `LCP ${Math.round(lcp!.time)} ms`);
  } finally {
    await ctx.close();
  }
});
