// apps/admin/scripts/ui-audit.mjs
// Visits every console route at phone and desktop sizes; fails on horizontal page scroll
// or tap targets under 44px, and saves screenshots. Run with the admin dev server up.
// Usage: ADMIN_URL=http://localhost:3011 node apps/admin/scripts/ui-audit.mjs [route ...]
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const base = process.env.ADMIN_URL || "http://localhost:3011";
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  "/", "/orders", "/menu", "/shop-orders", "/promos", "/gift-cards", "/gift-cards/config", "/products", "/catering",
  "/cleaning/config", "/analytics", "/analytics/operations", "/analytics/revenue", "/analytics/traffic",
  "/plan-access", "/locations", "/kiosks", "/team", "/unauthorized",
];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;
for (const [label, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  for (const route of ROUTES) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      const small = [...document.querySelectorAll("a, button, [role=switch], input, select, textarea")]
        .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden" && (b.height < 43.5 || b.width < 43.5) && !el.closest("table, [data-audit-ignore]"); })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
      return { overflow, small };
    });
    const name = `${label}${route.replace(/\//g, "_") || "_home"}`;
    await page.screenshot({ path: `/tmp/admin-audit-${name}.png`, fullPage: true });
    if (r.overflow || (label === "phone" && r.small.length)) {
      failures++;
      console.log(`FAIL ${label} ${route}`, r.overflow ? "horizontal scroll" : "", r.small.slice(0, 8));
    } else console.log(`ok   ${label} ${route}`);
  }
  await page.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
