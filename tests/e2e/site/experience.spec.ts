/**
 * Experience page e2e (Task D2): the six steps of a visit (arrive, order,
 * walk, settle, taste, leave) as full-screen snap steps, the pinned journey
 * map on the real comb layout, the FAQ, and the Order and Ask Chappy CTAs.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here), against the lane's web server:
 *
 *   E2E_BASE_URL=http://localhost:3200 node --test tests/e2e/site/experience.spec.ts
 *
 * Screenshots for the ledger: set D2_SHOTS_DIR to a folder.
 * Accessibility runs axe-core (an apps/web devDependency) injected into the
 * page. Read-only: no API writes.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3200";
const SHOTS = process.env.D2_SHOTS_DIR;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../../../apps/web");
const requireFromWeb = createRequire(path.join(WEB, "package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");
const STEPS = ["arrive", "order", "walk", "settle", "taste", "leave"] as const;

type Messages = { experience: Record<string, any> };
function messages(locale: string): Messages {
  return JSON.parse(readFileSync(path.join(WEB, "messages", `${locale}.json`), "utf8"));
}

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
});

// iPhone 15 metrics, driven through Chromium (WebKit isn't installed here).
function iphone15(extra: Parameters<Browser["newContext"]>[0] = {}): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return { ...d, ...extra };
}

async function withPage<T>(opts: Parameters<Browser["newContext"]>[0], url: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const ctx: BrowserContext = await browser.newContext(opts);
  try {
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("[data-experience-page]").waitFor({ state: "visible", timeout: 60_000 });
    // Hydration: the journey map island marks itself ready.
    await page.locator("[data-journey-map][data-ready='true']").first().waitFor({ state: "attached", timeout: 60_000 });
    return await fn(page);
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

/** Bring a step to the top of the viewport and wait for the visible map's dots to settle on it. */
async function goToStep(page: Page, step: (typeof STEPS)[number]) {
  await page.locator(`[data-step="${step}"]`).evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.waitForFunction(
    (s) => {
      const maps = Array.from(document.querySelectorAll<HTMLElement>("[data-journey-map]")).filter((m) => m.offsetParent !== null);
      return maps.length > 0 && maps.every((m) => m.dataset.activeStep === s && m.dataset.moving === "false");
    },
    step,
    { timeout: 15_000 },
  );
}

async function guestDot(page: Page): Promise<[number, number]> {
  return page.evaluate(() => {
    const map = Array.from(document.querySelectorAll<HTMLElement>("[data-journey-map]")).find((m) => m.offsetParent !== null);
    const dot = map?.querySelector<SVGCircleElement>('[data-marker="guest"]');
    if (!dot) throw new Error("no guest dot");
    return [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))] as [number, number];
  });
}

test("iPhone 15 (en): six full-screen steps in order, the pinned map, the FAQ, no horizontal overflow", async () => {
  await withPage(iphone15(), "/en/experience", async (page) => {
    const keys = await page.locator("[data-step]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.step));
    assert.deepEqual(keys, [...STEPS]);
    // Full screen: every step fills the space between the top bar and the dock.
    const heights = await page.locator("[data-step]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    const { vh, bar, dock } = await page.evaluate(() => ({
      vh: window.innerHeight,
      bar: document.querySelector("header")?.getBoundingClientRect().height ?? 0,
      dock: document.querySelector("[data-dock-item]")?.closest("nav")?.getBoundingClientRect().height ?? 65,
    }));
    for (const h of heights) assert.ok(h >= vh - bar - dock - 2, `step height ${h} vs viewport ${vh} - bar ${bar} - dock ${dock}`);
    // Mandatory vertical snap on phones.
    const snap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
    assert.match(snap, /y mandatory/);
    const align = await page.locator("[data-step]").first().evaluate((e) => getComputedStyle(e).scrollSnapAlign);
    assert.match(align, /start/);
    // The map is the real comb layout (City Creek, 75 pods) in journey mode, pinned.
    const map = page.locator("[data-journey-map]:visible");
    assert.equal(await map.count(), 1);
    assert.equal(await map.locator("svg[data-layout='comb-75']").count(), 1);
    assert.equal(await map.locator("svg[data-journey-target]").count(), 1);
    assert.equal(await map.locator("[data-pod]").count(), 75);
    assert.equal(await page.locator("section#faq details").count(), Object.keys(messages("en").experience.faq.items).length);
    await noHorizontalOverflow(page);
    // The map stays pinned while the steps scroll under it.
    await goToStep(page, "walk");
    const top = await map.evaluate((m) => m.getBoundingClientRect().top);
    assert.ok(top >= 0 && top < 200, `map top ${top}`);
  });
});

