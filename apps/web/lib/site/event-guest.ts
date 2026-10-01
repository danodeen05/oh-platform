/**
 * Private events (/e/[slug]/rsvp): the guest form's rules, kept pure so they
 * are tested on their own. Errors are keys under `events.guest`.
 */

export interface GuestForm {
  name: string;
  phone: string;
  month: string;
  day: string;
  year: string;
}

export type GuestErrors = Partial<Record<"name" | "phone" | "birthday", "errorName" | "errorPhone" | "errorBirthday">>;

/** Digits only, without a leading US country code ("+1 (801) 555-0155" -> "8015550155"). */
export function phoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** Name required, a 10 digit phone, and a birthday that is either empty or a real month, day and year. */
export function validateGuest(f: GuestForm, now: Date = new Date()): GuestErrors {
  const errors: GuestErrors = {};
  if (!f.name.trim()) errors.name = "errorName";
  if (phoneDigits(f.phone).length !== 10) errors.phone = "errorPhone";
  const parts = [f.month, f.day, f.year].map((s) => s.trim());
  if (parts.some(Boolean)) {
    const [m, d, y] = parts.map(int);
    const fine = m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= now.getFullYear();
    if (!fine) errors.birthday = "errorBirthday";
  }
  return errors;
}

/** MM/DD/YYYY, or null when the birthday was left empty. */
export function joinDob(month: string, day: string, year: string): string | null {
  if (![month, day, year].some((s) => s.trim())) return null;
  return `${month.trim().padStart(2, "0")}/${day.trim().padStart(2, "0")}/${year.trim()}`;
}

/** The form's three boxes from a stored birthday (MM/DD/YYYY or an ISO date); empty boxes for anything else. */
export function splitDob(dob: string | null | undefined): { month: string; day: string; year: string } {
  const s = (dob ?? "").trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return { month: m[1].padStart(2, "0"), day: m[2].padStart(2, "0"), year: m[3] };
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return { month: m[2], day: m[3], year: m[1] };
  return { month: "", day: "", year: "" };
}
