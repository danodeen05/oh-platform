/**
 * Task D7: money for the rewards page. USD with the bare "$" in every
 * locale (zh-TW's default "US$" reads as English), and no cents on whole
 * dollars ("$5", "$17.99").
 */
export function formatMoney(cents: number, locale: string): string {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/** Section anchors, in page order. The e2e spec and the hero CTA use these ids. */
export const REWARDS_SECTIONS = ["climb", "tiers", "simulator", "credits", "referrals", "seals", "challenges", "faq"] as const;
