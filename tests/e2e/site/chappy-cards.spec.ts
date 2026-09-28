/**
 * Chappy's native cards e2e (Task E2), against the lane's web and API:
 *
 *   E2E_BASE_URL=http://localhost:3100 node --env-file=.env --test tests/e2e/site/chappy-cards.spec.ts
 *
 * - Every card type, streamed from a stubbed /chappy/chat, renders natively at
 *   390 in en and zh-TW with no horizontal overflow (E2E_SHOT_DIR saves the
 *   e2-*.png screenshots).
 * - The human-tap pay card, for real: a signed-in member's order and its
 *   PaymentIntent are created through the lane API, the pay card for it
 *   streams in, the Stripe test card is typed into the Payment Element and
 *   the member taps Pay. The order reaches PAID (read back from the API), the
 *   system note and the order-status card appear. A second run uses the 3D
 *   Secure test card and completes Stripe's challenge.
 * - @live (E2E_LIVE=1): the whole thing through the real model, at most 6
 *   model turns: "order my usual" to PAID through the pay card, then "my bowl
 *   was cold" gives a support case with at most $5 of STORE credit and no
 *   card refund.
 *
 * The signed-in tests need the Clerk DEV secret (CLERK_SECRET_KEY=sk_test_),
 * E2E_CHAPPY_MEMBER (a Clerk dev user id whose email is a member in the lane
 * DB) and the lane's Stripe TEST keys.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Frame, type Page } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3100";
const API = process.env.E2E_API_URL || "http://localhost:4100";
const LIVE = process.env.E2E_LIVE === "1";
const MEMBER = process.env.E2E_CHAPPY_MEMBER || "";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const LAB = "/lab/shell";
const CAN_SIGN_IN = (process.env.CLERK_SECRET_KEY || "").startsWith("sk_test_") && !!MEMBER;
const STRIPE_SK = process.env.STRIPE_SECRET_KEY || "";
const CONTINUE = process.env.E2E_LIVE_CONTINUE === "1";
/** Live model turns this run may use (the task's budget is 6 in total). */
const TURN_CAP = Math.min(6, Number(process.env.E2E_LIVE_TURNS) || 6);

const messages = (locale: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), `apps/web/messages/${locale}.json`), "utf8")).chappyWeb;

let browser: Browser;
before(async () => {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});
after(async () => {
  await browser?.close();
});

function iphone15(): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return d;
}

async function withPage<T>(opts: Parameters<Browser["newContext"]>[0], fn: (page: Page, ctx: BrowserContext) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext(opts);
  try {
    return await fn(await ctx.newPage(), ctx);
  } finally {
    await ctx.close();
  }
}

async function go(page: Page, p: string) {
  await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 180_000 });
}

async function openFromDock(page: Page) {
  const item = page.locator('[data-dock-item="chappy"]');
  await item.waitFor({ state: "visible", timeout: 60_000 });
  for (let i = 0; i < 4; i++) {
    if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
    try {
      await page.locator("[data-chappy]").waitFor({ state: "visible", timeout: i < 3 ? 8_000 : 60_000 });
      return;
    } catch (e) {
      if (i === 3) throw e;
    }
  }
}

const sse = (events: Array<[string, unknown]>) => ": chappy\n\n" + events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

/** Stubs the chat (and the guest token) with a fixed stream; the history is empty. */
async function stubChat(ctx: BrowserContext, events: () => Array<[string, unknown]>) {
  const origin = new URL(BASE).origin;
  const cors = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" };
  await ctx.route("**/chappy/guest-token", (route) => route.fulfill({ status: 200, headers: { "content-type": "application/json", ...cors }, body: JSON.stringify({ token: "stub-guest-token.0123456789abcdef0123456789abcdef" }) }));
  await ctx.route("**/chappy/history", (route) =>
    route.request().method() === "OPTIONS" ? route.continue() : route.fulfill({ status: 200, headers: { "content-type": "application/json", ...cors }, body: JSON.stringify({ messages: [] }) }),
  );
  await ctx.route("**/chappy/chat", (route) =>
    route.request().method() === "OPTIONS" ? route.continue() : route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", ...cors }, body: sse(events()) }),
  );
}

