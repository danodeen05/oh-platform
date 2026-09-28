/**
 * Chappy web chat e2e (Task E1): the phone sheet, the desktop panel, the
 * legacy launcher, identity headers, streaming and translated errors.
 *
 * Runs with node's own test runner and the repo's `playwright` package (the
 * Playwright MCP can't launch here), against the lane's web server:
 *
 *   E2E_BASE_URL=http://localhost:3100 node --test tests/e2e/site/chappy.spec.ts
 *
 * Most tests stub POST /chappy/chat (and /chappy/history) in the browser, so
 * they cost nothing and can run any time. The two `@live` tests call the
 * real model through the lane's API and cost money: they run only with
 * E2E_LIVE=1, on demand. The signed-in live test also needs the Clerk DEV
 * secret (CLERK_SECRET_KEY=sk_test_...) and E2E_CHAPPY_MEMBER (a Clerk dev
 * user id whose verified email is a member with past orders in the lane DB):
 *
 *   E2E_LIVE=1 node --env-file=.env --test --test-name-pattern=@live tests/e2e/site/chappy.spec.ts
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Page, type Route } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3100";
const LIVE = process.env.E2E_LIVE === "1";
const LAB = "/lab/shell";

const messages = (locale: string) =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), `apps/web/messages/${locale}.json`), "utf8")).chappyWeb;

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

async function withPage<T>(opts: Parameters<Browser["newContext"]>[0], fn: (page: Page, ctx: BrowserContext) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext(opts);
  try {
    const page = await ctx.newPage();
    return await fn(page, ctx);
  } finally {
    await ctx.close();
  }
}

async function go(page: Page, p: string) {
  await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 180_000 });
}

/**
 * Clicks until `target` shows. A tap that lands before React hydrates the
 * trigger does nothing (dev compiles make that window long), so retry a few times.
 */
async function clickUntil(page: Page, trigger: string, target: string) {
  const item = page.locator(trigger);
  await item.waitFor({ state: "visible", timeout: 60_000 });
  for (let i = 0; i < 4; i++) {
    // Already open (the lazy widget chunk is still compiling): wait, don't toggle it shut.
    if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
    try {
      await page.locator(target).waitFor({ state: "visible", timeout: i < 3 ? 8_000 : 60_000 });
      return;
    } catch (e) {
      if (i === 3) throw e;
    }
  }
}

async function openFromDock(page: Page) {
  await clickUntil(page, '[data-dock-item="chappy"]', "[data-chappy]");
}

const sse = (events: Array<[string, unknown]>) => ": chappy\n\n" + events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

type Seen = { headers: Record<string, string>; body: any };

const STUB_GUEST_TOKEN = "stub-guest-token.0123456789abcdef0123456789abcdef";

/**
 * Stubs POST /chappy/guest-token. The real route is rate limited (10 an hour
 * per IP), and every fresh browser context would mint one; the stubbed
 * tests exercise the widget's mint-and-store path without spending that.
 */
async function stubGuestToken(ctx: BrowserContext) {
  await ctx.route("**/chappy/guest-token", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", "access-control-allow-origin": new URL(BASE).origin },
      body: JSON.stringify({ token: STUB_GUEST_TOKEN }),
    }),
  );
}

/** Stubs POST /chappy/chat (and the guest token) with a fixed answer and records what the widget sent. */
async function stubChat(ctx: BrowserContext, answer: (seen: Seen) => { status?: number; body: string; json?: boolean }): Promise<Seen[]> {
  await stubGuestToken(ctx);
  const seen: Seen[] = [];
  await ctx.route("**/chappy/chat", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.continue();
    const s = { headers: req.headers(), body: JSON.parse(req.postData() || "{}") };
    seen.push(s);
    const a = answer(s);
    await route.fulfill({
      status: a.status ?? 200,
      headers: { "content-type": a.json ? "application/json" : "text/event-stream", "access-control-allow-origin": new URL(BASE).origin, "access-control-allow-credentials": "true" },
      body: a.body,
    });
  });
  return seen;
}

