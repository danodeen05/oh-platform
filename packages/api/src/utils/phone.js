/**
 * Phone normalization (Task F2): every write of `User.phone` or `Guest.phone`
 * stores E.164 so Chappy SMS can match identity by exact string equality
 * instead of a loose digit-suffix comparison.
 *
 * US-centric default (the only market today): a bare 10-digit number is
 * assumed to be a US number and gets `+1` prepended; an 11-digit number
 * starting with "1" is treated the same way. Anything already starting with
 * "+" keeps only its digits (so formatting like spaces/dashes/parens is
 * stripped but the country code is trusted as given). Anything that doesn't
 * reduce to a plausible E.164 number returns null - callers decide whether
 * that's a hard error (400 INVALID_PHONE) or just "no phone on file".
 */

// E.164 allows at most 15 digits after the "+". A national significant
// number is never shorter than a few digits, so require at least 8 total to
// reject obvious garbage like "+1" or "+123".
const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

export function normalizePhoneE164(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) return null;
    return `+${digits}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
