/**
 * Locales the plan ships complete (spec 7.4). Other site locales fall back to
 * English key by key (see i18n/request.ts) but are hidden from the plan's
 * switcher, because a half-translated P&L damages credibility.
 */
export const PLAN_LOCALES = ["en", "zh-TW"] as const;
export type PlanLocale = (typeof PLAN_LOCALES)[number];

export function isPlanLocale(value: string): value is PlanLocale {
  return (PLAN_LOCALES as readonly string[]).includes(value);
}

/** Replace the leading locale segment of a site path. */
export function swapLocale(pathname: string, locale: string): string {
  const m = pathname.match(/^\/(en|zh-TW|zh-CN|es)(?=\/|$)/);
  return m ? `/${locale}${pathname.slice(m[0].length)}` : `/${locale}${pathname}`;
}
