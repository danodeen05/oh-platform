"use client";

/**
 * `renderCard(card)` (Task E2): the native card for each type the API's
 * tools emit, or E1's translated fallback box for a type (or a payload)
 * this build can't show.
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cardKey, type ChappyCard } from "../stream";
import { CardFrame } from "./CardKit";
import { CartCard } from "./CartCard";
import { ConfirmZeroCard } from "./ConfirmZeroCard";
import { GroupShareCard } from "./GroupShareCard";
import { MenuItemCard } from "./MenuItemCard";
import { OrderTrackerCard } from "./OrderTrackerCard";
import { PayCard } from "./PayCard";
import { PodCard } from "./PodCard";
import { RewardCard } from "./RewardCard";
import { SignInCard } from "./SignInCard";
import { SupportCaseCard } from "./SupportCaseCard";
import { parseCard } from "./types";

export function renderCard(card: ChappyCard): ReactNode {
  const native = parseCard(card);
  if (!native) return <FallbackCard card={card} />;
  switch (native.type) {
    case "pay":
      return <PayCard card={native} />;
    case "confirm-zero":
      return <ConfirmZeroCard card={native} />;
    case "sign-in":
      return <SignInCard />;
    case "cart":
      return <CartCard card={native} />;
    case "menu-item":
      return <MenuItemCard card={native} />;
    case "order-status":
      return <OrderTrackerCard card={native} />;
    case "reward":
      return <RewardCard card={native} />;
    case "pod-call":
      return <PodCard card={native} />;
    case "support-case":
      return <SupportCaseCard card={native} />;
    case "group-share":
      return <GroupShareCard card={native} />;
  }
}

/** E1's stand-in, kept for a card type (or payload) this build can't render natively. */
export function FallbackCard({ card }: { card: ChappyCard }) {
  const t = useTranslations("chappyWeb");
  const key = cardKey(card.type);
  return (
    <CardFrame type={card.type} label={t(`cards.${key}.title`)} className="px-4 py-3">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-oh-ember-light">{t(`cards.${key}.title`)}</p>
      <p className="m-0 mt-1 text-sm leading-snug text-oh-cream/90">{t(`cards.${key}.body`)}</p>
    </CardFrame>
  );
}