async function send(page: Page, text: string) {
  const box = page.locator("#chappy-input");
  await box.fill(text);
  await box.press("Enter");
}

test("iPhone 15, zh-TW guest: the dock opens a full-screen sheet with the translated welcome and quick actions", async () => {
  const zh = messages("zh-TW");
  await withPage({ ...iphone15(), locale: "zh-TW" }, async (page) => {
    await go(page, `/zh-TW${LAB}`);
    await openFromDock(page);
    const sheet = page.locator('[role="dialog"][aria-label="' + zh.dialogLabel + '"]');
    await sheet.waitFor({ state: "visible" });
    await page.locator("[data-chappy-welcome]").waitFor({ state: "visible", timeout: 30_000 });
    assert.match(await page.locator("[data-chappy-welcome]").innerText(), new RegExp(zh.welcome.slice(0, 8)));

    // Full screen: the panel covers the viewport.
    const box = await page.locator(".chappy-sheet .oh-sheet-panel").boundingBox();
    const vp = page.viewportSize()!;
    assert.ok(box && box.width >= vp.width - 1 && box.height >= vp.height - 2, `sheet is ${box?.width}x${box?.height} in ${vp.width}x${vp.height}`);

    // Four translated quick actions, each at least 44px tall.
    const quick = page.locator("[data-chappy-quick]");
    assert.equal(await quick.count(), 4);
    for (const [i, key] of ["usual", "today", "where", "problem"].entries()) {
      assert.equal((await quick.nth(i).innerText()).trim(), zh.quick[key]);
      const b = await quick.nth(i).boundingBox();
      assert.ok(b && b.height >= 44, `quick ${key} is ${b?.height}px tall`);
    }

    // The composer text is 16px (no iOS zoom), the send button 44x44.
    assert.equal(await page.locator("#chappy-input").evaluate((el) => getComputedStyle(el).fontSize), "16px");
    const sendBox = await page.locator("[data-chappy-composer] button[type=submit]").boundingBox();
    assert.ok(sendBox && sendBox.width >= 44 && sendBox.height >= 44);

    // No English and no horizontal overflow.
    const text = await page.locator("[data-chappy]").innerText();
    assert.doesNotMatch(text.replace(/Chappy|AI/g, ""), /[A-Za-z]{3,}/, "no English left in the zh-TW widget");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

    // Esc closes it.
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "hidden" });
  });
});

test("the composer stays above the keyboard (viewport shrunk to 390x500)", async () => {
  await withPage(iphone15(), async (page) => {
    await go(page, `/en${LAB}`);
    await openFromDock(page);
    await page.locator("#chappy-input").focus();
    await page.setViewportSize({ width: 390, height: 500 });
    await page.waitForTimeout(600);
    const composer = await page.locator("[data-chappy-composer]").boundingBox();
    assert.ok(composer, "composer has a box");
    assert.ok(composer.y >= 0 && composer.y + composer.height <= 500 + 0.5, `composer spans ${composer.y}..${composer.y + composer.height} in a 500px viewport`);
    assert.ok(await page.locator("#chappy-input").isVisible());
    assert.equal(await page.evaluate(() => document.activeElement?.id), "chappy-input");
  });
});

