#!/usr/bin/env node
/**
 * Site performance probe (Task G2a). Loads each customer route on the iPhone 15
 * profile with CDP throttling (1.6 Mbps down, 750 kbps up, 150 ms RTT, CPU 4x,
 * cache disabled), the same profile as the home e2e LCP test, and reports:
 *
 *   - LCP (median of RUNS), and the LCP element
 *   - gzipped (transferred) first-party JS, as "before load / total": the
 *     /_next/static/**.js requested before the load event (the budget
 *     number), and everything fetched by the load event plus 2 s of idle
 *   - first-party CSS, fonts, the HTML document, the RSC payload inlined in it
 *     (self.__next_f), and third-party bytes
 *
 * Run it against a PRODUCTION build (next build --webpack, next start):
 *
 *   PERF_BASE=http://localhost:3202 RUNS=3 node scripts/site-perf.mjs [--json out.json]
 *
 * ROUTES and LOCALES override the defaults (comma separated).
 *
 * CLERK_SEED=1 visits the page once, unthrottled, before the timed load, so
 * the context already holds Clerk's development-instance cookie. A dev
 * instance (pk_test_ keys, as here) bounces every cookieless first request
 * through a "dev browser" redirect to clerk.accounts.dev and back, which
 * costs about 1.5 s on this profile; production (pk_live_) instances never
 * do. The seeded number is the production-equivalent one. Nothing else is
 * warmed: the cache stays disabled for the timed load.
 */
import { chromium, devices } from "playwright";
import { writeFileSync } from "node:fs";
import os from "node:os";

const BASE = process.env.PERF_BASE || "http://localhost:3202";
const RUNS = Number(process.env.RUNS || 3);
const ROUTES = (process.env.ROUTES || "/,/rewards,/member,/lab/shell").split(",");
const LOCALES = (process.env.LOCALES || "en,zh-TW").split(",");
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

const { defaultBrowserType: _ignored, ...iphone15 } = devices["iPhone 15"];
const origin = new URL(BASE).origin;

function kind(url, type) {
  const u = new URL(url);
  if (u.origin !== origin) return "thirdParty";
  if (type === "Document") return "html";
  if (u.pathname.startsWith("/_next/static/") && u.pathname.endsWith(".js")) return "js";
  if (u.pathname.endsWith(".css")) return "css";
  if (type === "Font" || /\.woff2?$/.test(u.pathname)) return "font";
  if (type === "Image" || u.pathname.startsWith("/_next/image")) return "image";
  return "other";
}

const SEED = process.env.CLERK_SEED === "1";
// MAX_LOAD=3 waits (up to 10 minutes) for the 1-minute load average to drop
// under 3 before each timed load. The 4x CPU slowdown is relative to the
// host, so on a shared, busy machine other processes inflate every number.
const MAX_LOAD = Number(process.env.MAX_LOAD || 0);

async function quietHost() {
  if (!MAX_LOAD) return;
  const until = Date.now() + 10 * 60_000;
  while (os.loadavg()[0] >= MAX_LOAD && Date.now() < until) await new Promise((r) => setTimeout(r, 5_000));
}

async function probe(browser, url) {
  await quietHost();
  const ctx = await browser.newContext(iphone15);
  try {
    if (SEED) {
      const seed = await ctx.newPage();
      await seed.goto(url, { waitUntil: "load", timeout: 120_000 });
      await seed.close();
    }
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__lcp = null;
      new PerformanceObserver((list) => {
        const e = list.getEntries().at(-1);
        window.__lcp = { time: e.startTime, url: e.url || "", tag: e.element?.tagName || "", text: (e.element?.textContent || "").slice(0, 40) };
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const cdp = await ctx.newCDPSession(page);
    const reqs = new Map();
    const totals = { html: 0, js: 0, jsBeforeLoad: 0, css: 0, font: 0, image: 0, other: 0, thirdParty: 0 };
    const files = [];
    const started = new Map();
    let loadAt = Infinity;
    cdp.on("Page.loadEventFired", (e) => (loadAt = e.timestamp));
    cdp.on("Network.requestWillBeSent", (e) => started.set(e.requestId, e.timestamp));
    cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type }));
    cdp.on("Network.loadingFinished", (e) => {
      const r = reqs.get(e.requestId);
      if (!r || r.url.startsWith("data:")) return;
      const k = kind(r.url, r.type);
      totals[k] += e.encodedDataLength;
      // JS requested before the load event: what the page needs to render and
      // hydrate. Chunks deliberately deferred past load (lazyOnload-style)
      // show up in "js" only.
      if (k === "js" && (started.get(e.requestId) ?? 0) < loadAt) totals.jsBeforeLoad += e.encodedDataLength;
      files.push({ k, url: r.url, bytes: e.encodedDataLength, beforeLoad: (started.get(e.requestId) ?? 0) < loadAt });
    });
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(url, { waitUntil: "load", timeout: 180_000 });
    await page.waitForTimeout(2_000);
    const lcp = await page.evaluate(() => window.__lcp);
    // The RSC payload inlined in the HTML (self.__next_f.push scripts).
    const rsc = await page.evaluate(() =>
      [...document.scripts].reduce((n, s) => n + (s.textContent?.startsWith("self.__next_f.push") ? s.textContent.length : 0), 0),
    );
    return { lcp, totals, rsc, files };
  } finally {
    await ctx.close();
  }
}

const kb = (b) => Math.round(b / 102.4) / 10;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const out = [];
try {
  // Warm the server (first render compiles nothing in prod, but fills caches).
  // Each warm-up page is closed at once: a page left open keeps polling and
  // animating, and steals CPU from every timed load after it.
  for (const l of LOCALES) {
    for (const r of ROUTES) {
      const warm = await browser.newPage();
      await warm.goto(`${BASE}/${l}${r === "/" ? "" : r}`).catch(() => {});
      await warm.close();
    }
  }
  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      const url = `${BASE}/${locale}${route === "/" ? "" : route}`;
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await probe(browser, url));
      const lcps = runs.map((r) => r.lcp?.time ?? NaN);
      const last = runs.at(-1);
      const row = {
        route: `/${locale}${route === "/" ? "" : route}`,
        lcpMs: Math.round(median(lcps)),
        lcpRuns: lcps.map(Math.round),
        lcpEl: last.lcp ? `${last.lcp.tag} ${last.lcp.url.replace(origin, "").slice(0, 60) || last.lcp.text}` : "none",
        jsKB: kb(last.totals.js),
        jsBeforeLoadKB: kb(last.totals.jsBeforeLoad),
        cssKB: kb(last.totals.css),
        fontKB: kb(last.totals.font),
        htmlKB: kb(last.totals.html),
        rscChars: last.rsc,
        thirdPartyKB: kb(last.totals.thirdParty),
        files: last.files,
      };
      out.push(row);
      console.log(
        `${row.route.padEnd(18)} LCP ${String(row.lcpMs).padStart(6)} ms [${row.lcpRuns.join(", ")}]  JS ${row.jsBeforeLoadKB}/${row.jsKB} KB  CSS ${row.cssKB} KB  font ${row.fontKB} KB  HTML ${row.htmlKB} KB  RSC ${row.rscChars} ch  3p ${row.thirdPartyKB} KB  (${row.lcpEl})`,
      );
    }
  }
} finally {
  await browser.close();
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 2));
