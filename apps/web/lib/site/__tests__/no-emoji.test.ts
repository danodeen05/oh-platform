import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error -- apps/web pins @types/node@^20; Node 22 (the runtime
// here, see `node -v`) added fs.globSync, but the v20 type declarations
// don't have it yet. The root workspace already carries @types/node@24
// (which does), so this can be dropped once apps/web's own devDependency
// catches up.
import { globSync } from "node:fs";

// \p{Extended_Pictographic} catches emoji codepoints (including
// variation-selector'd ones like the U+1F336 U+FE0F chili pepper) without
// also flagging plain CJK text, which is a hard requirement here since the
// chop seals (Task C2) render real Han glyphs.
const EMOJI = /\p{Extended_Pictographic}/u;

// R4 (controller ruling): server logs are not user-facing, so lines
// containing `console.` are ignored by the scan.
function isIgnoredLine(line: string): boolean {
  return line.includes("console.");
}

function scan(roots: string[]): string[] {
  const files = roots.flatMap((r) =>
    globSync(`${r}/**/*.{ts,tsx,js,json}`, {
      exclude: (f: string) => /node_modules|\/plan\/|__tests__|\.next/.test(f),
    }),
  );
  return files.flatMap((f) =>
    readFileSync(f, "utf8")
      .split("\n")
      .map((line, i) => (!isIgnoredLine(line) && EMOJI.test(line) ? `${f}:${i + 1}` : null))
      .filter((hit): hit is string => hit !== null),
  );
}

// Task C2 note: this is the guard from the brief, scoped to customer code,
// messages, the API and the prisma seeds. It fails today (~272 emoji lines,
// mostly badge/challenge iconEmoji seed data and a handful of API log
// strings that don't use `console.`). Phase D drives the count to zero, and
// Task F1 Step 5 removes the `.fails` marker.
describe("no emoji", () => {
  const ROOTS = ["app", "components", "lib", "messages"].map((d) => `${__dirname}/../../../${d}`);
  const EXTRA = ["../../packages/api/src", "../../packages/db/prisma"].map((p) => `${__dirname}/../../../${p}`);

  it.fails("customer code, messages, API and seeds contain no emoji", () => {
    const hits = scan([...ROOTS, ...EXTRA]);
    expect(hits).toEqual([]);
  });

  // Second, passing guard: our own new work under components/site/ (icons,
  // seals, tier marks) must never regress into emoji, independent of
  // whatever the rest of the tree still has to clean up.
  it("components/site contains no emoji", () => {
    const hits = scan([`${__dirname}/../../../components/site`]);
    expect(hits).toEqual([]);
  });
});
