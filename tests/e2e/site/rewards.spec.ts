/**
 * Rewards page e2e (Task D7): the climb, the tier cards, the path-to-Beef-Boss
 * simulator, credits, referrals, the seal gallery, challenges and the FAQ,
 * plus the /loyalty -> /rewards 308.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here), against the lane's web and API servers:
 *
 *   E2E_BASE_URL=http://localhost:3200 node --test tests/e2e/site/rewards.spec.ts
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
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../../../apps/web");
const requireFromWeb = createRequire(path.join(WEB, "package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");

type Messages = { rewards: Record<string, any>; loyalty: { tiers: Record<string, { name: string }> } };
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
    await page.locator("[data-rewards-page]").waitFor({ state: "visible", timeout: 60_000 });
    // Hydration: the simulator island marks itself ready.
    await page.locator("[data-simulator][data-ready='true']").waitFor({ state: "attached", timeout: 60_000 });
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

test("iPhone 15 (en): renders every section with no horizontal overflow", async () => {
  await withPage(iphone15(), "/en/rewards", async (page) => {
    for (const id of ["climb", "tiers", "simulator", "credits", "referrals", "seals", "challenges", "faq"]) {
      assert.equal(await page.locator(`section#${id}`).count(), 1, `section #${id}`);
    }
    await noHorizontalOverflow(page);
    // The climb names each tier with the canonical loyalty.tiers names.
    const m = messages("en");
    const climb = page.locator("section#climb");
    for (const k of ["chopstick", "noodleMaster", "beefBoss"]) {
      assert.ok((await climb.innerText()).includes(m.loyalty.tiers[k].name), `climb shows ${k}`);
    }
  });
});

test("iPhone 15: the primary CTA takes you to the simulator", async () => {
  await withPage(iphone15(), "/en/rewards", async (page) => {
    await page.locator("[data-rewards-cta]").click();
    await page.waitForFunction(() => location.hash === "#simulator");
    await page.waitForFunction(() => {
      const r = document.querySelector("section#simulator")!.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
  });
});

// Fix round 1: engine parity (event-by-event upgrades) supersedes the plan's month-10 figure.
test("iPhone 15: the simulator defaults to the plan case (Beef Boss in month 9)", async () => {
  await withPage(iphone15(), "/en/rewards", async (page) => {
    const sim = page.locator("[data-simulator]");
    assert.equal(await sim.locator("[data-tier-date='BEEF_BOSS']").getAttribute("data-month"), "9");
    assert.equal(await sim.locator("[data-tier-date='NOODLE_MASTER']").getAttribute("data-month"), "3");
    assert.equal(await sim.locator("[data-sim-free-bowls]").getAttribute("data-value"), "2");
    assert.equal(await sim.locator("[data-sim-cashback]").getAttribute("data-value"), "4278");
  });
});

for (const locale of ["en", "zh-TW"] as const) {
  test(`iPhone 15 (${locale}): friends at 0 shows the translated never state`, async () => {
    await withPage(iphone15(), `/${locale}/rewards`, async (page) => {
      const sim = page.locator("[data-simulator]");
      assert.equal(await sim.locator("[data-sim-never]").count(), 0);
      const friends = sim.locator("input[data-sim-input='friends']");
      await friends.focus();
      await page.keyboard.press("Home");
      assert.equal(await friends.inputValue(), "0");
      const never = sim.locator("[data-sim-never]");
      await never.waitFor({ state: "visible" });
      assert.equal((await never.locator("[data-sim-never-title]").innerText()).trim(), messages(locale).rewards.simulator.never.title);
      // aria-valuetext is translated, not a bare number.
      const valuetext = await friends.getAttribute("aria-valuetext");
      assert.ok(valuetext && /\D/.test(valuetext), `aria-valuetext "${valuetext}"`);
      assert.equal(await sim.locator("[data-tier-date='BEEF_BOSS']").getAttribute("data-month"), "never");
      await noHorizontalOverflow(page);
    });
  });
}

test("iPhone 15: the Beef Boss card flips to its perks", async () => {
  await withPage(iphone15(), "/en/rewards", async (page) => {
    const card = page.locator("[data-tier-card='BEEF_BOSS']");
    const flip = card.locator("[data-tier-flip]");
    assert.equal(await flip.getAttribute("aria-pressed"), "false");
    await flip.click();
    assert.equal(await flip.getAttribute("aria-pressed"), "true");
    const back = card.locator("[data-tier-back]");
    assert.equal(await back.getAttribute("aria-hidden"), "false");
    assert.ok((await back.innerText()).includes(messages("en").rewards.tiers.perks.quarterly));
  });
});

test("iPhone 15: a seal opens its sheet with how to earn it", async () => {
  await withPage(iphone15(), "/en/rewards", async (page) => {
    const first = page.locator("[data-seal-button]").first();
    const name = (await first.getAttribute("data-seal-name")) ?? "";
    assert.ok(name.length > 0, "the gallery has at least one badge");
    await first.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    assert.ok((await dialog.innerText()).includes(name));
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
  });
});

test("iPhone 15: the FAQ opens from the keyboard", async () => {
  await withPage(iphone15(), "/en/rewards", async (page) => {
    const first = page.locator("section#faq details").first();
    assert.equal(await first.evaluate((d) => (d as HTMLDetailsElement).open), false);
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await first.evaluate((d) => (d as HTMLDetailsElement).open), true);
  });
});

test("iPhone 15: axe finds no violations", async () => {
  await withPage(iphone15(), "/en/rewards", async (page) => {
    await page.addScriptTag({ content: AXE_SOURCE });
    const violations = await page.evaluate(async () => {
      // @ts-expect-error -- axe is injected above
      const result = await window.axe.run(document.querySelector("[data-rewards-page]"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
      return result.violations.map((v: any) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target?.join(" ")})`);
    });
    assert.deepEqual(violations, []);
  });
});

test("reduced motion: every section's content is visible, the climb is fully lit", async () => {
  await withPage(iphone15({ reducedMotion: "reduce" }), "/en/rewards", async (page) => {
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-rewards-page] section h2")).filter((h) => {
        let el: Element | null = h;
        while (el) {
          const s = getComputedStyle(el);
          if (s.opacity === "0" || s.visibility === "hidden" || s.display === "none") return true;
          el = el.parentElement;
        }
        return false;
      }).length,
    );
    assert.equal(hidden, 0);
    assert.equal(await page.locator("[data-climb][data-static='true']").count(), 1);
  });
});

test("reduced motion: a flipped tier card shows its perks, flat, with no 3D turn", async () => {
  await withPage(iphone15({ reducedMotion: "reduce" }), "/en/rewards", async (page) => {
    const card = page.locator("[data-tier-card='BEEF_BOSS']");
    await card.scrollIntoViewIfNeeded();
    await card.locator("[data-tier-flip]").click();
    const back = card.locator("[data-tier-back]");
    assert.equal(await back.getAttribute("aria-hidden"), "false");
    const perk = back.locator("li").first();
    await perk.scrollIntoViewIfNeeded();
    // The perk is really painted: the back face is in the hit stack at the
    // perk's center (under the transparent flip button), nothing is rotated,
    // and the back is visible while the front is hidden.
    const probe = await perk.evaluate((li) => {
      const r = li.getBoundingClientRect();
      const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const inner = li.closest(".rw-card-inner") as HTMLElement;
      const backFace = li.closest("[data-tier-back]") as HTMLElement;
      return {
        area: r.width * r.height,
        hitsBack: stack.some((el) => backFace.contains(el)),
        innerTransform: getComputedStyle(inner).transform,
        backTransform: getComputedStyle(backFace).transform,
        backVisibility: getComputedStyle(backFace).visibility,
      };
    });
    assert.ok(probe.area > 0, "the perk has area");
    assert.ok(probe.hitsBack, "the back face is under the perk's center");
    assert.equal(probe.innerTransform, "none");
    assert.equal(probe.backTransform, "none");
    assert.equal(probe.backVisibility, "visible");
    assert.equal(await card.locator("[data-tier-front]").evaluate((el) => getComputedStyle(el).visibility), "hidden");
  });
});

test("desktop 1440: no horizontal overflow", async () => {
  await withPage({ viewport: { width: 1440, height: 900 } }, "/en/rewards", async (page) => {
    await noHorizontalOverflow(page);
  });
});

test("/zh-TW/loyalty redirects to /zh-TW/rewards with a permanent 308", async () => {
  const res = await fetch(`${BASE}/zh-TW/loyalty`, { redirect: "manual" });
  assert.equal(res.status, 308);
  assert.equal(new URL(res.headers.get("location")!, BASE).pathname, "/zh-TW/rewards");
  await withPage(iphone15(), "/zh-TW/loyalty", async (page) => {
    assert.equal(new URL(page.url()).pathname, "/zh-TW/rewards");
    const m = messages("zh-TW");
    assert.ok((await page.locator("section#climb").innerText()).includes(m.loyalty.tiers.beefBoss.name));
  });
});
