import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEST_MANIFEST } from "../generated/test-manifest";
import { MODEL_VERSION } from "../index";

const testsDir = dirname(fileURLToPath(import.meta.url));

/** Mirror of hashSources in scripts/test-manifest.mjs. */
function hashSources(files: readonly { name: string; text: string }[]): string {
  let h = 0x811c9dc5;
  for (const { name, text } of files) {
    for (const ch of `${name}\n${text}\n`) {
      h ^= ch.codePointAt(0) as number;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, "0");
}

describe("committed test manifest", () => {
  const sources = readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.ts"))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(testsDir, name), "utf8") }));

  it("is fresh: the test sources have not changed since it was generated (run pnpm --filter @oh/plan-model test:manifest)", () => {
    expect(TEST_MANIFEST.sourcesHash).toBe(hashSources(sources));
    expect(TEST_MANIFEST.files.map((f) => f.file)).toEqual(sources.map((s) => s.name));
  });
  it("matches the model version and was generated at a real time", () => {
    expect(TEST_MANIFEST.version).toBe(MODEL_VERSION);
    expect(Number.isNaN(Date.parse(TEST_MANIFEST.generatedAt))).toBe(false);
  });
  it("records a green run at full coverage, or is the placeholder written while the run is in progress", () => {
    if (TEST_MANIFEST.totalTests === 0) return; // placeholder pass inside scripts/test-manifest.mjs
    expect(TEST_MANIFEST.failed).toBe(0);
    expect(TEST_MANIFEST.passed).toBe(TEST_MANIFEST.totalTests);
    expect(TEST_MANIFEST.files.reduce((s, f) => s + f.tests, 0)).toBe(TEST_MANIFEST.totalTests);
    expect(TEST_MANIFEST.coverage).toEqual({ lines: 100, functions: 100, branches: 100, statements: 100 });
  });
});
