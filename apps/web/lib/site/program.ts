/**
 * The public membership program (GET /membership/program), for server
 * components (Task D9: the referral and challenges pages). The referral
 * amounts, the 30-day cap and the credit expiry all come from here, never
 * from page copy.
 *
 * FALLBACK mirrors packages/api/src/membership/program.js and is used only
 * when the API can't be reached, so the page still renders with the
 * program's real values rather than blanks.
 */
import { API_URL } from "@/lib/api";

export type ReferralProgram = { referrerCents: number; refereeCents: number; maxPaidPer30Days: number; creditExpiryDays: number };

export const REFERRAL_PROGRAM_FALLBACK: ReferralProgram = { referrerCents: 500, refereeCents: 500, maxPaidPer30Days: 10, creditExpiryDays: 90 };

const int = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : d);

export function referralProgramFrom(body: unknown): ReferralProgram {
  const b = (body && typeof body === "object" ? body : {}) as { referral?: Record<string, unknown>; creditExpiryDays?: unknown };
  const r = b.referral || {};
  const f = REFERRAL_PROGRAM_FALLBACK;
  return {
    referrerCents: int(r.referrerCents, f.referrerCents),
    refereeCents: int(r.refereeCents, f.refereeCents),
    maxPaidPer30Days: int(r.maxPaidPer30Days, f.maxPaidPer30Days),
    creditExpiryDays: int(b.creditExpiryDays, f.creditExpiryDays),
  };
}

export async function getReferralProgram(): Promise<ReferralProgram> {
  try {
    const res = await fetch(`${API_URL}/membership/program`, { cache: "no-store", headers: { "x-tenant-slug": "oh" } });
    if (!res.ok) return REFERRAL_PROGRAM_FALLBACK;
    return referralProgramFrom(await res.json());
  } catch {
    return REFERRAL_PROGRAM_FALLBACK;
  }
}

/** Whole dollars when there are no cents ("$5"), else two decimals ("$15.99"). */
export function formatMoney(cents: number, locale: string): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
