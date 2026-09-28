/**
 * Task D8: dates for the passport and its subpages. Always the locale's own
 * format and the restaurant's time zone (America/Denver), so a zh-TW reader
 * sees "2026年9月28日" and nobody sees a date shifted by their phone's zone.
 */
export const MEMBER_TZ = "America/Denver";

export function formatDate(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: MEMBER_TZ, year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: MEMBER_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMonthYear(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: MEMBER_TZ, year: "numeric", month: "long" }).format(new Date(value));
}

export { formatMoney } from "@/components/site/rewards/format";
