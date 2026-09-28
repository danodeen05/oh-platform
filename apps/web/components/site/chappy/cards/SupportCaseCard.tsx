"use client";

/**
 * A support case Chappy opened (Task E2): what kind it is, its short
 * reference, and any goodwill granted with it. Goodwill is STORE CREDIT
 * (a CreditLot inside the owner's caps), so the card says store credit;
 * it never talks about money going back to a card. A refund request names
 * no amount: staff decide.
 */
import { useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { CardFrame, Eyebrow, money, useCardContext } from "./CardKit";
import type { SupportCaseCardData } from "./types";

export function SupportCaseCard({ card }: { card: SupportCaseCardData }) {
  const t = useTranslations("chappyWeb.cards");
  const { locale } = useCardContext();
  const ref = card.caseId.slice(-6).toUpperCase();
  const title = card.kind === "refund" ? t("supportCase.refundTitle") : card.kind === "escalation" ? t("supportCase.escalationTitle") : t("supportCase.title");
  const body = card.kind === "refund" ? t("supportCase.refundBody") : card.kind === "escalation" ? t("supportCase.escalationBody") : t("supportCase.body");
  const credit = card.kind === "issue" && card.goodwillCents > 0 ? card.goodwillCents : 0;

  return (
    <CardFrame type="support-case" label={t("supportCase.label")}>
      <div className="flex items-start gap-3 p-4">
        <Icon name="seal" size={24} className="mt-0.5 shrink-0 text-oh-ember-light" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Eyebrow>{title}</Eyebrow>
            <p className="m-0 text-xs tabular-nums tracking-[0.08em] text-oh-mute">{t("supportCase.ref", { ref })}</p>
          </div>
          <p className="m-0 mt-1.5 text-[0.95rem] leading-snug text-oh-cream/85">{body}</p>
        </div>
      </div>
      {credit ? (
        <div data-goodwill-cents={credit} className="flex items-start gap-3 bg-oh-olive/20 px-4 py-3">
          <Icon name="wallet" size={22} className="mt-0.5 shrink-0 text-oh-olive-light" />
          <div className="min-w-0">
            <p className="m-0 text-base font-semibold text-oh-cream">{t("supportCase.creditTitle", { amount: money(credit, locale) })}</p>
            <p className="m-0 mt-0.5 text-sm leading-snug text-oh-cream/75">{t("supportCase.creditBody")}</p>
          </div>
        </div>
      ) : null}
    </CardFrame>
  );
}
