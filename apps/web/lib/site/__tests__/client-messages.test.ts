/**
 * Task G2a: (site) pages serialize only SITE_CLIENT_NAMESPACES to the
 * browser. This walks the import graph from every file under
 * app/[locale]/(site) (plus the root and [locale] layouts, which wrap them),
 * marks everything reachable from a "use client" module as client code, and
 * checks each `useTranslations(...)` there against the list. A namespace
 * missing from the list would render as "" in production, so this is the
 * guard that keeps the trimmed payload safe.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import zhCN from "../../../messages/zh-CN.json";
import zhTW from "../../../messages/zh-TW.json";
import { SITE_IMAGES } from "../images";
import { SERVER_ONLY_NAMESPACES, SITE_CLIENT_NAMESPACES, omitNamespaces, pickNamespaces } from "../client-messages";

const WEB = path.resolve(__dirname, "../../..");

/**
 * Client files that call `useTranslations()` with no namespace, and the
 * namespaces their keys live in. Add an entry (and check its keys) when a new
 * one appears; the test fails until you do.
 */
const ROOT_TRANSLATORS: Record<string, string[]> = {
  // Alt text through SITE_IMAGES[...].alt, all `siteImages.*` keys (checked below).
  "components/site/home/WalkIn.tsx": ["siteImages"],
  "components/site/home/ThePod.tsx": ["siteImages"],
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(WEB, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const suffix of ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"]) {
    const p = base + suffix;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

const USE_CLIENT = /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*["']use client["']/;
const IMPORTS = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

function clientFilesOfSite(): Set<string> {
  const starts = [
    ...walk(path.join(WEB, "app/[locale]/(site)")).filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes("__tests__")),
    path.join(WEB, "app/[locale]/layout.tsx"),
    path.join(WEB, "app/layout.tsx"),
  ];
  const seen = new Set<string>();
  const client = new Set<string>();
  const visit = (file: string, inClient: boolean) => {
    const key = `${file}|${inClient}`;
    if (seen.has(key)) return;
    seen.add(key);
    const src = readFileSync(file, "utf8");
    const isClient = inClient || USE_CLIENT.test(src);
    if (isClient) client.add(file);
    for (const m of src.matchAll(IMPORTS)) {
      const next = resolveImport(file, m[1]);
      if (next) visit(next, isClient);
    }
  };
  for (const s of starts) visit(s, false);
  return client;
}

describe("client message namespaces (Task G2a)", () => {
  it("covers every namespace a (site) client component reads", () => {
    const allowed = new Set<string>(SITE_CLIENT_NAMESPACES);
    const problems: string[] = [];
    const files = clientFilesOfSite();
    expect(files.size).toBeGreaterThan(20); // the walk really found the shell and pages
    for (const file of files) {
      const rel = path.relative(WEB, file);
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/useTranslations\(\s*([^)]*)\)/g)) {
        const arg = m[1].trim();
        if (!arg) {
          const declared = ROOT_TRANSLATORS[rel];
          if (!declared) problems.push(`${rel}: useTranslations() with no namespace; add it to ROOT_TRANSLATORS`);
          else for (const ns of declared) if (!allowed.has(ns)) problems.push(`${rel}: ${ns} (root translator)`);
          continue;
        }
        const literal = arg.match(/^["'`]([^"'`$]+)["'`]$/);
        if (!literal) {
          problems.push(`${rel}: useTranslations(${arg}) is not a string literal`);
          continue;
        }
        const ns = literal[1].split(".")[0];
        if (!allowed.has(ns)) problems.push(`${rel}: "${ns}" is not in SITE_CLIENT_NAMESPACES`);
      }
      if (/\buseMessages\(/.test(src) && rel !== "components/site/IntlClientProvider.tsx") {
        problems.push(`${rel}: useMessages() reads the whole client catalog; check it against SITE_CLIENT_NAMESPACES`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("the root translators only read siteImages.* keys", () => {
    for (const entry of Object.values(SITE_IMAGES)) expect(entry.alt).toMatch(/^siteImages\./);
  });

  it("every listed namespace exists in all four locales, and the plan is never sent to site pages", () => {
    for (const messages of [en, es, zhCN, zhTW] as Record<string, unknown>[]) {
      for (const ns of SITE_CLIENT_NAMESPACES) expect(messages[ns], ns).toBeTypeOf("object");
    }
    for (const ns of SERVER_ONLY_NAMESPACES) expect(SITE_CLIENT_NAMESPACES as readonly string[]).not.toContain(ns);
  });

  it("pick keeps only the listed namespaces; omit drops them and keeps the rest", () => {
    const all = en as Record<string, unknown>;
    const picked = pickNamespaces(all, SITE_CLIENT_NAMESPACES);
    expect(Object.keys(picked).sort()).toEqual([...SITE_CLIENT_NAMESPACES].sort());
    expect(picked.site).toBe(all.site);
    const legacy = omitNamespaces(all, SERVER_ONLY_NAMESPACES);
    expect(legacy.plan).toBeUndefined();
    expect(Object.keys(legacy).length).toBe(Object.keys(all).length - SERVER_ONLY_NAMESPACES.length);
    expect(all.plan).toBeDefined(); // omit doesn't mutate
    // The point of it: the site set is a small fraction of the catalog.
    expect(JSON.stringify(picked).length).toBeLessThan(JSON.stringify(all).length / 4);
  });
});
