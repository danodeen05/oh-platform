/**
 * Client-side mirror of packages/api/src/utils/phone.js's `normalizePhoneE164`
 * - the one E.164 rule the whole site agrees on (Task F2 fix round 1,
 * controller ruling 1 and 2).
 *
 * Used to validate an optional phone field BEFORE a Stripe charge runs, so a
 * guest is never billed and then blocked by the server's 400 `INVALID_PHONE`
 * while saving their contact details (the server still re-validates on
 * write; this is a UX pre-check, not the only enforcement). Keep this in
 * sync with the server copy if the rule ever changes - there's no shared
 * package between `apps/web` and `packages/api` for a pure string helper
 * this small.
 */

const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

export function normalizePhoneE164(raw: string | null | undefined, defaultCountryCode = "1"): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim();
  if (!s) return null;

  const digits = s.replace(/\D/g, "");

  if (s.startsWith("+")) {
    return digits.length >= MIN_E164_DIGITS && digits.length <= MAX_E164_DIGITS && digits[0] !== "0" ? `+${digits}` : null;
  }
  if (s.startsWith("00")) return normalizePhoneE164(`+${digits.slice(2)}`, defaultCountryCode);

  if (defaultCountryCode === "1") {
    if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits.slice(1))) return `+${digits}`;
    return null;
  }
  return digits.length >= MIN_E164_DIGITS && digits.length <= MAX_E164_DIGITS ? `+${defaultCountryCode}${digits}` : null;
}

/** True when `raw` is blank (phone is optional at every checkout that uses this) or normalizes cleanly. */
export function isValidOptionalPhone(raw: string | null | undefined): boolean {
  if (raw == null || String(raw).trim() === "") return true;
  return normalizePhoneE164(raw) !== null;
}
