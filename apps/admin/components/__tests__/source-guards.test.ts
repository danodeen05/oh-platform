import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = path.resolve(__dirname, "../..");
const DIRS = ["app/(console)", "components"];
function files(dir: string): string[] {
  const full = path.join(root, dir);
  try { statSync(full); } catch { return []; }
  return readdirSync(full, { recursive: true }).map(String).filter((f) => /\.(tsx?|ts)$/.test(f) && !f.includes("__tests__")).map((f) => path.join(full, f));
}
// Paths not yet rebuilt; each rebuild task deletes its entries. Task 29 asserts this is empty.
export const LEGACY: string[] = [
  "app/(console)/analytics",
  "app/(console)/cleaning/config",
  "app/(console)/plan-access",
];
const all = DIRS.flatMap(files).filter((f) => !LEGACY.some((l) => path.relative(root, f).startsWith(l)));
const offendingLines = (bad: (line: string) => boolean) =>
  all.flatMap((f) => readFileSync(f, "utf8").split("\n").map((line, i) => ({ f: path.relative(root, f), i: i + 1, line }))
    .filter(({ line }) => bad(line)).map(({ f, i }) => `${f}:${i}`));
const offenders = (re: RegExp, allow?: RegExp) => offendingLines((line) => re.test(line) && !(allow && allow.test(line)));

/** Blocking browser dialogs. `confirm({` (the useConfirm call style) is allowed; window.* and string-argument calls are not. */
const DIALOG = /\b(window\.)?(alert|confirm|prompt)\(/;
export function isDialogCall(line: string): boolean {
  if (/\bwindow\.(alert|confirm|prompt)\(/.test(line)) return true;
  return line.replace(/\bconfirm\(\s*\{/g, "").match(DIALOG) !== null;
}

describe("dialog matcher", () => {
  test.each([
    'if (window.confirm("Delete?")) remove();',
    'window.alert("Saved")',
    'const n = window.prompt("Name");',
    'if (confirm("Delete?")) remove();',
    'alert(err.message);',
    'prompt("x")',
    'await confirm({ title: "a" }); window.confirm("b");',
  ])("flags %s", (line) => expect(isDialogCall(line)).toBe(true));
  test.each([
    'const ok = await confirm({ title: "Delete promo?", confirmLabel: "Delete" });',
    "const confirm = useConfirm();",
    "onConfirm={() => done(true)}",
    "if (await ask({ title }))",
    "const alerts = items.filter(isAlert);",
  ])("allows %s", (line) => expect(isDialogCall(line)).toBe(false));
});

describe("console source guards", () => {
  test("no inline styles except marked dynamic values", () => {
    expect(offenders(/style=\{\{/, /style-ok:/).filter((o) => !o.startsWith("components/ApiAuthInit"))).toEqual([]);
  });
  test("no alert/confirm/prompt", () => {
    expect(offendingLines(isDialogCall)).toEqual([]);
  });
  test("no em dashes", () => expect(offenders(/—/)).toEqual([]));
  test("no emoji", () => expect(offenders(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)).toEqual([]));
});
