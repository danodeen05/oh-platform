"use client";

/**
 * Task D8: the signed-in member's passport data.
 *
 * One GET /users/:id/profile (the Clerk token via lib/site/api.ts; the API
 * checks requireSelf) gives everything the passport shows: the membership
 * engine's `membership` block (profileForUser: tier, progress, credits,
 * expiring lots, active rewards, badges and the moment flags) plus the
 * member's own row (name, referral code, streaks, joined date).
 *
 * `postMoments` records the welcome and tier-up moments
 * (POST /users/:id/moments).
 */
import { useCallback, useEffect, useState } from "react";
import { SITE_API_URL, useMemberId, useSiteApi, type SiteFetch } from "@/lib/site/api";

export interface ProgressCount {
  have: number;
  need: number;
}

export interface MemberReward {
  id: string;
  type: "FREE_BOWL" | "PREMIUM_ADDON" | string;
  issuedFor: string;
  windowEndsAt: string;
}

export interface ExpiringLot {
  id: string;
  remainingCents: number;
  expiresAt: string;
}

export interface PassportProfile {
  userId: string;
  name: string | null;
  referralCode: string | null;
  joinedAt: string | null;
  referredById: string | null;
  currentStreak: number;
  longestStreak: number;
  lifetimeOrderCount: number;
  tier: string;
  cashbackPct: number;
  progress: { tier: string; next: string | null; orders: ProgressCount; referrals: ProgressCount; ready: boolean };
  creditsCents: number;
  expiring: ExpiringLot[];
  rewards: MemberReward[];
  earnedSlugs: string[];
  flags: { welcomeSeenAt: string | null; lastTierCelebrated: string | null };
}

export type PassportState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error" }
  | { status: "ready"; profile: PassportProfile };

/** fetch through `api`, retrying a 429 or a network failure with a short backoff. */
export async function fetchWithRetry(api: SiteFetch, url: string, init?: RequestInit, tries = 4): Promise<Response> {
  let last: unknown = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await api(url, init);
      if (res.status !== 429) return res;
      last = new Error("429");
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 600 * 2 ** i));
  }
  throw last instanceof Error ? last : new Error("request failed");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toProfile(userId: string, body: any): PassportProfile {
  const m = body?.membership ?? {};
  const badges: any[] = m.badges ?? [];
  const earned = badges
    .slice()
    .sort((a, b) => new Date(a.earnedAt ?? 0).getTime() - new Date(b.earnedAt ?? 0).getTime())
    .map((b) => b?.badge?.slug)
    .filter((s: unknown): s is string => typeof s === "string");
  const zero = { have: 0, need: 0 };
  return {
    userId,
    name: body?.name ?? null,
    referralCode: body?.referralCode ?? null,
    joinedAt: body?.createdAt ?? null,
    referredById: body?.referredById ?? null,
    currentStreak: body?.currentStreak ?? 0,
    longestStreak: body?.longestStreak ?? 0,
    lifetimeOrderCount: body?.lifetimeOrderCount ?? 0,
    tier: m.tier ?? body?.membershipTier ?? "CHOPSTICK",
    cashbackPct: m.cashbackPct ?? 0,
    progress: {
      tier: m.progress?.tier ?? m.tier ?? "CHOPSTICK",
      next: m.progress?.next ?? null,
      orders: m.progress?.orders ?? zero,
      referrals: m.progress?.referrals ?? zero,
      ready: Boolean(m.progress?.ready),
    },
    creditsCents: typeof m.credits === "number" ? m.credits : (body?.creditsCents ?? 0),
    expiring: Array.isArray(m.expiring) ? m.expiring : [],
    rewards: Array.isArray(m.rewards) ? m.rewards : [],
    earnedSlugs: earned,
    flags: {
      welcomeSeenAt: m.flags?.welcomeSeenAt ?? null,
      lastTierCelebrated: m.flags?.lastTierCelebrated ?? null,
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function usePassport() {
  const { userId, ready, signedIn } = useMemberId();
  const api = useSiteApi();
  const [state, setState] = useState<PassportState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!signedIn) {
      setState({ status: "signedOut" });
      return;
    }
    if (!userId) {
      setState({ status: "error" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const res = await fetchWithRetry(api, `${SITE_API_URL}/users/${encodeURIComponent(userId)}/profile`);
        if (!res.ok) throw new Error(String(res.status));
        const profile = toProfile(userId, await res.json());
        if (!cancelled) setState({ status: "ready", profile });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `api` changes identity with Clerk's getToken; the member id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, userId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const postMoments = useCallback(
    async (body: { welcomeSeen?: true; tierCelebrated?: string }) => {
      if (!userId) return false;
      try {
        const res = await fetchWithRetry(api, `${SITE_API_URL}/users/${encodeURIComponent(userId)}/moments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [api, userId],
  );

  return { state, retry, postMoments, api, userId };
}
