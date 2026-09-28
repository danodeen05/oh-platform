/**
 * Task C5: locale parity and em-dash guards.
 *
 * Every guard here is an ordinary test since Task F1 (see ./i18n-worklist.ts
 * for printing a worklist). The `site.*` namespace and
 * the new site code are clean today, so those guards are ordinary tests
 * and must stay green.
 */
import { readFileSync } from "node:fs";
// @ts-expect-error -- apps/web pins @types/node@^20, which lacks fs.globSync (Node 22 has it); same as no-emoji.test.ts.
import { globSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import zhCN from "@/messages/zh-CN.json";
import zhTW from "@/messages/zh-TW.json";
import { formatWorklist, report } from "./i18n-worklist";

type Tree = Record<string, unknown>;

const WEB = path.resolve(__dirname, "../../..");
const EM_DASH = "—";

const keys = (o: Tree, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v as Tree, `${p}${k}.`) : [`${p}${k}`],
  );
const nonPlan = (ks: string[]) => ks.filter((k) => !k.startsWith("plan."));

const LOCALES: Array<[string, Tree]> = [
  ["zh-TW", zhTW as Tree],
  ["zh-CN", zhCN as Tree],
  ["es", es as Tree],
];
const EN_KEYS = nonPlan(keys(en as Tree));

function missingKeys(m: Tree): string[] {
  const have = new Set(keys(m));
  return EN_KEYS.filter((k) => !have.has(k));
}

/** Leaf string values containing an em dash, as "key: text". */
function emDashValues(o: Tree, p = ""): Array<{ key: string; text: string }> {
  return Object.entries(o).flatMap(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) return emDashValues(v as Tree, `${p}${k}.`);
    const text = Array.isArray(v) ? v.join(" | ") : String(v);
    return text.includes(EM_DASH) ? [{ key: `${p}${k}`, text }] : [];
  });
}

describe("locale parity (non-plan keys)", () => {
  it.each(LOCALES)("%s has every non-plan key", (name, m) => {
    const missing = missingKeys(m);
    const worklist = formatWorklist(
      `keys missing in ${name}`,
      missing,
      (k) => k.split(".")[0],
      (k) => k,
    );
    report(`keys missing in ${name}`, missing, worklist);
    expect(missing, worklist).toEqual([]);
  });

  it.each(LOCALES)("%s has every site.* key (the rebuilt site stays complete)", (_name, m) => {
    const have = new Set(keys(m));
    expect(EN_KEYS.filter((k) => k.startsWith("site.") && !have.has(k))).toEqual([]);
  });

  // Task D1: the home story's namespace is complete in every locale, both ways.
  it.each(LOCALES)("%s has exactly the home.* keys en has", (_name, m) => {
    const theirs = keys(m).filter((k) => k.startsWith("home."));
    const ours = EN_KEYS.filter((k) => k.startsWith("home."));
    expect(theirs.sort()).toEqual(ours.sort());
  });
});

describe("em dashes", () => {
  it("no em dashes in any locale file", () => {
    const hits = (
      [["en", en], ...LOCALES] as Array<[string, Tree]>
    ).flatMap(([name, m]) => emDashValues(m).map((h) => ({ ...h, locale: name })));
    const worklist = formatWorklist(
      "em dashes in messages",
      hits,
      (h) => `${h.locale} ${h.key.split(".")[0]}`,
      (h) => `${h.key}: ${h.text.slice(0, 90)}`,
    );
    report("em dashes in messages", hits, worklist);
    expect(JSON.stringify([en, zhTW, zhCN, es]).includes(EM_DASH), worklist).toBe(false);
  });

  it("no em dashes in the site's own copy (components/site, app/[locale]/(site)), comments aside", () => {
    const files = [
      ...globSync("components/site/**/*.{ts,tsx}", { cwd: WEB }),
      ...globSync("app/[[]locale]/(site)/**/*.{ts,tsx}", { cwd: WEB }),
    ].filter((f: string) => !f.includes("__tests__"));
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(path.join(WEB, f), "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          const isComment = code.startsWith("//") || code.startsWith("*") || code.startsWith("/*") || code.startsWith("{/*");
          if (!isComment && line.includes(EM_DASH)) hits.push(`${f}:${i + 1}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
