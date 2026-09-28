/**
 * Task G1: the mobile-first sweep. For every customer route in
 * apps/web/lib/site/routes.ts, in en, zh-TW, zh-CN and es, on the iPhone 15
 * (390x844) and Pixel (412x915) profiles, plus a desktop pass at 1440 in en
 * and zh-TW, it asserts:
 *   - no horizontal overflow (documentElement.scrollWidth <= innerWidth)
 *   - no button, link, dock item, chip, card or heading whose own text
 *     overflows its box (scrollWidth > clientWidth + 1, skipping boxes that
 *     truncate on purpose: text-overflow ellipsis, line clamps, scrollers)
 *   - zero axe violations (WCAG 2.1 A/AA)
 *   - no emoji in the DOM text
 *   - no console errors from the site (third-party noise from Stripe, Clerk,
 *     Google and the browser's own resource errors is listed separately)
 *
 * Runs with node's own test runner and the repo's `playwright` package, one
 * browser, one page at a time (the box has 8 GB):
 *
 *   E2E_BASE_URL=http://localhost:3200 E2E_API_URL=http://localhost:4200 \
 *     node --env-file=.env --test tests/e2e/site/sweep.spec.ts
 *
 * Filters: SWEEP_PROJECTS=iphone15,pixel8,desktop  SWEEP_LOCALES=en,es
 * SWEEP_ROUTES=/menu,/order (exact paths). The projects are the same three
 * named in playwright.config.ts.
 *
 * Signed-in routes (`auth: true`) need CLERK_SECRET_KEY (the development
 * instance, sk_test_): a throwaway `+clerk_test` member is created through
 * the Clerk Backend API and in the lane DB, signed in with a one-time ticket,
 * and removed afterwards. Without the key those routes are skipped.
 *
 * Output: SWEEP_OUT (a JSON file) gets every finding, including the
 * third-party console noise; SWEEP_SHOT_DIR gets a g1-*.png of each failing
 * page.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import { SAMPLE_LOCATION_ID, SITE_ROUTES, routeUrl, type SiteRoute } from "../../../apps/web/lib/site/routes.ts";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3200";
const API = process.env.E2E_API_URL || "http://localhost:4200";
const CLERK_KEY = process.env.CLERK_SECRET_KEY || "";
const SHOT_DIR = process.env.SWEEP_SHOT_DIR || "";
const OUT = process.env.SWEEP_OUT || "";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const requireFromWeb = createRequire(path.resolve(HERE, "../../../apps/web/package.json"));
const AXE_SOURCE = readFileSync(requireFromWeb.resolve("axe-core/axe.min.js"), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

type Ctx = NonNullable<Parameters<Browser["newContext"]>[0]>;
function device(name: string, extra: Ctx = {}): Ctx {
  const { defaultBrowserType: _ignored, ...d } = devices[name];
  return { ...d, ...extra };
}

/** Mirrors the projects in playwright.config.ts. Chromium only (WebKit isn't installed here). */
const PROJECTS: Record<string, { ctx: Ctx; locales: readonly string[] }> = {
  iphone15: { ctx: device("iPhone 15"), locales: ["en", "zh-TW", "zh-CN", "es"] },
  pixel8: { ctx: device("Pixel 7", { viewport: { width: 412, height: 915 }, screen: { width: 412, height: 915 } }), locales: ["en", "zh-TW", "zh-CN", "es"] },
  desktop: { ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, locales: ["en", "zh-TW"] },
};

const list = (v: string | undefined) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);
const onlyProjects = list(process.env.SWEEP_PROJECTS);
const onlyLocales = list(process.env.SWEEP_LOCALES);
const onlyRoutes = list(process.env.SWEEP_ROUTES);

/** Console noise that isn't the site's: listed, never failed. */
const THIRD_PARTY = [
  /stripe/i,
  /clerk/i,
  /googletagmanager|google-analytics|gtag/i,
  /Failed to load resource/i, // the browser's own line; the response is checked by the page itself
  /Download the React DevTools/i,
];

interface Finding {
  project: string;
  locale: string;
  route: string;
  kind: "overflow" | "text-overflow" | "axe" | "emoji" | "console" | "load" | "third-party";
  detail: string;
}
const findings: Finding[] = [];

