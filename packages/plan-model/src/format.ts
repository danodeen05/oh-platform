import type { Currency, FxTable } from "./types";

export interface MoneyOptions {
  locale?: string;
  currency?: Currency;
  fx?: FxTable;
  /** Override the currency's default fraction digits. */
  fractionDigits?: number;
}

/** Convert a USD amount using the fixed illustrative table. USD is identity. */
export function convert(usd: number, currency: Currency, fx: FxTable): number {
  return usd * fx.rates[currency];
}

/** Full currency, e.g. "$4,201,425". Amounts are USD in; conversion happens here. */
export function fmtCurrency(usd: number, options: MoneyOptions = {}): string {
  const currency = options.currency ?? "USD";
  const value = options.fx ? convert(usd, currency, options.fx) : usd;
  // Whole units by default: a P&L in cents reads as false precision.
  const digits = options.fractionDigits ?? 0;
  return new Intl.NumberFormat(options.locale ?? "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Compact currency for headlines, e.g. "$4.2M". */
export function fmtCompact(usd: number, options: MoneyOptions = {}): string {
  const currency = options.currency ?? "USD";
  const value = options.fx ? convert(usd, currency, options.fx) : usd;
  return new Intl.NumberFormat(options.locale ?? "en-US", {
    style: "currency",
    currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: options.fractionDigits ?? 1,
  }).format(value);
}

/** 0.308 -> "30.8%". */
export function fmtPercent(ratio: number, locale = "en-US", fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

/** 6.47 -> "6.5x". Null (no debt) renders as an em-dash-free placeholder. */
export function fmtMultiple(value: number | null, locale = "en-US", fractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value)}x`;
}

/** Plain integer with grouping, e.g. covers per day. */
export function fmtInteger(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** 1.56 -> "1.6 yrs" style is a UI concern; this returns the rounded number for interpolation. */
export function fmtYears(value: number | null, locale = "en-US", fractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
}
