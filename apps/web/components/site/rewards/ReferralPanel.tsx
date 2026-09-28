"use client";

/**
 * Task D7: referrals. The offer and the cap come from the program. Signed
 * in, the member's own link (from their profile's referral code) with the
 * native share sheet where there is one, and a copy button either way.
 * Signed out, Clerk's sign-in modal.
 */
import { SignInButton } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import type { PublicProgram } from "@/lib/site/program";
import { formatMoney } from "./format";
import { useRewardsMember } from "./RewardsMember";

const PRIMARY =
  "inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const QUIET =
  "inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export function ReferralPanel({ program }: { program: PublicProgram }) {
  const t = useTranslations("rewards.referrals");
  const locale = useLocale();
  const member = useRewardsMember();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [canShare, setCanShare] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setOrigin(window.location.origin);
  }, []);

  const referee = formatMoney(program.referral.refereeCents, locale);
  const code = member.status === "ready" ? member.referralCode : null;
  const link = code && origin ? `${origin}/order?ref=${encodeURIComponent(code)}` : null;

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  async function share() {
    if (!link) return;
    if (canShare) {
      try {
        await navigator.share({ title: t("shareTitle"), text: t("shareText", { amount: referee }), url: link });
        return;
      } catch (err) {
        // The member closed the share sheet: nothing to do.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copy();
  }

  let action: React.ReactNode;
  if (member.status === "loading") {
    action = <p className="m-0 min-h-12 text-base text-oh-cream/60">{t("loading")}</p>;
  } else if (member.status === "signedOut") {
    action = (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="m-0 text-base text-oh-cream/80">{t("signedOut")}</p>
        <SignInButton mode="modal">
          <button type="button" data-referral-signin className={PRIMARY}>
            {t("signIn")}
          </button>
        </SignInButton>
      </div>
    );
  } else if (!link) {
    action = <p className="m-0 text-base text-oh-cream/70">{t("unavailable")}</p>;
  } else {
    action = (
      <div className="min-w-0">
        <p className="m-0 text-sm text-oh-cream/70">{t("yourLink")}</p>
        <p
          data-referral-link
          className="m-0 mt-1.5 select-all break-all rounded-xl bg-oh-charcoal px-4 py-3 font-mono text-sm text-oh-cream"
        >
          {link}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={share} className={PRIMARY}>
            <Icon name="share" size={20} />
            {t("share")}
          </button>
          <button type="button" onClick={copy} className={QUIET}>
            {t("copy")}
          </button>
        </div>
        <p className="m-0 mt-2 min-h-6 text-sm text-oh-cream/75" aria-live="polite">
          {status === "copied" ? t("copied") : status === "failed" ? t("copyFailed") : ""}
        </p>
      </div>
    );
  }

  return <div data-referral-action>{action}</div>;
}
