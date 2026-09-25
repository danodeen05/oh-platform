#!/usr/bin/env node
/**
 * Canonical PDF export of the interactive business plan (spec 7.5, Phase 5).
 *
 * Vercel has no Chromium, so this runs on the droplet (or any machine with
 * the repo's Playwright browsers installed):
 *
 *   node scripts/plan-export-pdf.cjs --code OH-XXXX-0000 [--locale en] \
 *     [--base https://www.ohbeef.com] [--out plan.pdf]
 *
 * The code's allowlist and audience decide which sections print; the footer
 * on every page carries the code label and the generation date. The session
 * created for the export shows up in the admin analytics like any other, so
 * use a code issued for the purpose.
 */
const path = require("node:path");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const code = opt("code");
const locale = opt("locale", "en");
const base = opt("base", "https://www.ohbeef.com").replace(/\/$/, "");
const out = path.resolve(opt("out", `oh-business-plan-${locale}-${new Date().toISOString().slice(0, 10)}.pdf`));
if (!code) {
  console.error("Usage: node scripts/plan-export-pdf.cjs --code OH-XXXX-0000 [--locale en] [--base URL] [--out file.pdf]");
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
  await page.goto(`${base}/${locale}/plan/print?c=${encodeURIComponent(code)}`, { waitUntil: "load" });
  await page.waitForURL(new RegExp(`/${locale}/plan/print$`), { timeout: 60_000 });
  await page.waitForSelector("[data-section]", { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: out, format: "Letter", printBackground: true, preferCSSPageSize: true });
  const sections = await page.$$eval("[data-section]", (els) => els.length);
  await browser.close();
  console.log(`Wrote ${out} (${sections} sections)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