test("guest identity: the chat is sent with the signed guest token only, and the reply streams in with tool status and cards", async () => {
  const en = messages("en");
  await withPage(iphone15(), async (page, ctx) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const seen: Seen[] = [];
    await stubGuestToken(ctx);
    // A stream held back until the working state has been seen.
    await ctx.route("**/chappy/chat", async (route) => {
      const req = route.request();
      seen.push({ headers: req.headers(), body: JSON.parse(req.postData() || "{}") });
      await gate;
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream", "access-control-allow-origin": new URL(BASE).origin },
        body: sse([
          ["tool_start", { name: "get_locations" }],
          ["text", { delta: "We close at **9 pm** tonight.\n\n- City Creek: 11 am to 9 pm\n- University Place: 11 am to 9 pm" }],
          ["card", { card: { type: "sign-in" } }],
          ["card", { card: { type: "pay", orderId: "o1", clientSecret: "x", amountDueCents: 1500 } }],
          ["done", { usage: {}, text: "" }],
        ]),
      });
    });
    await go(page, `/en${LAB}`);
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor();
    await send(page, "what time do you close");

    // While the answer is pending: the working state, not typing dots.
    await page.locator("[data-chappy-working]").waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-chappy-composer] button[type=submit]").isDisabled(), true);
    release();

    const reply = page.locator('[data-chappy-turn="assistant"]').last();
    await reply.locator("[data-chappy-text]").waitFor();
    assert.match(await reply.innerText(), /We close at 9 pm tonight\./);
    assert.equal(await reply.locator("strong").innerText(), "9 pm");
    assert.equal(await reply.locator("ul li").count(), 2);
    await page.locator("[data-chappy-working]").waitFor({ state: "detached" });

    // Cards: the translated E1 fallback for each type; sign-in has its button.
    assert.match(await page.locator('[data-chappy-card="pay"]').innerText(), new RegExp(en.cards.pay.title, "i"));
    assert.equal(await page.locator('[data-chappy-card="sign-in"] button').count(), 1);

    // Identity: the signed guest token, and nothing else that could name a user.
    assert.equal(seen.length, 1);
    const h = seen[0].headers;
    assert.equal(h["x-chappy-guest"], STUB_GUEST_TOKEN, "x-chappy-guest carries the token POST /chappy/guest-token issued");
    assert.equal(h["authorization"], undefined);
    assert.deepEqual(seen[0].body, { message: "what time do you close", locale: "en", channel: "web" });
    const stored = await page.evaluate(() => localStorage.getItem("oh-chappy-guest"));
    assert.equal(stored, h["x-chappy-guest"]);
  });
});

test("raw HTML from the model is shown as text, never rendered", async () => {
  await withPage(iphone15(), async (page, ctx) => {
    await stubChat(ctx, () => ({ body: sse([["text", { delta: '<img src=x onerror="window.__pwned=1"><b>bold</b>' }], ["done", {}]]) }));
    await go(page, `/en${LAB}`);
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor();
    await send(page, "hi");
    const reply = page.locator('[data-chappy-turn="assistant"] [data-chappy-text]').last();
    await reply.waitFor();
    assert.match(await reply.innerText(), /<img src=x/);
    assert.equal(await reply.locator("img, b").count(), 0);
    assert.equal(await page.evaluate(() => (window as any).__pwned), undefined);
  });
});

test("errors are translated: RATE before the stream (es), REFUSAL drops partial text (zh-CN), retry after BUSY", async () => {
  const es = messages("es");
  await withPage({ ...iphone15(), locale: "es" }, async (page, ctx) => {
    await stubChat(ctx, () => ({ status: 429, json: true, body: JSON.stringify({ error: "RATE", retryAfterSeconds: 90 }) }));
    await go(page, `/es${LAB}`);
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor();
    await send(page, "hola");
    const err = page.locator('[data-chappy-error="RATE"]');
    await err.waitFor();
    assert.match(await err.innerText(), /2 minutos/);
    assert.match(await err.innerText(), /Estás enviando mensajes muy rápido/);
  });

  const zh = messages("zh-CN");
  await withPage({ ...iphone15(), locale: "zh-CN" }, async (page, ctx) => {
    await stubChat(ctx, () => ({ body: sse([["text", { delta: "Sure, here is how to" }], ["error", { code: "REFUSAL" }]]) }));
    await go(page, `/zh-CN${LAB}`);
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor();
    await send(page, "something");
    const err = page.locator('[data-chappy-error="REFUSAL"]');
    await err.waitFor();
    assert.equal((await err.innerText()).trim(), zh.errors.REFUSAL);
    assert.doesNotMatch(await page.locator('[data-chappy-turn="assistant"]').last().innerText(), /Sure, here is how/);
  });

  await withPage(iphone15(), async (page, ctx) => {
    let calls = 0;
    await stubChat(ctx, () => {
      calls++;
      return calls === 1 ? { body: sse([["error", { code: "BUSY" }]]) } : { body: sse([["text", { delta: "Back now." }], ["done", {}]]) };
    });
    await go(page, `/en${LAB}`);
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor();
    await send(page, "hello");
    await page.locator('[data-chappy-error="BUSY"]').waitFor();
    await page.getByRole("button", { name: messages("en").retry }).click();
    await page.locator("[data-chappy-text]", { hasText: "Back now." }).waitFor();
    // The finished reply is announced once through the polite live region (not per delta).
    assert.equal(await page.locator("p[aria-live=polite].sr-only").innerText(), "Back now.");
    assert.equal(calls, 2);
    assert.equal(await page.locator('[data-chappy-turn="user"]').count(), 1, "the retried question is not duplicated");
    assert.equal(await page.locator("[data-chappy-error]").count(), 0);
  });
});

