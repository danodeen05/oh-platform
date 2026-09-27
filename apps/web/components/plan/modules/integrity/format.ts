import type { Band, RegistryUnit, RegistryValue } from "@oh/plan-model";

/** Suffix labels the register needs, translated by the caller. */
export interface UnitLabels {
  hours: string;
  days: string;
  minutes: string;
  months: string;
  years: string;
  oz: string;
  perYear: string;
  perMonth: string;
  perHour: string;
  perSqFt: string;
  perLb: string;
  yes: string;
  no: string;
}

const money = (v: number, locale: string, digits?: number): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: digits ?? (Number.isInteger(v) ? 0 : 2) }).format(v);
const num = (v: number, locale: string, digits = 2): string => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);

/** One registry value as the reader should see it. Strings pass through; booleans read yes or no. */
export function formatRegistryValue(value: RegistryValue, unit: RegistryUnit, locale: string, labels: UnitLabels): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? labels.yes : labels.no;
  switch (unit) {
    case "usd":
      return money(value, locale);
    case "usdPerYear":
      return `${money(value, locale)} ${labels.perYear}`;
    case "usdPerMonth":
      return `${money(value, locale)} ${labels.perMonth}`;
    case "usdPerHour":
      return `${money(value, locale, 2)} ${labels.perHour}`;
    case "usdPerSqFt":
      return `${money(value, locale)} ${labels.perSqFt}`;
    case "usdPerLb":
      return `${money(value, locale, 2)} ${labels.perLb}`;
    case "pct":
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
    case "hours":
      return `${num(value, locale)} ${labels.hours}`;
    case "days":
      return `${num(value, locale, 0)} ${labels.days}`;
    case "minutes":
      return `${num(value, locale)} ${labels.minutes}`;
    case "months":
      return `${num(value, locale)} ${labels.months}`;
    case "years":
      return `${num(value, locale)} ${labels.years}`;
    case "oz":
      return `${num(value, locale)} ${labels.oz}`;
    case "multiple":
      return `${num(value, locale)}x`;
    case "index":
    case "ratio":
      return num(value, locale, 3);
    case "count":
    case "flag":
    case "text":
    default:
      return num(value, locale, 2);
  }
}

/** A scorecard value in its own unit. */
export function formatBenchmarkValue(value: number | null, unit: "pct" | "usd" | "years" | "multiple" | "ratio", locale: string): string {
  if (value === null || !Number.isFinite(value)) return "–";
  switch (unit) {
    case "pct":
    case "ratio":
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
    case "usd":
      return money(value, locale, 0);
    case "years":
      return num(value, locale, 1);
    case "multiple":
      return `${num(value, locale, 1)}x`;
    default:
      return num(value, locale);
  }
}

/** "12 to 28%", "$450 to $1,000", "1.5 to 3", "2.5x to 4x". */
export function formatBenchmarkBand(band: Band, unit: "pct" | "usd" | "years" | "multiple" | "ratio", locale: string, to: string): string {
  if (unit === "pct" || unit === "ratio") {
    const p = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v * 100);
    return `${p(band.min)} ${to} ${p(band.max)}%`;
  }
  return `${formatBenchmarkValue(band.min, unit, locale)} ${to} ${formatBenchmarkValue(band.max, unit, locale)}`;
}

/** A change-log before/after cell: numbers by unit hint, strings as written, null as a dash. */
export function formatChangeValue(value: number | string | null, unit: string, locale: string): string {
  if (value === null) return "–";
  if (typeof value === "string") return value;
  if (unit === "pct") return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
  if (unit === "usd" || unit === "usd/hour") return money(value, locale) + (unit === "usd/hour" ? "/hr" : "");
  return num(value, locale, 4);
}
