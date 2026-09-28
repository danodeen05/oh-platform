/**
 * Referral attribution for the customer site (Task D5 fix round 1).
 *
 * A `?ref=CODE` link (/order?ref=...) stores the code under
 * `pendingReferralCode` in localStorage. Once the visitor is signed in, the
 * code is sent ONCE with POST /users `referredByCode`; the API applies it
 * (membership/engine.js applyReferralSignup: the referee's welcome credit,
 * the referrer's reward on the first paid order) only to a member with no
 * referrer yet, and ignores it otherwise. The key is then removed, whatever
 * the outcome, so it is never re-sent; a network failure keeps it for the
 * next page.
 */
export const PENDING_REFERRAL_KEY = "pendingReferralCode";

type StorageLike = Pick<Storage, "getItem" | "removeItem">;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type ReferralClaim = "none" | "applied" | "not-applied" | "failed";

export function pendingReferralCode(storage: StorageLike | null | undefined): string | null {
  try {
    const code = storage?.getItem(PENDING_REFERRAL_KEY)?.trim();
    return code ? code : null;
  } catch {
    return null;
  }
}

export async function claimPendingReferral(
  api: Fetcher,
  apiBase: string,
  who: { email: string; name?: string },
  storage: StorageLike | null | undefined,
): Promise<ReferralClaim> {
  const code = pendingReferralCode(storage);
  if (!code) return "none";
  let res: Response;
  try {
    res = await api(`${apiBase}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: who.email, name: who.name, referredByCode: code }),
    });
  } catch {
    return "failed";
  }
  if (res.status >= 500 || res.status === 429) return "failed";
  try {
    storage?.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    /* ignore */
  }
  if (!res.ok) return "not-applied";
  const body = await res.json().catch(() => null);
  return body?.referralJustApplied ? "applied" : "not-applied";
}
