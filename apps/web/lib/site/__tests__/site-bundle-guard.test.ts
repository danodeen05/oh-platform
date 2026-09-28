/**
 * Task G2a/G2b bundle guards for the (site) pages' first load: the heavy
 * client libraries the mobile budget moved off the critical path must not
 * creep back in through a static import. Lazy (`import()` / next/dynamic)
 * chunks are fine; that's where these live now.
 *
 * Two scopes (G2b):
 * - the shell (every page: the root, [locale] and (site) layouts) may import
 *   none of DEFERRED;
 * - each page may import none of them either, except Stripe on the pages
 *   whose first screen IS a payment form (PAY_PAGES), and next/image, which
 *   a page may use for its own (remote, optimized) photos.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WEB, graphFrom, siteGraph, walk } from "./import-graph";

// Package -> why it must stay out of the (site) pages' initial JS.
const DEFERRED: Record<string, string> = {
  "@clerk/nextjs": "Clerk loads after first paint through components/site/auth/DeferredClerk.tsx (use lib/site/auth.tsx)",
  "@clerk/clerk-react": "Clerk loads after first paint through components/site/auth/DeferredClerk.tsx",
  "framer-motion": "Sheets load on first open (components/site/motion/LazySheet.tsx)",
  three: "three.js loads only via next/dynamic on user action",
  "@react-three/fiber": "three.js loads only via next/dynamic on user action",
  "@react-three/drei": "three.js loads only via next/dynamic on user action",
  "@stripe/stripe-js": "Stripe loads only on the pay steps",
  "@stripe/react-stripe-js": "Stripe loads only on the pay steps",
  "next/image": "about 5 KB of client JS; the shell uses pre-sized static <img>s",
};

const STRIPE = ["@stripe/stripe-js", "@stripe/react-stripe-js"];
/** Pages whose first screen is the payment form (relative to app/[locale]/(site)). */
const PAY_PAGES = ["order/payment/page.tsx", "order/group-payment/page.tsx"];
const PAGE_ALLOWED = ["next/image"];

const SITE_DIR = path.join(WEB, "app/[locale]/(site)");
const SHELL = [path.join(SITE_DIR, "layout.tsx"), path.join(WEB, "app/[locale]/layout.tsx"), path.join(WEB, "app/layout.tsx")];

function offenders(starts: string[], allowed: string[]): string[] {
  return [...graphFrom(starts, { followDynamic: false }).values()]
    .filter((n) => n.client)
    .flatMap((n) => n.packages.filter((p) => p in DEFERRED && !allowed.includes(p)).map((p) => `${n.rel} imports ${p}: ${DEFERRED[p]}`));
}

// The dev-only lab pages 404 in production, so they don't count.
const PAGES = walk(SITE_DIR)
  .filter((f) => f.endsWith(`${path.sep}page.tsx`) && !f.includes(`${path.sep}lab${path.sep}`))
  .map((f) => path.relative(SITE_DIR, f));

describe("(site) first-load bundle guard (Task G2a/G2b)", () => {
  it("walks the real shell and pages (sanity)", () => {
    const rels = [...siteGraph({ followDynamic: false, skipLab: true }).values()].map((n) => n.rel);
    expect(rels).toContain("components/site/shell/SiteShell.tsx");
    expect(rels).toContain("components/site/shell/TopBar.tsx");
    expect(rels).toContain("lib/site/api.ts");
    expect(PAGES.length).toBeGreaterThan(20);
    for (const p of PAY_PAGES) expect(PAGES).toContain(p);
  });

  it("the shell (every page) imports no deferred library statically", () => {
    expect(offenders(SHELL, [])).toEqual([]);
  });

  it.each(PAGES)("%s imports no deferred library statically (Stripe only on pay pages)", (page) => {
    const allowed = [...PAGE_ALLOWED, ...(PAY_PAGES.includes(page) ? STRIPE : [])];
    expect(offenders([...SHELL, path.join(SITE_DIR, page)], allowed)).toEqual([]);
  });

  it("keeps the (site) layouts free of Clerk's client provider (server `auth()` is fine)", () => {
    for (const file of SHELL) {
      const node = graphFrom([file], { followDynamic: false }).get(file)!;
      expect(node.packages, node.rel).not.toContain("@clerk/nextjs");
    }
  });
});