async function send(page: Page, text: string) {
  const box = page.locator("#chappy-input");
  await box.fill(text);
  await box.press("Enter");
}

async function shot(page: Page, name: string, locator?: string) {
  if (!SHOTS) return;
  if (locator) await page.locator(locator).first().screenshot({ path: path.join(SHOTS, name) });
  else await page.screenshot({ path: path.join(SHOTS, name) });
}

async function noOverflow(page: Page) {
  const over = await page.evaluate(() => {
    const scroller = document.querySelector("[data-chappy-messages]") as HTMLElement | null;
    return { doc: document.documentElement.scrollWidth - window.innerWidth, list: scroller ? scroller.scrollWidth - scroller.clientWidth : 0 };
  });
  assert.ok(over.doc <= 0 && over.list <= 0, `horizontal overflow: ${JSON.stringify(over)}`);
}

/** A test-mode PaymentIntent straight from Stripe, for the screenshot of the Payment Element (never paid). */
async function testPaymentIntent(amount: number): Promise<string | null> {
  if (!STRIPE_SK.startsWith("sk_test_")) return null;
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SK}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ amount: String(amount), currency: "usd", "automatic_payment_methods[enabled]": "true", "metadata[purpose]": "e2e-screenshot" }).toString(),
  });
  if (!res.ok) return null;
  return (await res.json()).client_secret as string;
}

const CART = {
  type: "cart",
  lines: [
    { menuItemId: "classic", name: "Classic Beef Noodle Soup", imageKey: "Classic Beef Noodle Soup", quantity: 1, value: null, priceCents: 1599 },
    { menuItemId: "wide", name: "Wide Noodles", imageKey: "Wide Noodles", quantity: 1, value: null, priceCents: 0 },
    { menuItemId: "bokchoy", name: "Baby Bok Choy", imageKey: "Baby Bok Choy", quantity: 2, value: "Extra", priceCents: 250 },
    { menuItemId: "egg", name: "Soft-Boiled Egg", imageKey: "Soft-Boiled Egg", quantity: 1, value: null, priceCents: 199 },
  ],
  subtotalCents: 2048,
  savingsCents: 0,
  taxCents: 173,
  totalCents: 2221,
  creditCents: 500,
  amountDueCents: 1721,
  location: "University Place",
  arrival: "18:30",
  pod: "B-07",
  podBest: false,
  partySize: 1,
};
const CART_ZH = {
  ...CART,
  lines: CART.lines.map((l, i) => ({ ...l, name: ["經典牛肉麵", "寬麵", "青江菜", "溏心蛋"][i], value: l.value ? "多" : null })),
  location: "大學廣場",
};

function sampleCards(locale: string, clientSecret: string | null) {
  const zh = locale.startsWith("zh");
  return {
    cart: zh ? CART_ZH : CART,
    "menu-item": {
      type: "menu-item",
      id: "classic",
      name: zh ? "經典牛肉麵" : "Classic Beef Noodle Soup",
      description: zh ? "兩段式牛骨高湯，慢燉牛腱，手工麵條。" : "A two-stage beef bone broth, slow-braised shank and hand-cut noodles.",
      priceCents: 1599,
      imageKey: "Classic Beef Noodle Soup",
      categoryType: "MAIN",
      dietary: [],
      spiceLevel: 1,
    },
    pay: clientSecret ? { type: "pay", orderId: "o-shot", clientSecret, amountDueCents: 1721, currency: "usd", kitchenNumber: "0012", pod: "B-07" } : null,
    "confirm-zero": { type: "confirm-zero", orderId: "o-shot", kitchenNumber: "0013", pod: "C-25" },
    "order-status": { type: "order-status", orderId: "o-shot", kitchenNumber: "0012", status: "PREPPING", paid: true, stage: "PREPPING", pod: "B-07", totalCents: 2221, statusPath: `/${locale}/order/status?orderQrCode=DEMO` },
    reward: { type: "reward", tier: "NOODLE_MASTER", cashbackPct: 2, creditCents: 1250, expiringCents: 500, next: "BEEF_BOSS", orders: { have: 14, need: 25 }, referrals: { have: 3, need: 5 }, rewards: 1 },
    "pod-call": { type: "pod-call", pod: "B-07" },
    "support-case": { type: "support-case", caseId: "cmukv0000000000000004821", kind: "issue", goodwillCents: 500 },
    "group-share": { type: "group-share", code: "7KQ2M9", url: `${BASE}/${locale}/group/7KQ2M9` },
    "sign-in": { type: "sign-in" },
  } as Record<string, Record<string, unknown> | null>;
}

