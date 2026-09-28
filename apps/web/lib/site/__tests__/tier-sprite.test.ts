/**
 * Task G2a: the tier-mark sprite (public/tiers/marks.svg) and its generated
 * index (tier-sprite.ts) must match the traced paths in tier-paths.ts, so a
 * re-trace without re-running scripts/build-tier-sprite.mjs fails here
 * instead of shipping stale marks.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TIER_PATHS } from "../../../components/site/tiers/tier-paths";
import { TIER_INLINE_PATHS, TIER_SPRITE_URL, TIER_VIEWBOX } from "../../../components/site/tiers/tier-sprite";

const SPRITE = readFileSync(path.resolve(__dirname, "../../../public/tiers/marks.svg"), "utf8");
const round = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map((n) => Math.round(Number(n) * 10) / 10);

describe("tier sprite (Task G2a)", () => {
  it("is versioned by its own content", () => {
    const v = createHash("sha256").update(SPRITE).digest("hex").slice(0, 10);
    expect(TIER_SPRITE_URL).toBe(`/tiers/marks.svg?v=${v}`);
  });

  it("covers every tier exactly once: inline, or as a sprite symbol with the traced viewBox", () => {
    for (const [tier, def] of Object.entries(TIER_PATHS)) {
      expect(TIER_VIEWBOX[tier as keyof typeof TIER_VIEWBOX]).toBe(def.viewBox);
      const inline = TIER_INLINE_PATHS[tier as keyof typeof TIER_INLINE_PATHS];
      const symbol = SPRITE.match(new RegExp(`<symbol id="${tier}" viewBox="([^"]+)"><path d="([^"]+)" fill-rule="evenodd"/></symbol>`));
      if (inline) {
        expect(inline, tier).toBe(def.d);
        expect(symbol, `${tier} is inline, so not in the sprite`).toBeNull();
      } else {
        expect(symbol, `${tier} missing from marks.svg`).not.toBeNull();
        expect(symbol![1]).toBe(def.viewBox);
        // Same trace, coordinates to 0.1 of a unit.
        expect(round(symbol![2])).toEqual(round(def.d));
      }
    }
  });

  it("keeps the dock's mark inline (no file request on every page)", () => {
    expect(TIER_INLINE_PATHS.chopstick).toBeDefined();
  });
});
