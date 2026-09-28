/**
 * Experience page e2e (Task D2, eight steps since the 2026-09-28 follow-up):
 * the steps of a visit (arrive, order, walk, settle, status, panel, taste,
 * leave) as full-screen snap steps, the pinned journey map on the real comb
 * layout, the status step's live phone (lazy iframe of the DEMO-PLAN status
 * page, a preview on phones with "Try it live" opening a sheet), the FAQ,
 * and the Order and Ask Chappy CTAs.
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
import { englishLeaks } from "../../../apps/web/lib/site/i18n-allowlist.ts";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3200";
const SHOTS = process.env.D2_SHOTS_DIR;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../../../apps/web");
const requireFromWeb = createRequire(path.join(WEB, "package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");
const STEPS = ["arrive", "order", "walk", "settle", "status", "panel", "taste", "leave"] as const;

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

test("iPhone 15 (en): eight full-screen steps in order, the pinned map, the FAQ, no horizontal overflow", async () => {
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

async function bowlDot(page: Page): Promise<[number, number] | null> {
  return page.evaluate(() => {
    const map = Array.from(document.querySelectorAll<HTMLElement>("[data-journey-map]")).find((m) => m.offsetParent !== null);
    const dot = map?.querySelector('[data-marker="bowl"]');
    return dot ? ([Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))] as [number, number]) : null;
  });
}

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);

test("iPhone 15: the dots follow all eight steps; status brings the bowl in the kitchen, panel takes it to the hatch", async () => {
  await withPage(iphone15(), "/en/experience", async (page) => {
    await goToStep(page, "order");
    const atOrder = await guestDot(page);
    await goToStep(page, "walk");
    const atWalk = await guestDot(page);
    await goToStep(page, "settle");
    const atSettle = await guestDot(page);
    assert.ok(dist(atOrder, atSettle) > 5, `the guest walked ${dist(atOrder, atSettle)} ft`);
    assert.notDeepEqual(atWalk, atSettle, "settle: from the pod door into the seat");
    // Before check-in there is no bowl on the map: the kitchen fires it once the guest is in.
    assert.equal(await bowlDot(page), null, "no bowl before the status step");
    // Status: the guest is at the pod, and the bowl appears in the kitchen.
    await goToStep(page, "status");
    const bowlStatus = await bowlDot(page);
    assert.ok(bowlStatus, "status: the bowl is drawn");
    assert.deepEqual(await guestDot(page), atSettle, "status: the guest is still at the pod");
    // Panel: the bowl has come down the staff corridor to the hatch.
    await goToStep(page, "panel");
    const bowlPanel = await bowlDot(page);
    assert.ok(bowlPanel && dist(bowlStatus!, bowlPanel) > 5, `panel: the bowl moved ${bowlPanel ? dist(bowlStatus!, bowlPanel) : 0} ft`);
    assert.deepEqual(await guestDot(page), atSettle, "panel: the guest is still at the pod");
    // Taste: the bowl stays at the hatch, the guest at the pod.
    await goToStep(page, "taste");
    assert.deepEqual(await bowlDot(page), bowlPanel);
    assert.deepEqual(await guestDot(page), atSettle);
    // Leave: the guest heads out; the dot is somewhere new again.
    await goToStep(page, "leave");
    assert.notDeepEqual(await guestDot(page), atSettle);
    // And back up: the map follows the steps backwards too.
    await goToStep(page, "status");
    assert.deepEqual(await bowlDot(page), bowlStatus);
  });
});

test("iPhone 15: the status step's phone is a lazy, non-interactive preview, and Try it live opens the sheet", async () => {
  await withPage(iphone15(), "/en/experience", async (page) => {
    const phone = page.locator("[data-status-phone]");
    // Lazy: no iframe until the step is near.
    assert.equal(await page.locator("[data-status-iframe]").count(), 0, "no status iframe at the top of the page");
    await goToStep(page, "status");
    const frame = page.locator("[data-status-iframe]");
    await frame.waitFor({ state: "attached", timeout: 30_000 });
    const src = (await frame.getAttribute("src")) || "";
    assert.match(src, /^\/en\/order\/status\?orderQrCode=DEMO-PLAN&embed=1$/);
    // Scaled from a 390 x 844 layout.
    const css = await frame.evaluate((f) => ({ w: (f as HTMLElement).style.width, h: (f as HTMLElement).style.height }));
    assert.deepEqual(css, { w: "390px", h: "844px" });
    // Preview only: no pointer events and inert, so a swipe over it scrolls the page.
    const frameBox = page.locator("[data-status-phone-frame]");
    assert.equal(await frameBox.evaluate((e) => getComputedStyle(e).pointerEvents), "none");
    assert.equal(await frameBox.evaluate((e) => e.hasAttribute("inert")), true);
    // The phone stays clear of the pinned map card.
    const map = await page.locator("[data-journey-map]:visible").boundingBox();
    const pb = await frameBox.boundingBox();
    assert.ok(map && pb && pb.x + pb.width <= map.x, `phone ${pb?.x}+${pb?.width} vs card at ${map?.x}`);
    // Try it live: a 44px target that opens the sheet with an interactive embed.
    const tryIt = page.locator("[data-status-try]");
    const tb = await tryIt.boundingBox();
    assert.ok(tb && tb.height >= 44 && tb.width >= 44, `try it live target ${tb?.width}x${tb?.height}`);
    await tryIt.click();
    const sheet = page.locator("[role='dialog'] [data-status-sheet]");
    await sheet.waitFor({ state: "visible", timeout: 30_000 });
    const sheetFrame = sheet.locator("[data-status-sheet-iframe]");
    assert.equal(await sheetFrame.getAttribute("src"), src);
    assert.notEqual(await sheetFrame.evaluate((e) => getComputedStyle(e).pointerEvents), "none");
    const sf = await sheetFrame.boundingBox();
    const vh = await page.evaluate(() => window.innerHeight);
    assert.ok(sf && sf.height > vh * 0.6, `sheet embed ${sf?.height} tall in ${vh}`);
    // Close returns to the page.
    await page.locator("[data-status-sheet-close]").click();
    await sheet.waitFor({ state: "detached", timeout: 10_000 });
    // The features: a rail of six cards on phones, and the link to the full demo page.
    assert.equal(await page.locator("[data-status-rail] [data-status-feature]").count(), 6);
    assert.equal(await page.locator("[data-status-open]").getAttribute("href"), "/en/order/status?orderQrCode=DEMO-PLAN");
    assert.ok(await phone.isVisible());
  });
});

test("desktop: the status phone is interactive inline, with the six features listed beside it", async () => {
  await withPage({ viewport: { width: 1440, height: 900 } }, "/en/experience", async (page) => {
    await goToStep(page, "status");
    const frameBox = page.locator("[data-status-phone-frame]");
    await page.locator("[data-status-iframe]").waitFor({ state: "attached", timeout: 30_000 });
    assert.notEqual(await frameBox.evaluate((e) => getComputedStyle(e).pointerEvents), "none");
    assert.equal(await frameBox.evaluate((e) => e.hasAttribute("inert")), false);
    assert.equal(await page.locator("[data-status-try]").isVisible(), false);
    const list = page.locator("ul [data-status-feature]");
    assert.equal(await list.count(), 6);
    const pb = await frameBox.boundingBox();
    const lb = await list.first().boundingBox();
    assert.ok(pb && lb && lb.x > pb.x + pb.width, "the list sits beside the phone");
    // The FAQ's phone answer links to the status step.
    const link = page.locator("[data-faq-status-link]");
    assert.equal(await link.getAttribute("href"), "#status");
    assert.equal(await page.locator("#status").count(), 1);
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
    // The chat surface: a bottom sheet on phones, a side panel on desktop.
    await page.locator("[data-chappy-surface='sheet'] [role='dialog'], [data-chappy-surface='panel']").first().waitFor({ state: "visible", timeout: 60_000 });
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
    for (const phrase of ["You walk in", "First spoon", "How do I order", "Your phone runs", "Seven minutes", "Try it live", "Live Kitchen Feed", "One Red Step"]) {
      assert.ok(!body.includes(phrase), `English "${phrase}" on zh-TW`);
    }
    // No English at all outside the allowlist, including the status step's features and the rail (all of the page's text, hidden or not).
    // Text node by text node (the map's row letters A, B, C are separate labels, not a word).
    const all = await page.locator("[data-experience-page]").evaluate((e) => {
      const out: string[] = [];
      const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n.textContent || "");
      return out.join(" ");
    });
    assert.deepEqual([...new Set(englishLeaks(all))], [], "English words on zh-TW");
    // The status step's new copy, and the iframe's accessible title.
    assert.equal((await page.locator('[data-step="status"] h2').innerText()).trim(), m.steps.status.title);
    assert.equal(await page.locator("[data-status-phone] [data-status-poster]").count(), 1);
    await goToStep(page, "status");
    await page.locator("[data-status-iframe]").waitFor({ state: "attached", timeout: 30_000 });
    assert.equal(await page.locator("[data-status-iframe]").getAttribute("title"), m.steps.status.frame);
    assert.match((await page.locator("[data-status-iframe]").getAttribute("src")) || "", /^\/zh-TW\/order\/status\?/);
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