let browser: Browser;
let sampleLocationId = "SAMPLE";
let clerkUserId = "";
let dbUserId = "";
let prisma: any = null;
const tag = `e2e-g1-${Date.now()}`;
const email = `${tag}+clerk_test@example.com`;

async function clerk(p: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.clerk.com/v1${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${CLERK_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Clerk ${p} ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const canSignIn = CLERK_KEY.startsWith("sk_test_");

before(async () => {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const res = await fetch(`${API}/locations`, { headers: { "x-tenant-slug": "oh" } });
    const body = await res.json();
    const locs = Array.isArray(body) ? body : (body?.locations ?? []);
    sampleLocationId = locs[0]?.id ?? "SAMPLE";
  } catch {
    /* keep SAMPLE */
  }
  if (canSignIn) {
    const { PrismaClient } = await import("../../../packages/db/index.js");
    prisma = new PrismaClient();
    const user = await clerk("/users", {
      method: "POST",
      body: JSON.stringify({ email_address: [email], first_name: "Mei", last_name: "Sweep", skip_password_requirement: true }),
    });
    clerkUserId = user.id;
    const row = await prisma.user.create({
      data: { email: email.toLowerCase(), name: "Mei Sweep", membershipTier: "CHOPSTICK", referralCode: `G1${Date.now().toString(36).toUpperCase()}` },
    });
    dbUserId = row.id;
  }
});

after(async () => {
  await browser?.close();
  if (prisma) {
    if (dbUserId) await prisma.user.delete({ where: { id: dbUserId } }).catch((e: Error) => console.log(`[cleanup] user: ${e.message.split("\n").pop()}`));
    await prisma.$disconnect();
  }
  if (clerkUserId) await clerk(`/users/${clerkUserId}`, { method: "DELETE" }).catch((e) => console.log(`[cleanup] clerk: ${e.message}`));
  if (OUT) writeFileSync(OUT, JSON.stringify(findings, null, 2));
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  console.log(`\nSWEEP_SUMMARY ${JSON.stringify(Object.fromEntries(counts))}`);
});

async function signIn(ctx: BrowserContext, locale: string) {
  const page = await ctx.newPage();
  const { token } = await clerk("/sign_in_tokens", { method: "POST", body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 600 }) });
  await page.goto(`${BASE}/${locale}/rewards`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true, null, { timeout: 60_000 });
  await page.evaluate(async (ticket) => {
    const Clerk = (window as unknown as { Clerk: any }).Clerk;
    const si = await Clerk.client.signIn.create({ strategy: "ticket", ticket });
    await Clerk.setActive({ session: si.createdSessionId });
  }, token);
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user), null, { timeout: 30_000 });
  await page.close();
}

/** Boxes whose own text spills out of them, minus the ones that truncate on purpose. */
async function textOverflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sel = [
      "button",
      "a[href]",
      "[role=button]",
      "[role=tab]",
      "[role=radio]",
      "[data-dock-item]",
      "[data-dock-label]",
      "[class*=chip i]",
      "[class*=card i]",
      "[class*=pill i]",
      "h1",
      "h2",
      "h3",
    ].join(",");
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (el.closest("[aria-hidden=true], [data-clerk-portal], .cl-rootBox, nextjs-portal, .sr-only")) continue;
      if (!el.innerText?.trim() || el.clientWidth === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "contents") continue;
      // Visually hidden (the sr-only pattern: clipped to nothing) is for screen readers, not a box.
      if (/rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip) || cs.clipPath === "inset(50%)") continue;
      if (/(auto|scroll)/.test(cs.overflowX) || cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none") continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      // An overflowing child that is itself a scroller (a rail) is not a text overflow.
      const kids = Array.from(el.querySelectorAll<HTMLElement>("*"));
      if (kids.some((k) => /(auto|scroll)/.test(getComputedStyle(k).overflowX))) continue;
      const tagName = el.tagName.toLowerCase();
      const id = el.getAttribute("data-dock-item") ?? el.getAttribute("aria-label") ?? "";
      out.push(`${tagName}${id ? `[${id}]` : ""} "${el.innerText.trim().replace(/\s+/g, " ").slice(0, 60)}" scroll ${el.scrollWidth} > client ${el.clientWidth}`);
    }
    return out;
  });
}

