"use client";

/**
 * Task D8: Add to Apple Wallet / Google Wallet, carried over from the legacy
 * member dashboard. Pass downloads are plain navigations that can't carry an
 * Authorization header, so the page first asks the API for short-lived
 * signed links (GET /users/:id/wallet) and then opens one. The tab is
 * opened synchronously so popup blockers allow it. GET /wallet/status says
 * whether passes are configured; when neither is, a quiet note says so.
 */
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { SITE_API_URL, type SiteFetch } from "@/lib/site/api";

const BUTTON =
  "inline-flex min-h-12 flex-1 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border px-5 font-[inherit] text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export function WalletButtons({ api, userId, tone = "night" }: { api: SiteFetch; userId: string; tone?: "night" | "paper" }) {
  const t = useTranslations("passport.wallet");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${SITE_API_URL}/wallet/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setConfigured(Boolean(d?.apple?.configured || d?.google?.configured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function open(kind: "apple" | "google") {
    setError(false);
    const tab = window.open("", "_blank");
    try {
      const res = await api(`${SITE_API_URL}/users/${encodeURIComponent(userId)}/wallet`);
      const data = res.ok ? await res.json() : null;
      const link: string | undefined = data?.walletLinks?.[kind];
      // An unsigned link means the server has no CHAPPY_GUEST_SECRET: the download would 401.
      if (!link || !link.includes("sig=")) throw new Error("no signed wallet link");
      if (tab) tab.location.href = `${SITE_API_URL}${link}`;
      else window.location.href = `${SITE_API_URL}${link}`;
    } catch {
      tab?.close();
      setError(true);
    }
  }

  const night = tone === "night";
  const primary = night ? "border-oh-cream bg-oh-cream text-oh-ink hover:bg-oh-paper" : "border-oh-ink bg-oh-ink text-oh-cream hover:bg-oh-charcoal";
  const secondary = night
    ? "border-oh-cream/40 bg-transparent text-oh-cream hover:border-oh-cream hover:bg-oh-cream/10"
    : "border-oh-ink/40 bg-transparent text-oh-ink hover:border-oh-ink";

  return (
    <div data-wallet-buttons>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => open("apple")} className={`${BUTTON} ${primary}`}>
          <Icon name="wallet" size={20} />
          {t("apple")}
        </button>
        <button type="button" onClick={() => open("google")} className={`${BUTTON} ${secondary}`}>
          <Icon name="wallet" size={20} />
          {t("google")}
        </button>
      </div>
      <p role="status" className={`m-0 mt-3 min-h-5 text-sm ${night ? "text-oh-cream/70" : "text-oh-ink/75"}`}>
        {error ? t("unavailable") : configured === false ? t("soon") : ""}
      </p>
    </div>
  );
}
