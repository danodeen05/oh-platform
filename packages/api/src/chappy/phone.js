/**
 * SMS caller identity (Task B2 fix round 1, controller ruling).
 *
 * A texter is a member only on an EXACT match of the Twilio From number and
 * User.phone, both normalized to E.164, and only when that member has opted
 * in to SMS (smsOptIn). A partial match (the old `contains`) is never an
 * identity: "5550100" must not become someone whose number ends in it.
 */

// Task F2 fix round 1: this used to be its own copy of the E.164 rule, which
// had drifted from utils/phone.js's (looser) copy - a number F2 stored could
// then fail Chappy's exact match. `utils/phone.js` is now the one helper;
// `toE164` re-exports it under this module's original name so every existing
// caller/test here is unaffected.
import { normalizePhoneE164 as toE164 } from "../utils/phone.js";
export { toE164 };

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
