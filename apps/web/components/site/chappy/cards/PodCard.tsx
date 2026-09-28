"use client";

/**
 * Staff are coming to the pod (Task E2): report_issue while the customer is
 * seated calls staff instead of opening a case. The pod label is the hero.
 */
import { useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { CardFrame, Eyebrow, podText, useCardContext } from "./CardKit";
import type { PodCallCardData } from "./types";

export function PodCard({ card }: { card: PodCallCardData }) {
  const t = useTranslations("chappyWeb.cards.podCall");
  const tc = useTranslations("chappyWeb.cards");
  const { cjk } = useCardContext();
  const pod = card.pod ? podText(card.pod) : null;
  const body = pod ? (card.again ? t("again", { pod }) : t("bodyPod", { pod })) : card.again ? t("againNoPod") : tc("podCall.body");

  return (
    <CardFrame type="pod-call" label={t("label")}>
      <div className="flex items-center gap-4 p-4">
        <span className="chappy-pod-call relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-oh-charcoal text-oh-ember-light">
          <Icon name="pod" size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow>{tc("podCall.title")}</Eyebrow>
          {card.pod ? <p className={`${cjk ? "font-display-cjk" : "font-display"} m-0 mt-0.5 text-3xl leading-none tabular-nums text-oh-cream`}>{pod}</p> : null}
          <p role="status" className="m-0 mt-1.5 text-sm leading-snug text-oh-cream/80">
            {body}
          </p>
        </div>
      </div>
    </CardFrame>
  );
}