test("history restores the conversation once (a stable identity), and Start over clears it", async () => {
  await withPage(iphone15(), async (page, ctx) => {
    let resets = 0;
    const historyCalls: string[] = [];
    await ctx.addInitScript(() => localStorage.setItem("oh-chappy-guest", "stub-guest-token-for-history-test-000000"));
    await ctx.route("**/chappy/history", (route) => {
      historyCalls.push(route.request().headers()["x-chappy-guest"] || "");
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "access-control-allow-origin": new URL(BASE).origin },
        body: JSON.stringify({ messages: [{ role: "user", content: "Is the broth spicy?" }, { role: "assistant", content: "Mild by default." }], isNew: false }),
      });
    });
    await ctx.route("**/chappy/reset", (route) => {
      if (route.request().method() === "POST") resets++;
      return route.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": new URL(BASE).origin }, body: "{}" });
    });
    await go(page, `/en${LAB}`);
    await openFromDock(page);
    await page.locator("text=Mild by default.").waitFor();
    assert.equal(await page.locator("[data-chappy-welcome]").count(), 0);
    await page.locator("[data-chappy-reset]").click();
    await page.locator("[data-chappy-welcome]").waitFor();
    assert.equal(resets, 1);
    // Closing and reopening keeps the (now empty) conversation without refetching it.
    await page.locator("[data-chappy-close]").click();
    await page.locator('[data-dock-item="chappy"]').click();
    await page.locator("[data-chappy-welcome]").waitFor();
    await page.waitForTimeout(1500); // room for any re-render driven refetch to show up
    assert.deepEqual(historyCalls, ["stub-guest-token-for-history-test-000000"], "history is fetched once, with the stored guest token");
  });
});

test("a guest token the API refuses is replaced once, and the message goes through", async () => {
  await withPage(iphone15(), async (page, ctx) => {
    await ctx.addInitScript(() => localStorage.setItem("oh-chappy-guest", "expired-guest-token-000000000000000000"));
    await ctx.route("**/chappy/history", (route) =>
      route.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": new URL(BASE).origin }, body: '{"messages":[],"isNew":true}' }),
    );
    const tokens: string[] = [];
    const seen = await stubChat(ctx, (s) => {
      tokens.push(s.headers["x-chappy-guest"]);
      return s.headers["x-chappy-guest"] === STUB_GUEST_TOKEN
        ? { body: sse([["text", { delta: "Fresh token, fresh start." }], ["done", {}]]) }
        : { status: 401, json: true, body: JSON.stringify({ error: "unidentified" }) };
    });
    await go(page, `/en${LAB}`);
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor();
    await send(page, "hello");
    await page.locator("[data-chappy-text]", { hasText: "Fresh token, fresh start." }).waitFor();
    assert.deepEqual(tokens, ["expired-guest-token-000000000000000000", STUB_GUEST_TOKEN]);
    assert.equal(seen.length, 2);
    assert.equal(await page.evaluate(() => localStorage.getItem("oh-chappy-guest")), STUB_GUEST_TOKEN);
  });
});