for (const locale of ["en", "zh-TW"]) {
  test(`every card renders natively at 390 (${locale}), labeled, translated, no overflow`, async () => {
    const m = messages(locale);
    const secret = await testPaymentIntent(1721);
    const cards = sampleCards(locale, secret);
    await withPage({ ...iphone15(), locale }, async (page, ctx) => {
      const say = locale === "en" ? "Here is everything so far." : "目前的內容都在這裡。";
      await stubChat(ctx, () => [["text", { delta: say }], ...Object.values(cards).filter(Boolean).map((c) => ["card", { card: c }] as [string, unknown]), ["done", {}]]);
      await go(page, `/${locale}${LAB}`);
      await openFromDock(page);
      await page.locator("[data-chappy-welcome]").waitFor({ timeout: 30_000 });
      await send(page, locale === "en" ? "show me the cards" : "給我看卡片");
      await page.locator('[data-chappy-card="group-share"]').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600); // the entrance animation

      for (const [type, card] of Object.entries(cards)) {
        if (!card) continue;
        const el = page.locator(`[data-chappy-card="${type}"]`).first();
        await el.waitFor();
        const label = await el.getAttribute("aria-label");
        assert.ok(label && label.length > 1, `${type} has an aria-label`);
        if (locale !== "en") {
          const text = (await el.innerText()).replace(/Chappy|Stripe|Apple Pay|Google Pay|Oh!|[A-C]-\d{2}/g, "");
          assert.doesNotMatch(text, /[A-Za-z]{3,}/, `${type}: no English in zh-TW`);
          assert.doesNotMatch(label!, /[A-Za-z]{3,}/, `${type}: aria-label translated`);
        }
      }
      // Native, not E1's fallback box.
      assert.equal(await page.locator('[data-chappy-card="cart"] li').count() >= 4, true);
      assert.match(await page.locator('[data-chappy-card="support-case"]').innerText(), new RegExp(m.cards.supportCase.creditTitle.replace("{amount}", "\\$5\\.00")));
      await noOverflow(page);

      if (cards.pay) {
        // The Payment Element's frame mounts inside the card.
        await page.locator('[data-chappy-card="pay"] iframe').first().waitFor({ state: "attached", timeout: 60_000 });
        await page.waitForFunction(() => !document.querySelector('[data-chappy-card="pay"] [role="status"]'), null, { timeout: 60_000 });
        await page.waitForTimeout(800);
      }
      // One in-context shot first: the conversation with the pay card in the 390x844 sheet.
      if (cards.pay) {
        await page.locator('[data-chappy-card="pay"]').evaluate((el) => el.scrollIntoView({ block: "start" }));
        await page.waitForTimeout(300);
        await shot(page, `e2-390-${locale}-sheet-pay.png`);
      }
      // Per-card shots: still 390 wide, but tall enough that no card is cut off by the scroller.
      await page.setViewportSize({ width: 390, height: 1900 });
      await page.waitForTimeout(400);
      for (const [type, card] of Object.entries(cards)) {
        if (!card) continue;
        await page.locator(`[data-chappy-card="${type}"]`).first().scrollIntoViewIfNeeded();
        await shot(page, `e2-390-${locale}-${type}.png`, `[data-chappy-card="${type}"]`);
      }
    });
  });
}

/* ------------------------------------------------------------------------ */
/* The pay card, for real (Stripe test mode, the lane API and DB).          */
/* ------------------------------------------------------------------------ */

async function signInAsMember(page: Page) {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: MEMBER, expires_in_seconds: 300 }),
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