test("iPhone 15: the journey dot moves between step 2 (order) and step 4 (settle), and the bowl leaves the kitchen", async () => {
  await withPage(iphone15(), "/en/experience", async (page) => {
    await goToStep(page, "order");
    const atOrder = await guestDot(page);
    await goToStep(page, "settle");
    const atSettle = await guestDot(page);
    assert.notDeepEqual(atOrder, atSettle, "guest dot position should change");
    const dist = Math.hypot(atOrder[0] - atSettle[0], atOrder[1] - atSettle[1]);
    assert.ok(dist > 5, `the guest walked ${dist} ft`);
    // The bowl travels too: from the kitchen (order) down the staff corridor (settle) to the hatch (taste).
    const bowlAt = () =>
      page.evaluate(() => {
        const map = Array.from(document.querySelectorAll<HTMLElement>("[data-journey-map]")).find((m) => m.offsetParent !== null);
        const dot = map?.querySelector('[data-marker="bowl"]');
        return dot ? [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))] : null;
      });
    const bowlSettle = await bowlAt();
    await goToStep(page, "order");
    const bowlOrder = await bowlAt();
    await goToStep(page, "taste");
    const bowlTaste = await bowlAt();
    assert.ok(bowlOrder && bowlSettle && bowlTaste, "bowl dot drawn at order, settle and taste");
    assert.notDeepEqual(bowlOrder, bowlSettle, "the bowl leaves the kitchen by settle");
    assert.notDeepEqual(bowlSettle, bowlTaste, "the bowl reaches the hatch by taste");
    // Taste: the guest is still at the pod.
    assert.deepEqual(await guestDot(page), atSettle);
    // Leave: the guest heads out; the dot is somewhere new again.
    await goToStep(page, "leave");
    const atLeave = await guestDot(page);
    assert.notDeepEqual(atLeave, atSettle);
  });
});

test("iPhone 15: the primary CTA goes to the order flow", async () => {
  await withPage(iphone15(), "/en/experience", async (page) => {
    const cta = page.locator("[data-experience-order]").first();
    assert.equal(await cta.getAttribute("href"), "/en/order");
    await cta.scrollIntoViewIfNeeded();
    await Promise.all([page.waitForURL(/\/en\/order(\?|$)/, { timeout: 60_000 }), cta.click()]);
  });
});

test("iPhone 15: Ask Chappy opens the chat", async () => {
  await withPage(iphone15(), "/en/experience", async (page) => {
    const ask = page.locator("[data-experience-chappy]");
    await ask.scrollIntoViewIfNeeded();
    await ask.click();
    await page.locator(".chappy-panel").first().waitFor({ state: "visible", timeout: 60_000 });
  });
});

test("iPhone 15: the FAQ opens from the keyboard", async () => {
  await withPage(iphone15(), "/en/experience", async (page) => {
    const first = page.locator("section#faq details").first();
    assert.equal(await first.evaluate((d) => (d as HTMLDetailsElement).open), false);
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await first.evaluate((d) => (d as HTMLDetailsElement).open), true);
    await page.keyboard.press("Space");
    assert.equal(await first.evaluate((d) => (d as HTMLDetailsElement).open), false);
  });
});

