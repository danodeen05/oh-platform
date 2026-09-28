import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIER_PATHS } from "../../../components/site/tiers/tier-paths";

// Task C2, Fix round 1 (owner's rule): the tier marks must be the owner's
// actual art, traced -- not a reinterpretation. This test is the guardrail:
// if apps/web/public/tiers/*.png ever changes without re-running
// scripts/trace-tier-marks.mjs, the sha256 baked into tier-paths.ts goes
// stale and this fails loudly instead of silently shipping outdated art.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIERS_DIR = path.resolve(__dirname, "../../../public/tiers");

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

describe("TIER_PATHS", () => {
  it.each(Object.entries(TIER_PATHS))("%s: sha256 matches the current PNG on disk", (tier, def) => {
    const pngPath = path.join(TIERS_DIR, `${tier}.png`);
    expect(def.sha256, `${tier}.png has changed since the last trace -- re-run scripts/trace-tier-marks.mjs`).toBe(
      sha256(pngPath),
    );
  });

  it.each(Object.entries(TIER_PATHS))("%s: path data is a real trace, not a placeholder", (_tier, def) => {
    // A hand-drawn stand-in (a few strokes) would be well under this; a
    // potrace output of the owner's actual bowl/chopsticks/horns art is
    // thousands of characters (see scripts/trace-tier-marks.mjs's own log).
    expect(def.d.length).toBeGreaterThan(500);
    expect(def.viewBox).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
  });
});
