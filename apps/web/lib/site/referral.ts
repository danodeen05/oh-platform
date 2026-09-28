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

// ------------------------------------------------------------ sharing (Task D9)

/** A member's referral link. Locale-free, so the friend lands in their own language. */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/order?ref=${encodeURIComponent(code)}`;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/**
 * The phone's share sheet when there is one (`navigator.share`), else the
 * clipboard. Closing the share sheet is "cancelled" (no copy, no toast); a
 * share that fails for any other reason falls back to copying. "failed"
 * means neither worked, and the page selects the link to copy by hand.
 */
export async function shareOrCopy(nav: ShareNavigator | null | undefined, data: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (nav?.share && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return "shared";
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") return "cancelled";
    }
  }
  return copyText(nav, data.url);
}

export async function copyText(nav: ShareNavigator | null | undefined, text: string): Promise<ShareOutcome> {
  try {
    if (!nav?.clipboard?.writeText) return "failed";
    await nav.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