test("iPhone 15 and desktop: axe finds no violations", async () => {
  for (const opts of [iphone15(), { viewport: { width: 1440, height: 900 } }]) {
    await withPage(opts, "/en/experience", async (page) => {
      await page.addScriptTag({ content: AXE_SOURCE });
      const violations = await page.evaluate(async () => {
        // @ts-expect-error -- axe is injected above
        const result = await window.axe.run(document.querySelector("[data-experience-page]"), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        });
        return result.violations.map((v: any) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target?.join(" ")})`);
      });
      assert.deepEqual(violations, []);
    });
  }
});

test("reduced motion: every step's copy and photo is visible, and the map still follows the steps", async () => {
  await withPage(iphone15({ reducedMotion: "reduce" }), "/en/experience", async (page) => {
    const m = messages("en").experience;
    for (const step of STEPS) {
      const el = page.locator(`[data-step="${step}"]`);
      await el.evaluate((e) => e.scrollIntoView({ block: "start", behavior: "instant" }));
      const title = el.locator("h2");
      assert.equal((await title.innerText()).trim(), m.steps[step].title);
      const opacity = await el.evaluate((e) => {
        let min = 1;
        for (const n of Array.from(e.querySelectorAll<HTMLElement>("h2, p, img"))) {
          let x: Element | null = n;
          while (x && x !== e.parentElement) {
            min = Math.min(min, Number(getComputedStyle(x).opacity));
            x = x.parentElement;
          }
        }
        return min;
      });
      assert.equal(opacity, 1, `${step} content fully opaque`);
    }
    await goToStep(page, "order");
    const a = await guestDot(page);
    await goToStep(page, "settle");
    const b = await guestDot(page);
    assert.notDeepEqual(a, b);
    const faq = page.locator("section#faq");
    await faq.scrollIntoViewIfNeeded();
    assert.ok(await faq.locator("h2").isVisible());
  });
});

test("zh-TW: translated copy, no English steps, no overflow; es at 360 has no overflow", async () => {
  await withPage(iphone15({ locale: "zh-TW" }), "/zh-TW/experience", async (page) => {
    const m = messages("zh-TW").experience;
    const en = messages("en").experience;
    for (const step of STEPS) {
      const text = await page.locator(`[data-step="${step}"] h2`).innerText();
      assert.equal(text.trim(), m.steps[step].title);
      assert.notEqual(text.trim(), en.steps[step].title);
    }
    const body = await page.locator("[data-experience-page]").innerText();
    for (const phrase of ["You walk in", "First spoon", "How do I order"]) assert.ok(!body.includes(phrase), `English "${phrase}" on zh-TW`);
    await noHorizontalOverflow(page);
  });
  await withPage({ ...iphone15(), viewport: { width: 360, height: 780 } }, "/es/experience", async (page) => {
    await noHorizontalOverflow(page);
    for (const step of STEPS) {
      const box = await page.locator(`[data-step="${step}"] [data-step-copy]`).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 360, `${step} copy inside 360`);
    }
  });
});

test("screenshots (D2_SHOTS_DIR)", { skip: !SHOTS }, async () => {
  const dir = SHOTS as string;
  const cases: { name: string; locale: string; opts: Parameters<Browser["newContext"]>[0] }[] = [
    { name: "390-en", locale: "en", opts: iphone15() },
    { name: "390-zh-TW", locale: "zh-TW", opts: iphone15({ locale: "zh-TW" }) },
    { name: "360-es", locale: "es", opts: { ...iphone15(), viewport: { width: 360, height: 780 } } },
    { name: "1440-en", locale: "en", opts: { viewport: { width: 1440, height: 900 } } },
    { name: "1440-zh-TW", locale: "zh-TW", opts: { viewport: { width: 1440, height: 900 } } },
  ];
  for (const c of cases) {
    await withPage(c.opts, `/${c.locale}/experience`, async (page) => {
      await page.waitForLoadState("load");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(dir, `d2-experience-${c.name}-intro.png`) });
      for (const step of STEPS) {
        await goToStep(page, step);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(dir, `d2-experience-${c.name}-${step}.png`) });
      }
      const faq = page.locator("section#faq");
      await faq.evaluate((e) => e.scrollIntoView({ block: "start", behavior: "instant" }));
      await faq.locator("details summary").first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(dir, `d2-experience-${c.name}-faq.png`) });
    });
  }
});
