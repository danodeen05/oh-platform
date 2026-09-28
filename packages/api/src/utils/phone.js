/**
 * Phone normalization - the ONE E.164 helper the whole API uses.
 *
 * Originally introduced by Task B2 as `chappy/phone.js`'s `toE164` (SMS
 * caller identity: a texter is a member only on an EXACT E.164 match of the
 * Twilio From number and User.phone). Task F2 (fix round 1) moved it here so
 * every write of `User.phone`/`Guest.phone`, `sendSMS`, Chappy identity and
 * the backfill script all agree on the same rule - F2's first pass had
 * accidentally introduced a second, looser rule that disagreed with Chappy's,
 * which could store a number Chappy could never exact-match back.
 *
 * `chappy/phone.js` re-exports `normalizePhoneE164` as `toE164` so its own
 * callers (routes.js, limits.js) and tests are unaffected.
 *
 * Rule: US-centric default. A bare 10-digit number, or an 11-digit number
 * starting with "1", is treated as a US number and gets "+1" prepended - but
 * only when the area code (the first of those 10 digits) is 2-9: US/Canada
 * area codes never start with 0 or 1, so "0801555010" and a stray leading 1
 * are rejected rather than silently mis-parsed. An input starting with "+"
 * keeps only its digits and is rejected if the first digit is "0" (no
 * country code starts with 0) or if the digit count falls outside E.164's
 * 8-15 range. A "00" international-dialing prefix (no leading "+") is
 * treated the same as "+".
 */

const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

export function normalizePhoneE164(raw, defaultCountryCode = "1") {
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
