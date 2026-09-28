/**
 * Task G2a/G2b: (site) pages serialize only the namespaces their client code
 * reads (lib/site/client-messages.ts). This walks import graphs (lazy chunks
 * included), marks everything reachable from a "use client" module as client
 * code, and checks each `useTranslations(...)` against the provider that
 * code renders under:
 *
 * - the (site) layout and the shell: SITE_BASE_NAMESPACES;
 * - each top-level route segment: the base plus ROUTE_NAMESPACES[segment],
 *   provided by that segment's layout.tsx (<RouteIntl route="segment">);
 * - the home page: <RouteIntl route="home"> in page.tsx itself.
 *
 * A namespace missing here would render as "" in production.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import zhCN from "../../../messages/zh-CN.json";
import zhTW from "../../../messages/zh-TW.json";
import { SITE_IMAGES } from "../images";
import {
  ROUTE_NAMESPACES,
  SERVER_ONLY_NAMESPACES,
  SITE_BASE_NAMESPACES,
  omitNamespaces,
  pickNamespaces,
  routeNamespaces,
  type SiteRoute,
} from "../client-messages";
import { WEB, graphFrom, walk } from "./import-graph";

const SITE_DIR = path.join(WEB, "app/[locale]/(site)");

/**
 * Client files that call `useTranslations()` with no namespace, and the
 * namespaces their keys live in. Add an entry (and check its keys) when a new
 * one appears; the test fails until you do.
 */
const ROOT_TRANSLATORS: Record<string, string[]> = {
  // Alt text through SITE_IMAGES[...].alt: all `siteImages.*` keys (checked below).
  "components/site/home/WalkIn.tsx": ["siteImages"],
  "components/site/home/ThePod.tsx": ["siteImages"],
  "app/[locale]/(site)/order/location-selector.tsx": ["siteImages"],
  "components/site/menu/ItemSheet.tsx": ["siteImages"],
  "components/site/order/BowlBuilder.tsx": ["siteImages"],
  "components/site/order/ClosedPanel.tsx": ["siteImages"],
  "components/site/order/PayStep.tsx": ["siteImages"],
  "components/site/order/PodStep.tsx": ["siteImages"],
  // CombMap labels through t.raw("combMap").
  "components/site/group/GroupLobby.tsx": ["combMap"],
  "components/site/group/GroupPodPicker.tsx": ["combMap"],
  "components/site/order/PodView.tsx": ["combMap"],
};

