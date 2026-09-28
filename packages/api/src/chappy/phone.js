/**
 * SMS caller identity (Task B2 fix round 1, controller ruling).
 *
 * A texter is a member only on an EXACT match of the Twilio From number and
 * User.phone, both normalized to E.164, and only when that member has opted
 * in to SMS (smsOptIn). A partial match (the old `contains`) is never an
 * identity: "5550100" must not become someone whose number ends in it.
 */

/**
 * E.164 for a phone number, or null. US numbers without a country code are
 * +1: "(801) 555-0100" and "801-555-0100" -> "+18015550100",
 * "18015550100" -> "+18015550100". "+44 20 7946 0958" -> "+442079460958".
 */
export function toE164(raw, defaultCountryCode = "1") {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 && digits[0] !== "0" ? `+${digits}` : null;
  if (s.startsWith("00")) return toE164(`+${digits.slice(2)}`);
  if (defaultCountryCode === "1") {
    if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits.slice(1))) return `+${digits}`;
    return null;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${defaultCountryCode}${digits}` : null;
}

/**
 * Users whose stored phone normalizes to exactly `e164`. Stored numbers are
 * free-form ("(801) 555-0100", "+18015550100"), so candidates are narrowed by
 * their last 4 digits (which formatting never splits in practice) and then
 * compared exactly after normalization. A number stored with a separator
 * inside its last 4 digits is not found: that fails closed (a guest).
 */
export async function usersWithPhone(prisma, e164) {
  if (!e164) return [];
  const candidates = await prisma.user.findMany({ where: { phone: { endsWith: e164.slice(-4) } } });
  return candidates.filter((u) => toE164(u.phone) === e164);
}

/** The opted-in member behind a Twilio From number, or null. */
export async function smsMemberFor(prisma, from) {
  const e164 = toE164(from);
  const matches = (await usersWithPhone(prisma, e164)).filter((u) => u.smsOptIn === true);
  // Two accounts normalizing to one number is ambiguous: treat the texter as a guest.
  return matches.length === 1 ? matches[0] : null;
}