test("1440: the desktop nav opens a 420px side panel, and the page stays usable", async () => {
  await withPage({ viewport: { width: 1440, height: 900 } }, async (page) => {
    await go(page, `/en${LAB}`);
    await clickUntil(page, '[data-site-desktop-nav] [data-nav-item="chappy"]', '[data-chappy-surface="panel"]');
    const panel = page.locator('[data-chappy-surface="panel"]');
    await panel.waitFor({ state: "visible" });
    await page.waitForTimeout(500);
    const box = await panel.boundingBox();
    assert.ok(box && Math.round(box.width) === 420, `panel is ${box?.width}px wide`);
    assert.ok(box.x + box.width <= 1440 - 8, "docked to the right edge");
    assert.equal(await panel.getAttribute("aria-modal"), "false");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "chappy-input", "focus moves to the composer");
    assert.equal(await page.locator(".oh-sheet-root").count(), 0, "no phone sheet on desktop");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
  });
});

test("legacy pages: a floating launcher opens the same widget; the old one is gone", async () => {
  await withPage(iphone15(), async (page) => {
    await go(page, "/en/menu");
    const launcher = page.locator("[data-chappy-launcher]");
    await launcher.waitFor({ state: "visible", timeout: 60_000 });
    const b = await launcher.boundingBox();
    assert.ok(b && b.width >= 44 && b.height >= 44);
    assert.equal(await page.locator(".chappy-button, .chappy-panel").count(), 0);
    await clickUntil(page, "[data-chappy-launcher]", "[data-chappy]");
    await page.locator("[data-chappy-welcome]").waitFor({ timeout: 60_000 });
    assert.equal(await page.locator(".legacy-ui [data-chappy]").count(), 0, "the widget is not under the legacy element rules");
    assert.equal(await launcher.count(), 0, "the launcher hides while Chappy is open");
  });
});

test("openChappy(prefill) puts the text in the composer without sending it", async () => {
  await withPage(iphone15(), async (page, ctx) => {
    const seen = await stubChat(ctx, () => ({ body: sse([["done", {}]]) }));
    await go(page, `/en${LAB}`);
    // The dock opens with an empty composer...
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor();
    assert.equal(await page.locator("#chappy-input").inputValue(), "");
    await page.locator("[data-chappy-close]").click();
    // ...a page's "Ask Chappy" link passes a prefill (lab probe: openChappy("Is the broth spicy?")).
    await page.getByTestId("ask-chappy-probe").click();
    await page.locator("[data-chappy-welcome]").waitFor();
    await page.waitForFunction(() => (document.getElementById("chappy-input") as HTMLTextAreaElement | null)?.value === "Is the broth spicy?");
    await page.waitForFunction(() => document.activeElement?.id === "chappy-input");
    assert.equal(seen.length, 0, "nothing is sent until the customer taps send");
  });
});

/* ------------------------------------------------------------------------ */
/* @live: the real model through the lane API. Costs money; E2E_LIVE=1 only. */
/* ------------------------------------------------------------------------ */

test("@live guest on iPhone 15 (zh-TW): 'what time do you close' gets a reply with hours", { skip: !LIVE }, async () => {
  await withPage({ ...iphone15(), locale: "zh-TW" }, async (page) => {
    await go(page, `/zh-TW${LAB}`);
    await openFromDock(page);
    await page.locator("[data-chappy-welcome]").waitFor({ timeout: 30_000 });
    await send(page, "what time do you close");
    const reply = page.locator('[data-chappy-turn="assistant"]').last();
    await page.waitForFunction(() => !document.querySelector('[data-chappy-turn="assistant"][aria-busy="true"]'), null, { timeout: 120_000 });
    const text = await reply.innerText();
    console.log("[live] zh-TW reply:", text);
    assert.equal(await page.locator("[data-chappy-error]").count(), 0, "no error");
    // A clock time: "9 pm", "21:00", "晚上 9 點", "九點". A bare number (a pod count) is not an answer.
    assert.match(text, /\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|\d{1,2}\s*[點点]|[一二三四五六七八九十]+[點点]/i, "the reply names a closing time");
    if (process.env.E2E_SHOT_DIR) await page.screenshot({ path: path.join(process.env.E2E_SHOT_DIR, "e1-390-zh-TW-reply.png") });
  });
});