/** As the signed-in member (their Clerk token, from the page): calls the lane API. */
async function memberApi(page: Page, pathname: string, method = "GET", body?: unknown): Promise<{ status: number; json: any }> {
  return page.evaluate(
    async ({ api, pathname, method, body }) => {
      const token = await (window as any).Clerk.session.getToken();
      const res = await fetch(api + pathname, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { api: API, pathname, method, body },
  );
}

/** A real unpaid order for the member (Classic bowl at University Place) and its PaymentIntent: what Chappy's checkout makes. */
async function placeUnpaidOrder(page: Page) {
  const locations = (await (await fetch(`${API}/locations`)).json()) as any[];
  const location = locations.find((l) => l.name === "University Place" && !l.isClosed) || locations.find((l) => !l.isClosed && l.podCount);
  const menu = (await (await fetch(`${API}/menu?tenantSlug=oh`)).json()) as any[];
  const id = (name: string) => menu.find((m) => m.name === name)?.id;
  const items = [
    { menuItemId: id("Classic Beef Noodle Soup"), quantity: 1 },
    { menuItemId: id("Wide Noodles"), quantity: 1 },
  ];
  const created = await memberApi(page, "/orders", "POST", { locationId: location.id, tenantId: location.tenantId, items, seat: { best: true }, partySize: 1 });
  assert.equal(created.status, 200, `order created: ${JSON.stringify(created.json)}`);
  const order = created.json;
  const pi = await memberApi(page, `/orders/${order.id}/payment-intent`, "POST", {});
  assert.equal(pi.status, 200, `payment intent: ${JSON.stringify(pi.json)}`);
  assert.ok(pi.json.clientSecret, "a PaymentIntent to pay");
  return { order, clientSecret: pi.json.clientSecret as string, amountDueCents: pi.json.amountDueCents as number };
}

/** The Payment Element's frame: the Stripe frame in the pay card that has the card number field (not Express Checkout's). */
async function paymentFrame(page: Page): Promise<Frame> {
  await page.locator('[data-chappy-card="pay"] iframe').first().waitFor({ state: "attached", timeout: 60_000 });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const handle of await page.locator('[data-chappy-card="pay"] iframe').elementHandles()) {
      const frame = await handle.contentFrame();
      if (frame && (await frame.locator('input[name="number"]').count().catch(() => 0))) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("the Payment Element's card field never appeared");
}

async function typeCard(page: Page, number: string) {
  const f = await paymentFrame(page);
  await f.locator('input[name="number"]').fill(number);
  await f.locator('input[name="expiry"]').fill("12 / 34");
  await f.locator('input[name="cvc"]').fill("123");
  const zip = f.locator('input[name="postalCode"]');
  if (await zip.count()) await zip.fill("84097");
}

/** Stripe's test 3D Secure challenge: nested frames; press Complete. */
async function complete3ds(page: Page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const btn = frame.locator("#test-source-authorize-3ds, button:has-text('Complete'), button:has-text('COMPLETE')");
      if (await btn.count().catch(() => 0)) {
        await btn.first().click();
        return;
      }
    }
    await page.waitForTimeout(500);
  }
  assert.fail("the 3D Secure challenge never showed");
}

