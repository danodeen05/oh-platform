/**
 * Task C5: no literal user-facing text in JSX. Uses the TypeScript compiler
 * API to walk every customer `.tsx` file and flag:
 *
 * - `JsxText` nodes that contain letters (in any script), and
 * - string-literal `aria-label`, `alt`, `title` and `placeholder`
 *   attributes (a plain "..." value, or a {"..."} / {`...`} expression).
 *
 * Allowlisted brand names, units and codes (lib/site/i18n-allowlist.ts) are
 * removed first, so `<span>Chappy</span>` is fine.
 *
 * Scope: app/[locale]/** except plan, kiosk (and kiosk-unauthorized), cny,
 * agents and the dev-only (site)/lab routes; components/site/**; and the
 * top-level components/*.tsx. Tests are skipped.
 *
 * The whole-tree guard is an ordinary test since Task F1; the new site code (the
 * shell, components/site) is clean today and must stay clean.
 */
import { readFileSync } from "node:fs";
// @ts-expect-error -- apps/web pins @types/node@^20, which lacks fs.globSync (Node 22 has it); same as no-emoji.test.ts.
import { globSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { stripAllowlisted } from "../i18n-allowlist";
import { formatWorklist, report } from "./i18n-worklist";

const WEB = path.resolve(__dirname, "../../..");
const CHECKED_ATTRS = new Set(["aria-label", "alt", "title", "placeholder"]);
const LETTER = /\p{L}/u;

export interface LiteralHit {
  file: string;
  line: number;
  kind: "text" | "attr";
  text: string;
}

const EXCLUDED_APP_DIRS = [/^app\/\[locale\]\/plan\//, /^app\/\[locale\]\/kiosk/, /^app\/\[locale\]\/cny\//, /^app\/\[locale\]\/agents\//, /^app\/\[locale\]\/\(site\)\/lab\//];

export function customerTsxFiles(): string[] {
  const app = (globSync("app/[[]locale]/**/*.tsx", { cwd: WEB }) as string[]).filter(
    (f) => !EXCLUDED_APP_DIRS.some((re) => re.test(f)),
  );
  const site = globSync("components/site/**/*.tsx", { cwd: WEB }) as string[];
  const top = globSync("components/*.tsx", { cwd: WEB }) as string[];
  return [...app, ...site, ...top].filter((f) => !f.includes("__tests__")).sort();
}

function hasLetters(text: string): boolean {
  return LETTER.test(stripAllowlisted(text));
}

function stringOf(init: ts.JsxAttributeValue | undefined): string | null {
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  }
  return null;
}

export function literalHits(file: string, source: string): LiteralHit[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: LiteralHit[] = [];
  const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sf).replace(/\s+/g, " ").trim();
      if (text && hasLetters(text)) hits.push({ file, line: lineOf(node), kind: "text", text });
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (CHECKED_ATTRS.has(name)) {
        const value = stringOf(node.initializer);
        if (value && hasLetters(value)) hits.push({ file, line: lineOf(node), kind: "attr", text: `${name}="${value}"` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function scan(files: string[]): LiteralHit[] {
  return files.flatMap((f) => literalHits(f, readFileSync(path.join(WEB, f), "utf8")));
}

/** Group key: the route directory for app files, the component file otherwise. */
function routeOf(file: string): string {
  if (!file.startsWith("app/")) return file;
  const dir = path.dirname(file).replace(/^app\/\[locale\]/, "").replace(/\/\([^/]+\)/g, "");
  return `route ${dir || "/"}`;
}

describe("the scanner itself", () => {
  it("flags JSX text and literal a11y/alt/placeholder attributes, not expressions or allowlisted names", () => {
    const src = `
      export function X({ t }: any) {
        return (
          <div aria-label="Close menu" title={t("x")}>
            Hello there
            <img alt={"A bowl"} src="/a.png" />
            <input placeholder={\`Search\`} />
            <span>Chappy</span>
            <span>{t("ok")}</span>
            <span> / 42 </span>
            <p>點餐</p>
          </div>
        );
      }`;
    const hits = literalHits("x.tsx", src).map((h) => h.text);
    expect(hits).toEqual(['aria-label="Close menu"', "Hello there", 'alt="A bowl"', 'placeholder="Search"', "點餐"]);
  });

  it("scans the expected tree", () => {
    const files = customerTsxFiles();
    expect(files.some((f) => f.startsWith("app/[locale]/(legacy)/"))).toBe(true);
    expect(files.some((f) => f.startsWith("components/site/shell/"))).toBe(true);
    expect(files.some((f) => f === "components/Header.tsx")).toBe(true);
    expect(files.some((f) => /\/(plan|kiosk|cny|agents)\//.test(f) && f.startsWith("app/"))).toBe(false);
    expect(files.some((f) => f.includes("/(site)/lab/"))).toBe(false);
  });
});

describe("no literal JSX text", () => {
  it("customer pages and components render no literal text", () => {
    const hits = scan(customerTsxFiles());
    const worklist = formatWorklist(
      "literal JSX",
      hits,
      (h) => routeOf(h.file),
      (h) => `${h.file}:${h.line}  ${h.kind === "attr" ? h.text : JSON.stringify(h.text.slice(0, 80))}`,
    );
    report("literal JSX", hits, worklist);
    expect(hits, worklist).toEqual([]);
  });

  it("the rebuilt site's own components (components/site, (site) routes) have none", () => {
    const files = customerTsxFiles().filter((f) => f.startsWith("components/site/") || f.includes("/(site)/"));
    expect(files.length).toBeGreaterThan(0);
    expect(scan(files)).toEqual([]);
  });
});
