/**
 * Access-code generation for the interactive business plan.
 *
 * Format: OH-<WORD>-<4 digits>, e.g. "OH-KESTREL-7742".
 * Words are unambiguous when read aloud over the phone (no homophones,
 * no letters that look alike in most typefaces).
 */

import crypto from "node:crypto";

export const CODE_WORDS = Object.freeze([
  "ACORN", "ALPINE", "AMBER", "ANCHOR", "ARROW", "ASPEN", "ATLAS", "AURORA",
  "BADGER", "BAMBOO", "BANNER", "BARLEY", "BEACON", "BIRCH", "BISON", "BOULDER",
  "BRIDGE", "BRONZE", "CANYON", "CARBON", "CEDAR", "CINDER", "CITRUS", "CLOVER",
  "COBALT", "COMET", "COMPASS", "CONDOR", "COPPER", "CORAL", "CRANE", "CRYSTAL",
  "DELTA", "DUNE", "EAGLE", "EMBER", "FALCON", "FERN", "FINCH", "FJORD",
  "FLINT", "FOREST", "GARNET", "GLACIER", "GRANITE", "HARBOR", "HAWK", "HAZEL",
  "HERON", "IRIS", "IVORY", "JADE", "JASPER", "JUNIPER", "KESTREL", "LANTERN",
  "LAUREL", "LINEN", "LOTUS", "MAGNET", "MAPLE", "MARBLE", "MEADOW", "MESA",
  "MOSS", "NOODLE", "NORTH", "OASIS", "OLIVE", "ONYX", "ORBIT", "ORCHID",
  "OSPREY", "OTTER", "PEBBLE", "PEPPER", "PINE", "PLUM", "PRAIRIE", "QUARTZ",
  "RAVEN", "RIDGE", "RIVER", "ROBIN", "SADDLE", "SAFFRON", "SALMON", "SEQUOIA",
  "SESAME", "SIERRA", "SILVER", "SPRUCE", "SUMMIT", "TEAK", "TIMBER", "TOPAZ",
  "TUNDRA", "VALLEY", "VELVET", "WALNUT", "WILLOW", "WREN", "ZENITH", "ZEPHYR",
]);

/** Generate one candidate code. Digits are drawn from crypto, never Math.random. */
export function generateCode() {
  const word = CODE_WORDS[crypto.randomInt(0, CODE_WORDS.length)];
  const digits = String(crypto.randomInt(1000, 10000));
  return `OH-${word}-${digits}`;
}

/** Normalize user input so "oh kestrel 7742" and "OH-KESTREL-7742" match. */
export function normalizeCode(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32);
}

/** Constant-time comparison of two strings (used for the shared API key). */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
