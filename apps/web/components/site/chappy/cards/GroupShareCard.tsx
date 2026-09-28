"use client";

/**
 * A group order to pass around the table (Task E2): the code, large, and
 * the link through the phone's own share sheet (navigator.share) or the
 * clipboard where there is none.
 */
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { CardFrame, Eyebrow, PrimaryButton, QuietButton } from "./CardKit";
import type { GroupShareCardData } from "./types";

export function GroupShareCard({ card }: { card: GroupShareCardData }) {
  const t = useTranslations("chappyWeb.cards");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const link = card.url ?? "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link || card.code);
      setCopied(true);
    } catch {
      /* clipboard blocked: the code is on screen to read out */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ text: t("groupShare.shareText", { code: card.code }), ...(link ? { url: link } : {}) });
    } catch {
      /* dismissed */
    }
  };

  return (
    <CardFrame type="group-share" label={t("groupShare.label")}>
      <div className="p-4">
        <Eyebrow>{t("groupShare.title")}</Eyebrow>
        <p className="m-0 mt-1 text-sm leading-snug text-oh-cream/80">{t("groupShare.body")}</p>
        <p className="m-0 mt-3 text-xs text-oh-mute">{t("groupShare.code")}</p>
        <p data-group-code translate="no" className="font-display m-0 text-[2.4rem] leading-tight tracking-[0.2em] tabular-nums text-oh-cream">
          {card.code}
        </p>
        <div className="mt-4 grid gap-2">
          {canShare ? (
            <PrimaryButton onClick={() => void share()}>
              <span className="inline-flex items-center gap-2">
                <Icon name="share" size={18} />
                {t("groupShare.share")}
              </span>
            </PrimaryButton>
          ) : null}
          <div className="flex gap-2">
            {link ? (
              <QuietButton onClick={() => void copy()} className="flex-1">
                <span aria-live="polite">{copied ? t("groupShare.copied") : t("groupShare.copy")}</span>
              </QuietButton>
            ) : null}
            {link ? (
              <a
                href={link}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-solid border-oh-stone px-4 text-sm font-semibold text-oh-cream no-underline hover:border-oh-ash hover:bg-oh-stone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
              >
                {t("groupShare.open")}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </CardFrame>
  );
}
