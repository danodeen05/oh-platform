import { isScenarioKey } from "./assumptions/index";
import { isLeverKey, isWithinBounds } from "./levers";
import type { LeverKey, SharedScenario } from "./types";

/**
 * "Share my scenario" links (spec 6.1). The payload is versioned and every
 * value is validated against LEVER_BOUNDS on decode, so a stale or edited
 * link fails loudly instead of silently rendering wrong numbers.
 */
export const SHARE_VERSION = 1;

interface Payload {
  v: number;
  b: string;
  o: Record<string, number>;
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeScenario(shared: SharedScenario): string {
  const o: Record<string, number> = {};
  for (const [key, value] of Object.entries(shared.overrides)) {
    if (typeof value === "number") o[key] = value;
  }
  const payload: Payload = { v: SHARE_VERSION, b: shared.base, o };
  return toBase64Url(JSON.stringify(payload));
}

/** Returns null for anything that is not a valid, in-bounds, current-version payload. */
export function decodeScenario(text: string | null | undefined): SharedScenario | null {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(text));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p.v !== SHARE_VERSION) return null;
  if (typeof p.b !== "string" || !isScenarioKey(p.b)) return null;
  if (typeof p.o !== "object" || p.o === null || Array.isArray(p.o)) return null;
  const overrides: Partial<Record<LeverKey, number>> = {};
  for (const [key, value] of Object.entries(p.o as Record<string, unknown>)) {
    if (!isLeverKey(key)) return null;
    if (typeof value !== "number" || !isWithinBounds(key, value)) return null;
    overrides[key] = value;
  }
  return { base: p.b, overrides };
}
