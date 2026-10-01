/**
 * Private event flow e2e: invite -> guest step -> bowl -> done -> status
 * (check-in, kitchen stages) -> zh-TW pass -> admin host tabs.
 *
 *   E2E_BASE_URL=http://localhost:3000 E2E_API_URL=http://localhost:4000 \
 *   E2E_ADMIN_URL=http://localhost:3001 E2E_SHOT_DIR=<dir> \
 *     node --env-file=.env --test tests/e2e/site/events.spec.ts
 *
 * Seeds one event (price 0, LIVE, today 23:59 Denver so check-in is open) and
 * one guest through the open dev admin API; deletes the event afterwards.
 * Never calls a send endpoint (dev SMS is live).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const API = process.env.E2E_API_URL || "http://localhost:4000";
const ADMIN = process.env.E2E_ADMIN_URL || "http://localhost:3001";
const SHOTS = process.env.E2E_SHOT_DIR || "";
const GUEST = { name: "Tessa Rowan", phone: "8015550199" };
const EMOJI = /\p{Extended_Pictographic}/u;

let browser: Browser | undefined;
let eventId = "";

function iphone15(): Parameters<Browser["newContext"]>[0] {
  const { defaultBrowserType: _ignored, ...d } = devices["iPhone 15"];
  return d;
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

async function noHScroll(page: Page, label: string) {
  const [w, sw] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
  assert.ok(sw <= w, `${label}: horizontal scroll (scrollWidth ${sw} > innerWidth ${w})`);
}

async function shot(page: Page, name: string, fullPage = true) {
  await noHScroll(page, name);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
}

async function api<T = any>(method: string, p: string, body?: unknown): Promise<T> {
  const res = await fetch(API + p, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  assert.ok(res.ok, `${method} ${p} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : (null as T);
}

/** Today's date in America/Denver at 23:59 (October is MDT, UTC-6; handles MST too). */
function tonightDenver(): string {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "short" }).format(now).includes("MDT") ? "-06:00" : "-07:00";
  return `${ymd}T23:59:00${off}`;
}

async function waitText(page: Page, re: RegExp, timeout: number) {
  await page.getByText(re).first().waitFor({ state: "visible", timeout });
}