async function axe(page: Page): Promise<string[]> {
  // Scroll-driven reveals (animation-timeline: view()) never "finish": a section near the fold is
  // mid-fade by design, which axe reads as low contrast. Measure the resting state instead.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(200);
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 10_000 })
    .catch(() => undefined);
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: any }).axe.run(
      { exclude: [["iframe"], ["[data-clerk-portal]"], [".cl-rootBox"], ["nextjs-portal"]] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } },
    );
    return r.violations.map(
      (v: any) =>
        `${v.id}: ${v.nodes
          .slice(0, 3)
          .map((n: any) => `${n.target.join(" ")} [${(n.any?.[0]?.message || n.all?.[0]?.message || "").slice(0, 140)}]`)
          .join(" | ")}`,
    );
  });
}

function slug(p: string) {
  return p.replace(/^\//, "").replace(/[/:]+/g, "-") || "home";
}

async function sweep(projectName: string, ctx: BrowserContext, locale: string, route: SiteRoute) {
  const url = `${BASE}/${locale}${routeUrl(route, (v) => (v === SAMPLE_LOCATION_ID ? sampleLocationId : v))}`;
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  const problems: string[] = [];
  const add = (kind: Finding["kind"], detail: string, fails = true) => {
    findings.push({ project: projectName, locale, route: route.path, kind, detail });
    if (fails) problems.push(`${kind}: ${detail}`);
  };
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (res && res.status() >= 500) add("load", `HTTP ${res.status()}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    if (route.auth) {
      // A signed-in route must render for the member, not bounce to Clerk's sign-in.
      const signedIn = await page.evaluate(() => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user)).catch(() => false);
      if (!signedIn || /sign-in|accounts\.dev/.test(page.url())) add("load", `not signed in on ${page.url()}`);
    }
    // Settle scroll-driven reveals so the whole page is in its resting state.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(300);

    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (sw > iw) add("overflow", `scrollWidth ${sw} > innerWidth ${iw}`);
    for (const t of await textOverflows(page)) add("text-overflow", t);
    const text = await page.evaluate(() => document.body.innerText);
    const emoji = text.match(new RegExp(EMOJI.source, "gu"));
    if (emoji) add("emoji", Array.from(new Set(emoji)).join(" "));
    for (const v of await axe(page)) add("axe", v);
    for (const e of errors) {
      if (THIRD_PARTY.some((re) => re.test(e))) add("third-party", e, false);
      else add("console", e);
    }
    if (problems.length && SHOT_DIR) {
      await page.screenshot({ path: path.join(SHOT_DIR, `g1-${slug(route.path)}-${projectName}-${locale}.png`) }).catch(() => undefined);
    }
  } finally {
    await page.close();
  }
  assert.deepEqual(problems, [], `${projectName} ${locale} ${route.path}`);
}

for (const [projectName, project] of Object.entries(PROJECTS)) {
  if (onlyProjects && !onlyProjects.includes(projectName)) continue;
  for (const locale of project.locales) {
    if (onlyLocales && !onlyLocales.includes(locale)) continue;
    let anon: BrowserContext | null = null;
    let member: BrowserContext | null = null;
    const anonCtx = async () => (anon ??= await browser.newContext(project.ctx));
    const memberCtx = async () => {
      if (!member) {
        member = await browser.newContext(project.ctx);
        await signIn(member, locale);
      }
      return member;
    };
    for (const route of SITE_ROUTES) {
      if (route.internal) continue;
      if (onlyRoutes && !onlyRoutes.includes(route.path)) continue;
      const name = `${projectName} ${locale} ${route.path}`;
      if (route.auth && !canSignIn) {
        test(name, { skip: "needs CLERK_SECRET_KEY (sk_test_) to sign in" }, () => {});
        continue;
      }
      test(name, async () => sweep(projectName, route.auth ? await memberCtx() : await anonCtx(), locale, route));
    }
    test(`${projectName} ${locale} close contexts`, async () => {
      await (anon as BrowserContext | null)?.close();
      await (member as BrowserContext | null)?.close();
      anon = member = null;
    });
  }
}