async function payThroughCard(label: string, card: string, threeDs: boolean) {
  await withPage(iphone15(), async (page, ctx) => {
    await go(page, `/en${LAB}`);
    await signInAsMember(page);
    const { order, clientSecret, amountDueCents } = await placeUnpaidOrder(page);
    const payCard = { type: "pay", orderId: order.id, clientSecret, amountDueCents, currency: "usd", kitchenNumber: order.kitchenOrderNumber, pod: order.seat?.label ?? null };
    await stubChat(ctx, () => [["tool_start", { name: "checkout" }], ["text", { delta: "Here's your pay card. Nothing is charged until you tap Pay." }], ["card", { card: payCard }], ["done", {}]]);
    await openFromDock(page);
    await page.locator("#chappy-input").waitFor();
    await send(page, "put it through");
    await page.locator('[data-chappy-card="pay"]').waitFor({ timeout: 30_000 });

    // Nothing is paid by showing the card.
    assert.equal((await memberApi(page, `/orders/${order.id}`)).json.paymentStatus, "PENDING");

    await typeCard(page, card);
    if (SHOTS && !threeDs) await shot(page, "e2-390-en-pay-filled.png", '[data-chappy-card="pay"]');
    await page.locator("[data-pay-submit]").click();
    // A second tap while it pays does nothing (the button is locked).
    await page.locator("[data-pay-submit]").click({ timeout: 1_000 }).catch(() => {});
    if (threeDs) {
      await complete3ds(page);
    }
    const note = page.locator('[data-chappy-turn="note"]');
    await note.waitFor({ timeout: 90_000 });
    const noteText = await note.innerText();
    console.log(`[${label}] note:`, noteText);
    assert.match(noteText, /^Paid\. Order #/);
    await page.locator('[data-chappy-turn="note"] [data-chappy-card="order-status"]').waitFor();
    if (SHOTS) await shot(page, threeDs ? "e2-390-en-paid-3ds.png" : "e2-390-en-paid.png");

    const after = await memberApi(page, `/orders/${order.id}`);
    assert.equal(after.json.paymentStatus, "PAID", "the API verified the payment");
    assert.equal(await page.locator('[data-chappy-turn="note"]').count(), 1, "one note, one confirm");
  });
}

test("signed-in member pays through the PayCard with the Stripe test card: the order is PAID", { skip: !CAN_SIGN_IN }, async () => {
  await payThroughCard("4242", "4242424242424242", false);
});

test("3D Secure: the challenge completes in the page and the order is PAID", { skip: !CAN_SIGN_IN }, async () => {
  await payThroughCard("3ds", "4000002760003184", true);
});

test("a Stripe redirect return reopens Chappy, is verified by the API, and cleans the address bar", { skip: !CAN_SIGN_IN || !STRIPE_SK.startsWith("sk_test_") }, async () => {
  await withPage(iphone15(), async (page) => {
    await go(page, `/en${LAB}`);
    await signInAsMember(page);
    const { order, clientSecret } = await placeUnpaidOrder(page);
    const pi = clientSecret.split("_secret_")[0];

    // A failed redirect first: Chappy says so and offers the same pay card again; nothing is paid.
    await go(page, `/en${LAB}?chappyPay=${order.id}&payment_intent=${pi}&payment_intent_client_secret=${clientSecret}&redirect_status=failed`);
    await page.locator('[data-chappy-turn="note"]').waitFor({ timeout: 60_000 });
    assert.match(await page.locator('[data-chappy-turn="note"]').innerText(), new RegExp(messages("en").cards.pay.returnFailed.slice(0, 20)));
    await page.locator('[data-chappy-turn="note"] [data-chappy-card="pay"]').waitFor();
    assert.equal(new URL(page.url()).search, "", "the return parameters are gone from the address bar");
    assert.equal((await memberApi(page, `/orders/${order.id}`)).json.paymentStatus, "PENDING");

    // What the bank's page would have done: the PaymentIntent succeeds off the page (test harness, Stripe test mode).
    const confirm = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}/confirm`, {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE_SK}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ payment_method: "pm_card_visa", return_url: `${BASE}/en${LAB}` }).toString(),
    });
    assert.equal((await confirm.json()).status, "succeeded");

    await go(page, `/en${LAB}?chappyPay=${order.id}&payment_intent=${pi}&payment_intent_client_secret=${clientSecret}&redirect_status=succeeded`);
    const paid = page.locator('[data-chappy-turn="note"]').filter({ hasText: /^Paid\./ });
    await paid.waitFor({ timeout: 60_000 });
    await page.locator('[data-chappy-turn="note"] [data-chappy-card="order-status"]').waitFor();
    assert.equal(new URL(page.url()).search, "");
    assert.equal((await memberApi(page, `/orders/${order.id}`)).json.paymentStatus, "PAID");
    if (SHOTS) await shot(page, "e2-390-en-redirect-return.png");
  });
});

/* ------------------------------------------------------------------------ */
/* @live: the real model. At most 6 model turns in total.                   */
/* ------------------------------------------------------------------------ */

test("@live chat order to PAID through the pay card, then 'my bowl was cold' gives store credit only", { skip: !LIVE || !CAN_SIGN_IN }, async () => {
  let turns = 0;
  await withPage(iphone15(), async (page) => {
    await go(page, `/en${LAB}`);
    await signInAsMember(page);
    await openFromDock(page);
    await page.locator("#chappy-input").waitFor();
    await page.waitForFunction(() => !document.querySelector("[data-chappy-messages] [role=status]"), null, { timeout: 30_000 });
    // E2E_LIVE_CONTINUE=1 picks up the member's conversation where an earlier
    // run stopped (the cart is kept on the server), so an overloaded or
    // interrupted run doesn't spend the turns again.
    if (!CONTINUE && (await page.locator("[data-chappy-reset]").count())) {
      await page.locator("[data-chappy-reset]").click(); // no model call
      await page.locator("[data-chappy-welcome]").waitFor();
    }
    const settle = () => page.waitForFunction(() => !document.querySelector('[data-chappy-turn="assistant"][aria-busy="true"]'), null, { timeout: 150_000 });
    const ask = async (text: string) => {
      assert.ok(turns < TURN_CAP, `at most ${TURN_CAP} live turns`);
      turns++;
      await send(page, text);
      await page.waitForTimeout(400);
      await settle();
      const reply = await page.locator('[data-chappy-turn="assistant"]').last().innerText();
      console.log(`[live ${turns}] ${text} ->`, reply.replace(/\s+/g, " ").slice(0, 400));
      return reply;
    };
    const payCards = () => page.locator('[data-chappy-card="pay"]').count();

    await ask(CONTINUE ? "Confirmed, that cart and total. Put it through." : "One more of my usual at University Place, as soon as possible, any pod. Show me the total.");
    for (const followUp of ["Yes, that's right. Put it through.", "Yes. Put it through now."]) {
      if ((await payCards()) > 0) break;
      await ask(followUp);
    }
    assert.ok((await payCards()) > 0, "a pay card appeared");
    if (SHOTS) await shot(page, "e2-390-en-live-paycard.png");

    await typeCard(page, "4242424242424242");
    await page.locator('[data-chappy-card="pay"] [data-pay-submit]').last().click();
    await page.locator('[data-chappy-turn="note"]').waitFor({ timeout: 90_000 });
    console.log("[live] note:", await page.locator('[data-chappy-turn="note"]').innerText());
    const status = page.locator('[data-chappy-turn="note"] [data-chappy-card="order-status"]');
    await status.waitFor();
    if (SHOTS) await shot(page, "e2-390-en-live-paid.png");

    // The support case, on the order just paid (it is recent). Name it by its pod:
    // with several orders today, Chappy asks which one (live run 2 spent its
    // last turn on exactly that question).
    const podLabel = (await page.locator('[data-chappy-turn="note"] p').first().innerText()).match(/[A-C]-\d{2}/)?.[0] ?? "";
    await ask(`My bowl was cold on the order I just paid${podLabel ? ` (pod ${podLabel})` : ""}. Please open a case.`);
    let caseCard = page.locator('[data-chappy-card="support-case"]');
    if (!(await caseCard.count())) {
      await ask("Yes, please open a case for that order. It was cold when it arrived.");
      caseCard = page.locator('[data-chappy-card="support-case"]');
    }
    assert.ok(await caseCard.count(), "a support case card");
    const credit = await caseCard.last().getAttribute("data-goodwill-cents").catch(() => null);
    const text = await caseCard.last().innerText();
    console.log("[live] case:", text.replace(/\s+/g, " "), "credit:", credit);
    if (credit) assert.ok(Number(credit) > 0 && Number(credit) <= 500, "goodwill at most $5");
    assert.doesNotMatch(text, /refund/i, "store credit, never a card refund");
    if (SHOTS) await shot(page, "e2-390-en-live-support.png");
    console.log(`[live] model turns used: ${turns}`);
  });
});