/** Block comments, and line comments that start a line or follow whitespace (so "https://" in a string survives). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const isSource = (f: string) => /\.(tsx?|jsx?)$/.test(f) && !f.includes("__tests__");

/** Namespaces the client files of a graph read, and problems found on the way. */
function namespacesOf(starts: string[]): { used: Map<string, Set<string>>; problems: string[] } {
  const used = new Map<string, Set<string>>();
  const problems: string[] = [];
  const add = (ns: string, rel: string) => {
    if (!used.has(ns)) used.set(ns, new Set());
    used.get(ns)!.add(rel);
  };
  for (const node of graphFrom(starts, { followDynamic: true }).values()) {
    if (!node.client) continue;
    const src = stripComments(readFileSync(node.file, "utf8"));
    for (const m of src.matchAll(/useTranslations\(\s*([^)]*)\)/g)) {
      const arg = m[1].trim();
      if (!arg) {
        const declared = ROOT_TRANSLATORS[node.rel];
        if (!declared) problems.push(`${node.rel}: useTranslations() with no namespace; add it to ROOT_TRANSLATORS`);
        else for (const ns of declared) add(ns, node.rel);
        continue;
      }
      // A string literal, or a template whose first segment is static.
      const lit = arg.match(/^["'`]([A-Za-z0-9_]+)(?:[."'`]|$)/);
      if (!lit) {
        problems.push(`${node.rel}: useTranslations(${arg}) has no static namespace`);
        continue;
      }
      add(lit[1], node.rel);
    }
    if (/\buseMessages\(/.test(src) && node.rel !== "components/site/IntlClientProvider.tsx") {
      problems.push(`${node.rel}: useMessages() reads the whole client catalog; check it against client-messages.ts`);
    }
  }
  return { used, problems };
}

function check(label: string, starts: string[], allowed: readonly string[]): string[] {
  const { used, problems } = namespacesOf(starts);
  const ok = new Set(allowed);
  for (const [ns, files] of used) {
    if (!ok.has(ns)) problems.push(`${label}: "${ns}" (read by ${[...files].slice(0, 3).join(", ")}) is not provided`);
  }
  return problems;
}

const LAYOUT_STARTS = [
  path.join(SITE_DIR, "layout.tsx"),
  path.join(WEB, "app/[locale]/layout.tsx"),
  path.join(WEB, "app/layout.tsx"),
];

const SEGMENTS = readdirSync(SITE_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "lab")
  .map((e) => e.name);

describe("client message namespaces (Task G2a/G2b)", () => {
  it("the (site) layout and shell read only SITE_BASE_NAMESPACES", () => {
    expect(check("(site) layout", LAYOUT_STARTS, SITE_BASE_NAMESPACES)).toEqual([]);
  });

  it("every top-level (site) route has a RouteIntl layout for its own entry", () => {
    const problems: string[] = [];
    for (const seg of SEGMENTS) {
      const layout = path.join(SITE_DIR, seg, "layout.tsx");
      if (!existsSync(layout)) problems.push(`${seg}: no layout.tsx with <RouteIntl route="${seg}">`);
      else if (!readFileSync(layout, "utf8").includes(`<RouteIntl route="${seg}">`)) problems.push(`${seg}: layout.tsx doesn't render <RouteIntl route="${seg}">`);
      if (!(seg in ROUTE_NAMESPACES)) problems.push(`${seg}: missing from ROUTE_NAMESPACES`);
    }
    if (!readFileSync(path.join(SITE_DIR, "page.tsx"), "utf8").includes(`<RouteIntl route="home">`)) problems.push(`home: page.tsx doesn't render <RouteIntl route="home">`);
    expect(problems).toEqual([]);
  });

  it.each([...SEGMENTS, "home"])("%s: its client code reads only the base plus its route set", (seg) => {
    const starts =
      seg === "home" ? [path.join(SITE_DIR, "page.tsx")] : walk(path.join(SITE_DIR, seg)).filter(isSource);
    expect(check(seg, starts, routeNamespaces(seg as SiteRoute))).toEqual([]);
  });

  it("the root translators only read siteImages.* keys through SITE_IMAGES", () => {
    for (const entry of Object.values(SITE_IMAGES)) expect(entry.alt).toMatch(/^siteImages\./);
  });

  it("every listed namespace exists in all four locales, and the plan is never sent to site pages", () => {
    const listed = new Set<string>([...SITE_BASE_NAMESPACES, ...Object.values(ROUTE_NAMESPACES).flat()]);
    for (const messages of [en, es, zhCN, zhTW] as Record<string, unknown>[]) {
      for (const ns of listed) expect(messages[ns], ns).toBeTypeOf("object");
    }
    for (const ns of SERVER_ONLY_NAMESPACES) expect(listed.has(ns)).toBe(false);
  });

  it("pick keeps only the listed namespaces; omit drops them and keeps the rest", () => {
    const all = en as Record<string, unknown>;
    const picked = pickNamespaces(all, SITE_BASE_NAMESPACES);
    expect(Object.keys(picked).sort()).toEqual([...SITE_BASE_NAMESPACES].sort());
    expect(picked.site).toBe(all.site);
    const legacy = omitNamespaces(all, SERVER_ONLY_NAMESPACES);
    expect(legacy.plan).toBeUndefined();
    expect(Object.keys(legacy).length).toBe(Object.keys(all).length - SERVER_ONLY_NAMESPACES.length);
    expect(all.plan).toBeDefined(); // omit doesn't mutate
  });

  it("no route carries more than a fifth of the catalog", () => {
    const all = en as Record<string, unknown>;
    const size = (ns: readonly string[]) => JSON.stringify(pickNamespaces(all, ns)).length;
    for (const route of Object.keys(ROUTE_NAMESPACES) as SiteRoute[]) {
      expect(size(routeNamespaces(route)), route).toBeLessThan(JSON.stringify(all).length / 5);
    }
  });
});
