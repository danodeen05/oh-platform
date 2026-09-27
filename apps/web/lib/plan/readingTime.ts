import type { SectionKey } from "./sections";

/**
 * Reading time per section, estimated from the section's own copy in the
 * messages file at request time (no build step). Latin scripts read at about
 * 200 words a minute; Chinese at about 350 characters a minute.
 */
export const SECTION_NAMESPACES: Record<SectionKey, readonly string[]> = {
  summary: ["summary"],
  model: ["model"],
  experience: ["experience"],
  market: ["market"],
  "floor-plan": ["floorPlan"],
  operations: ["operations"],
  expansion: ["expansion"],
  "unit-economics": ["unitEconomics"],
  financials: ["financials"],
  sensitivity: ["sensitivity"],
  team: ["team"],
  funding: ["funding"],
  roadmap: ["roadmap"],
  integrity: ["integrity"],
};

type Messages = Record<string, unknown>;

/** Every string value under a message subtree, joined by spaces. */
export function collectText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (node && typeof node === "object") return Object.values(node as Messages).map(collectText).join(" ");
  return "";
}

export function countWords(text: string): number {
  const cleaned = text.replace(/\{[^}]*\}/g, " ").replace(/<[^>]*>/g, " ");
  return cleaned.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** CJK characters are read per character, not per word. */
export function countCjk(text: string): number {
  return (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
}

export function readingMinutes(text: string, locale: string): number {
  const minutes = locale.startsWith("zh") ? countCjk(text) / 350 + countWords(text.replace(/[㐀-鿿豈-﫿]/g, " ")) / 200 : countWords(text) / 200;
  return Math.max(1, Math.round(minutes));
}

/** Minutes for one section, from the `plan` subtree of the loaded messages. */
export function sectionReadingMinutes(planMessages: Messages, key: SectionKey, locale: string): number {
  const text = SECTION_NAMESPACES[key].map((ns) => collectText(planMessages[ns])).join(" ");
  return readingMinutes(text, locale);
}
