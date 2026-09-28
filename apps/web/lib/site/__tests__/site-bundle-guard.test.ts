/**
 * Task G2a bundle guards for the (site) pages' first load: the heavy client
 * libraries the mobile budget moved off the critical path must not creep
 * back in through a static import. Lazy (`import()` / next/dynamic) chunks
 * are fine; that's where these live now.
 */
import { describe, expect, it } from "vitest";
import { siteGraph } from "./import-graph";

// Package -> why it must stay out of the (site) pages' initial JS.
const DEFERRED: Record<string, string> = {
  "@clerk/nextjs": "Clerk loads after first paint through components/site/auth/DeferredClerk.tsx (use lib/site/auth.tsx)",
  "@clerk/clerk-react": "Clerk loads after first paint through components/site/auth/DeferredClerk.tsx",
  "framer-motion": "Sheets load on first open (components/site/motion/LazySheet.tsx)",
  three: "three.js loads only via next/dynamic on user action",
  "@react-three/fiber": "three.js loads only via next/dynamic on user action",
  "@stripe/stripe-js": "Stripe loads only on the pay steps",
  "@stripe/react-stripe-js": "Stripe loads only on the pay steps",
  "next/image": "about 5 KB of client JS on every page; use SitePicture or a pre-sized static <img>",
};

describe("(site) first-load bundle guard (Task G2a)", () => {
  // The dev-only lab pages 404 in production, so they don't count.
  const nodes = [...siteGraph({ followDynamic: false, skipLab: true }).values()];

  it("walks the real shell (sanity)", () => {
    const rels = nodes.map((n) => n.rel);
    expect(rels).toContain("components/site/shell/SiteShell.tsx");
    expect(rels).toContain("components/site/shell/TopBar.tsx");
    expect(rels).toContain("lib/site/api.ts");
  });

  it("imports no deferred library statically from client code", () => {
    const offenders = nodes
      .filter((n) => n.client)
      .flatMap((n) => n.packages.filter((p) => p in DEFERRED).map((p) => `${n.rel} imports ${p}: ${DEFERRED[p]}`));
    expect(offenders).toEqual([]);
  });

  it("keeps the (site) layouts free of Clerk's client provider (server `auth()` is fine)", () => {
    const layouts = nodes.filter((n) => /app\/(\[locale\]\/)?(\(site\)\/)?layout\.tsx$/.test(n.rel));
    expect(layouts.length).toBe(3);
    for (const n of layouts) expect(n.packages, n.rel).not.toContain("@clerk/nextjs");
  });
});