async function signInAsMember(page: Page, clerkUserId: string) {
  const sk = process.env.CLERK_SECRET_KEY || "";
  assert.ok(sk.startsWith("sk_test_"), "the signed-in live test uses the Clerk DEV instance only");
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 300 }),
  });
  assert.equal(res.status, 200, "Clerk issued a sign-in token");
  const { token } = (await res.json()) as { token: string };
  await page.waitForFunction(() => (window as any).Clerk?.loaded, null, { timeout: 60_000 });
  await page.evaluate(async (ticket) => {
    const clerk = (window as any).Clerk;
    const si = await clerk.client.signIn.create({ strategy: "ticket", ticket });
    await clerk.setActive({ session: si.createdSessionId });
  }, token);
  await page.waitForFunction(() => !!(window as any).Clerk?.user, null, { timeout: 30_000 });
}

test("@live signed-in member: 'order my usual' shows a pay card", { skip: !LIVE || !process.env.E2E_CHAPPY_MEMBER }, async () => {
  await withPage(iphone15(), async (page) => {
    const bearer: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/chappy/chat") && r.method() === "POST") bearer.push(r.headers()["authorization"] || "");
    });
    await go(page, `/en${LAB}`);
    await signInAsMember(page, process.env.E2E_CHAPPY_MEMBER!);
    await openFromDock(page);
    await page.locator("#chappy-input").waitFor();
    await page.waitForFunction(() => !document.querySelector("[data-chappy-messages] [role=status]"), null, { timeout: 30_000 });
    const settle = () => page.waitForFunction(() => !document.querySelector('[data-chappy-turn="assistant"][aria-busy="true"]'), null, { timeout: 150_000 });
    const payCards = () => page.locator('[data-chappy-card="pay"], [data-chappy-card="confirm-zero"]').count();

    // Start from a clean conversation (reset costs no model call).
    if (await page.locator("[data-chappy-reset]").count()) {
      await page.locator("[data-chappy-reset]").click();
      await page.locator("[data-chappy-welcome]").waitFor();
    }

    await send(page, "order my usual");
    await page.locator('[data-chappy-turn="assistant"]').last().waitFor();
    await settle();
    console.log("[live] member turn 1:", await page.locator('[data-chappy-turn="assistant"]').last().innerText());
    if (process.env.E2E_SHOT_DIR) await page.screenshot({ path: path.join(process.env.E2E_SHOT_DIR, "e1-390-en-reply.png") });
    // Chappy confirms the cart, place and total before checkout (B2's confirmation gate):
    // at most two follow-ups, each answering everything it could ask.
    const followUps = ["Yes, exactly that, at the same location as last time, as soon as possible, any pod. Put it through.", "Yes. Put it through now."];
    for (const reply of followUps) {
      if ((await payCards()) > 0) break;
      await send(page, reply);
      await page.waitForTimeout(500);
      await settle();
      console.log("[live] member follow-up:", await page.locator('[data-chappy-turn="assistant"]').last().innerText());
    }
    if (process.env.E2E_SHOT_DIR) await page.screenshot({ path: path.join(process.env.E2E_SHOT_DIR, "e1-390-en-paycard.png") });
    assert.ok(bearer.length >= 1 && bearer.every((h) => /^Bearer .{20,}/.test(h)), "every chat call carries the Clerk bearer");
    assert.equal(await page.locator('[data-chappy-card="pay"], [data-chappy-card="confirm-zero"]').count() >= 1, true, "a pay card appeared");
  });
});
