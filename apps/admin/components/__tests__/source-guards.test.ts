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
export const LEGACY: string[] = ["components/AdminNav.tsx"];
const all = DIRS.flatMap(files).filter((f) => !LEGACY.some((l) => path.relative(root, f).startsWith(l)));
const offenders = (re: RegExp, allow?: RegExp) =>
  all.flatMap((f) => readFileSync(f, "utf8").split("\n").map((line, i) => ({ f: path.relative(root, f), i: i + 1, line }))
    .filter(({ line }) => re.test(line) && !(allow && allow.test(line))).map(({ f, i }) => `${f}:${i}`));

describe("console source guards", () => {
  test("no inline styles except marked dynamic values", () => {
    expect(offenders(/style=\{\{/, /style-ok:/).filter((o) => !o.startsWith("components/ApiAuthInit"))).toEqual([]);
  });
  test("no alert/confirm/prompt", () => {
    expect(offenders(/\b(window\.)?(alert|confirm|prompt)\(/, /useConfirm|confirm\(\{|\.confirm\(|onConfirm/)).toEqual([]);
  });
  test("no em dashes", () => expect(offenders(/—/)).toEqual([]));
  test("no emoji", () => expect(offenders(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)).toEqual([]));
});