async function waitForMemory() {
  for (let i = 0; i < 10; i++) {
    const free = Number((await import("node:child_process")).execSync("free -m | awk '/Mem:/{print $7}'").toString().trim());
    if (free >= 900) return;
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

after(async () => {
  await browser?.close().catch(() => {});
  if (eventId) await fetch(`${API}/admin/catering/events/${eventId}`, { method: "DELETE" }).catch((e) => console.log("[cleanup]", e.message));
  console.log(`E2E_CLEANED ${eventId}`);
});

test("private event: invite to kitchen status, zh-TW, admin host tabs", { timeout: 600_000 }, async () => {
  // 1. Setup via the API.
  const stamp = Date.now();
  const company = `E2E Table ${stamp}`;
  const eventDate = tonightDenver();
  const ev = await api("POST", "/admin/catering/events", {
    clientCompany: company,
    eventName: "Supper Night",
    eventDate,
    slot: "DINNER",
    pricePerBowlCents: 0,
    minimumBowls: 6,
    hostName: "Dano and Kristy",
    welcomeNote: "Come hungry. The broth has been going since morning.",
    eventAddress: "1 Main Street, Salt Lake City, UT",
  });
  eventId = ev.id;
  await api("PATCH", `/admin/catering/events/${eventId}`, { status: "LIVE", eventDate });
  await api("POST", `/admin/catering/events/${eventId}/rsvps`, GUEST);
  const rsvps = await api<any[]>("GET", `/admin/catering/events/${eventId}/rsvps`);
  const row = rsvps.find((r) => r.phone === GUEST.phone || r.name === GUEST.name);
  assert.ok(row?.inviteUrl, "rsvp row has an inviteUrl");
  const invite = new URL(row.inviteUrl);
  const inviteUrl = `${BASE}${invite.pathname}${invite.search}`;
  const slug = ev.slug as string;
  const first = GUEST.name.split(" ")[0];
  assert.match(inviteUrl, /\?rsvp=/);
  // A phone that normalizes to fewer than 10 digits never reaches the order lookup.
  const badCheck = await fetch(`${API}/catering/events/${encodeURIComponent(slug)}/order/check?phone=-`);
  assert.equal(badCheck.status, 400, "order/check?phone=- is rejected");

  await waitForMemory();
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx: BrowserContext = await browser.newContext(iphone15());
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  await hideDevBadge(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 2. Invite.
  await page.goto(inviteUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText(new RegExp(`${first}, your seat is saved`)).waitFor();
  const cta = page.getByRole("link", { name: "Reserve my bowl" });
  await cta.waitFor();
  await page.waitForTimeout(1200);
  await shot(page, "events-invite-390");

  // 3. Guest step.
  await cta.click();
  await page.waitForURL(/\/rsvp/);
  await page.locator("#guest-form").waitFor();
  assert.equal(await page.locator("#guest-name").inputValue(), GUEST.name);
  assert.equal((await page.locator("#guest-phone").inputValue()).replace(/\D/g, "").slice(-10), GUEST.phone);
  await page.locator("#guest-dob-month").fill("03");
  await page.locator("#guest-dob-day").fill("14");
  await page.locator("#guest-dob-year").fill("1990");
  await shot(page, "events-guest-390");
  await page.locator("#guest-form button[type=submit], button[form=guest-form]").first().click();

  // 4. Bowl.
  await page.waitForURL(/\/order$/);
  await page.locator('[role="radio"]').first().waitFor();
  const reserve = page.getByRole("button", { name: "Reserve this bowl" });
  await reserve.waitFor();
  await page.waitForFunction(() => !(document.querySelector('button[disabled]') && [...document.querySelectorAll("button")].some((b) => /Reserve this bowl/.test(b.textContent || "") && b.disabled)));
  assert.ok(await reserve.isEnabled(), "Reserve this bowl is enabled");
  assert.ok(!(await page.locator("body").innerText()).includes("$"), "no price on the bowl step");
  await shot(page, "events-bowl-390");
  await reserve.click();

  // 5. Done.
  await page.waitForURL(/\/done$/);
  await page.getByRole("heading", { name: new RegExp(first) }).first().waitFor();
  assert.ok(!(await page.locator("body").innerText()).includes("$"), "no price on the done page");
  await page.waitForTimeout(1200);
  await shot(page, "events-done-390");
  await page.getByRole("link", { name: "Follow my bowl" }).click();

  // 6. Status: held, then check in.
  await page.waitForURL(/\/status/);
  const arrive = page.getByTestId("arrive");
  await arrive.waitFor();
  await page.waitForFunction(() => !(document.querySelector('[data-testid="arrive"]') as HTMLButtonElement | null)?.disabled, null, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  await shot(page, "events-status-held-390");
  await arrive.click();
  await waitText(page, /You are checked in/, 60_000);
  await page.waitForTimeout(1200);
  await shot(page, "events-status-queued-390");

  // 7. Kitchen advances; the page follows within 15 s each.
  const orders = await api<any[]>("GET", `/admin/catering/events/${eventId}/orders`);
  const order = orders.find((o) => o.guestName === GUEST.name) || orders[0];
  assert.ok(order?.id, "event has an order");
  await api("PATCH", `/kitchen/orders/${order.id}/status`, { status: "PREPPING" });
  await waitText(page, /Cooking now/, 15_000);
  await api("PATCH", `/kitchen/orders/${order.id}/status`, { status: "READY" });
  await waitText(page, /Almost there/, 15_000);
  await page.waitForTimeout(1200);
  await shot(page, "events-status-ready-390");
  const body = await page.locator("body").innerText();
  assert.ok(!EMOJI.test(body), "no emoji on the status page");
  assert.ok(!body.includes("$"), "no price on the status page");

  // 8. zh-TW invite has no English leak.
  await page.goto(`${BASE}/zh-TW/e/${slug}?${invite.search.slice(1)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText(/預留|邀請/).first().waitFor();
  await page.waitForTimeout(1200);
  const zh = await page.locator("body").innerText();
  for (const w of ["Reserve", "Hosted", "Until"]) assert.ok(!zh.includes(w), `zh-TW invite leaks "${w}"`);
  await shot(page, "events-invite-zh-TW-390");
  await ctx.close();

  // 9. Admin host tabs at 390 and 1440.
  for (const width of [390, 1440]) {
    const actx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
    const ap = await actx.newPage();
    ap.setDefaultTimeout(60_000);
    await hideDevBadge(ap);
    await ap.goto(`${ADMIN}/catering/${eventId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const tab = async (name: string) => {
      await ap.getByRole("group", { name: "Section" }).getByRole("button", { name, exact: true }).click();
    };
    await tab("Guests");
    await ap.locator(`text=${GUEST.name} >> visible=true`).first().waitFor();
    await ap.waitForTimeout(800);
    await shot(ap, `events-admin-guests-${width}`);
    await tab("Messages");
    await ap.locator(`text=${GUEST.name} >> visible=true`).first().waitFor();
    await ap.waitForTimeout(800);
    await shot(ap, `events-admin-messages-${width}`);
    await tab("Cook");
    await ap.locator(`text=${GUEST.name} >> visible=true`).first().waitFor();
    await ap.waitForTimeout(800);
    await shot(ap, `events-admin-cook-${width}`);
    await actx.close();
  }

  assert.deepEqual(errors, [], "no uncaught page errors on the guest pages");
});
