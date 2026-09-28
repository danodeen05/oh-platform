"use client";

/**
 * Task D7: the signed-in member's place on the rewards page. One
 * GET /users/:id/profile (Clerk token via lib/site/api.ts) feeds the climb's
 * "you are here", the hero status line, the referral link and the earned
 * seals. Signed out, everything on the page still works; this just says so.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";

export interface MemberProgress {
  tier: string;
  next: string | null;
  orders: { have: number; need: number };
  referrals: { have: number; need: number };
}

export type RewardsMemberState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error" }
  | {
      status: "ready";
      tier: string;
      cashbackPct: number | null;
      progress: MemberProgress | null;
      referralCode: string | null;
      earnedSlugs: Set<string>;
    };

const Ctx = createContext<RewardsMemberState>({ status: "loading" });

export function useRewardsMember(): RewardsMemberState {
  return useContext(Ctx);
}

interface ProfileBody {
  referralCode?: string | null;
  membership?: {
    tier?: string;
    cashbackPct?: number;
    progress?: MemberProgress;
    badges?: Array<{ badge?: { slug?: string } | null }>;
  };
  badges?: Array<{ badge?: { slug?: string } | null }>;
}

export function RewardsMemberProvider({ children }: { children: ReactNode }) {
  const { userId, ready, signedIn } = useMemberId();
  const api = useSiteApi();
  const [state, setState] = useState<RewardsMemberState>({ status: "loading" });

  useEffect(() => {
    if (!ready) return;
    if (!signedIn || !userId) {
      setState(signedIn ? { status: "error" } : { status: "signedOut" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api(`${SITE_API_URL}/users/${encodeURIComponent(userId)}/profile`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as ProfileBody;
        const m = body.membership ?? {};
        const badgeRows = m.badges ?? body.badges ?? [];
        const earnedSlugs = new Set(badgeRows.map((b) => b.badge?.slug).filter((s): s is string => Boolean(s)));
        if (!cancelled) {
          setState({
            status: "ready",
            tier: m.tier ?? m.progress?.tier ?? "CHOPSTICK",
            cashbackPct: m.cashbackPct ?? null,
            progress: m.progress ?? null,
            referralCode: body.referralCode ?? null,
            earnedSlugs,
          });
        }
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `api` changes identity with Clerk's getToken; the member id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, userId]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
