/**
 * English-leak crawl (Task C5). For every customer route in
 * apps/web/lib/site/routes.ts, in zh-TW and zh-CN, on the iPhone 15
 * profile: collect the page's visible text plus every alt, aria-label and
 * placeholder, remove the allowlist (apps/web/lib/site/i18n-allowlist.ts),
 * digits and currency, and flag any Latin word of 3+ letters.
 *
 *   E2E_BASE_URL=http://localhost:3200 E2E_API_URL=http://localhost:4200 \
 *     node --test tests/e2e/site/english-leak.spec.ts
 *
 * NOT BLOCKING UNTIL F1 (the LEAK_STRICT gate): by default every route test
 * is a node:test `todo`, so leaks are reported (route, locale, words and
 * the lines they came from) but the run exits 0. With LEAK_STRICT=1 they
 * are ordinary tests and any leak fails the run. F1 turns strict on.
 *
 * Skipped: routes that need a signed-in member (a signed-out crawl lands on
 * Clerk's hosted page) and internal pages; both are listed in the summary.
 * Read-only: no API writes.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { chromium, devices, type Browser } from "playwright";
import { SAMPLE_LOCATION_ID, SITE_ROUTES, routeUrl } from "../../../apps/web/lib/site/routes.ts";
import { englishLeaks } from "../../../apps/web/lib/site/i18n-allowlist.ts";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3200";
const API = process.env.E2E_API_URL || "http://localhost:4200";
const STRICT = process.env.LEAK_STRICT === "1";
const LOCALES = ["zh-TW", "zh-CN"] as const;

let browser: Browser | null = null;
let sampleLocationId: string | null = null;
const summary: string[] = [];

after(async () => {
  await browser?.close();
  console.log(`\nENGLISH_LEAK_SUMMARY (${STRICT ? "strict" : "todo until F1"})\n${summary.join("\n")}`);
});

async function getBrowser(): Promise<Browser> {
  browser ??= await chromium.launch({ args: ["--no-sandbox"] });
  return browser;
}

async function resolveParam(value: string): Promise<string> {
  if (value !== SAMPLE_LOCATION_ID) return value;
  if (sampleLocationId === null) {
    try {
      const res = await fetch(`${API}/locations`, { headers: { "x-tenant-slug": "oh" } });
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body?.locations ?? []);
      sampleLocationId = list[0]?.id ?? "SAMPLE";
    } catch {
      sampleLocationId = "SAMPLE";
    }
  }
  return sampleLocationId!;
}

const { defaultBrowserType: _ignored, ...IPHONE_15 } = devices["iPhone 15"];

for (const route of SITE_ROUTES) {
  for (const locale of LOCALES) {
    const name = `${locale} ${route.path} [${route.group}]`;
    if (route.auth || route.internal) {
      test(name, { skip: route.auth ? "needs a signed-in member" : "internal page" }, () => {});
      summary.push(`SKIP  ${name} (${route.auth ? "auth" : "internal"})`);
      continue;
    }
    test(name, { todo: STRICT ? false : "until F1 (LEAK_STRICT=1 to enforce)" }, async () => {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(route.params ?? {})) params[k] = await resolveParam(v);
      const url = `${BASE}/${locale}${routeUrl(route, (v) => (v === SAMPLE_LOCATION_ID ? params.locationId ?? v : v))}`;

      const ctx = await (await getBrowser()).newContext(IPHONE_15);
      // The legacy Chappy widget calls localhost:4000 from localhost; keep the crawl off it.
      await ctx.route(/localhost:4000/, (r) => r.abort());
      const page = await ctx.newPage();
      try {
        try {
          await page.goto(url, { waitUntil: "load", timeout: 180_000 });
        } catch (err) {
          summary.push(`ERROR ${name}  could not load: ${String((err as Error).message).split("\n")[0]}`);
          throw err;
        }
        await page.waitForTimeout(2_500);
        const chunks = await page.evaluate(() => {
          const out: string[] = [document.body.innerText];
          for (const el of Array.from(document.querySelectorAll("[alt], [aria-label], [placeholder]"))) {
            for (const attr of ["alt", "aria-label", "placeholder"]) {
              const v = el.getAttribute(attr);
              if (v) out.push(`${attr}="${v}"`);
            }
          }
          return out;
        });

        const lines = chunks.flatMap((c) => c.split("\n")).map((l) => l.trim()).filter(Boolean);
        const leaking = lines.filter((l) => englishLeaks(l.replace(/^(alt|aria-label|placeholder)=/, "")).length > 0);
        const words = [...new Set(leaking.flatMap((l) => englishLeaks(l.replace(/^(alt|aria-label|placeholder)=/, ""))))];
        summary.push(`${leaking.length ? "LEAK" : "ok  "}  ${name}  ${leaking.length} line(s)${words.length ? `: ${words.slice(0, 12).join(", ")}` : ""}`);
        assert.deepEqual(
          leaking,
          [],
          `${name} (${page.url()}) shows ${leaking.length} English line(s):\n${[...new Set(leaking)].map((l) => `  ${l.slice(0, 120)}`).join("\n")}`,
        );
      } finally {
        await ctx.close();
      }
    });
  }
}
