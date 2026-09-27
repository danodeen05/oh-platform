// Screenshots Kitchen and Cleaning at the tablet sizes they run on, for before/after comparison.
// Usage: ADMIN_URL=http://localhost:3011 node apps/admin/scripts/baseline-displays.mjs <label>
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const base = process.env.ADMIN_URL || "http://localhost:3011";
const out = process.argv[2] || "baseline";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [w, h] of [[1280, 800], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const path of ["/kitchen", "/cleaning"]) {
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `/tmp/admin-${out}${path.replace("/", "-")}-${w}.png` });
  }
  await page.close();
}
await browser.close();
