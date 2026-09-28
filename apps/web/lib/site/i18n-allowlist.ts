/**
 * Words that may appear untranslated in every locale (Task C5): brand and
 * product names, payment brands, units, the pod label pattern, and the
 * language switcher's own endonyms. Used by the literal-JSX guard
 * (lib/site/__tests__/no-literal-jsx.test.ts) and the English-leak crawl
 * (tests/e2e/site/english-leak.spec.ts).
 *
 * Keep this short. Anything added here ships untranslated to zh-TW, zh-CN
 * and es readers, so it must genuinely be a name, a unit or a code.
 */

/** Literal terms, matched case-sensitively as whole words. Longest first matters for multi-word terms. */
export const I18N_ALLOWLIST_TERMS = [
  "Oh! Beef Noodle Soup",
  // The foundation's registered name, which it doesn't translate (Task D1's
  // One Red Step chapter; the plan's zh-TW copy keeps it in English too).
  "ONE RED STEP AT A TIME",
  "Apple Pay",
  "Google Pay",
  // Wallet brands as Apple and Google localize them (Task D8): "加入 Apple 錢包",
  // "新增至 Google 錢包", "Añadir a Apple Wallet".
  "Apple Wallet",
  "Google Wallet",
  "Apple",
  "Google",
  "Oh!",
  "Wagyu",
  "Chappy",
  "Stripe",
  "QR",
  "oz",
  "mi",
  // The locale switcher's own language names (endonyms, see i18n/config.ts).
  "English",
  "Español",
] as const;

/** Patterns that are codes, not words. */
export const I18N_ALLOWLIST_PATTERNS: readonly RegExp[] = [
  // Pod labels: finger letter A/B/C and the 2-digit position, e.g. B-07.
  /\b[A-C]-\d{2}\b/g,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A term counts only as a whole word: "mi" must not eat the "mi" in "minute".
const TERM_RES = [...I18N_ALLOWLIST_TERMS]
  .sort((a, b) => b.length - a.length)
  .map((t) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t)}(?![\\p{L}\\p{N}])`, "gu"));

/** Remove every allowlisted term and pattern from `text`. */
export function stripAllowlisted(text: string): string {
  let out = text;
  for (const re of TERM_RES) out = out.replace(re, " ");
  for (const re of I18N_ALLOWLIST_PATTERNS) out = out.replace(re, " ");
  return out;
}

/** Remove digits and currency amounts/symbols (prices, counts, times). */
export function stripNumbersAndCurrency(text: string): string {
  return text.replace(/[$€£¥]\s?\d[\d,.]*/g, " ").replace(/\d+/g, " ").replace(/[$€£¥]/g, " ");
}

/** Latin words of 3+ letters left after the allowlist, digits and currency are removed. */
export function englishLeaks(text: string): string[] {
  const rest = stripNumbersAndCurrency(stripAllowlisted(text));
  return rest.match(/[A-Za-z]{3,}/g) ?? [];
}
