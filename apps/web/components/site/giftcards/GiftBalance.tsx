"use client";

/**
 * Gift card balance (Task D10, /gift-cards/balance). GET /gift-cards/code/:code
 * answers only the balance and the face, never who bought it. "Spend it in
 * the store" hands the code to the store checkout (localStorage, read once).
 */
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { FIELD, LABEL, PRIMARY, SECONDARY } from "@/components/site/store/ui";
import { SITE_API_URL } from "@/lib/site/api";
import { usePublishOrderBack } from "@/lib/site/order-back";
import { formatCents } from "@/lib/site/order-flow";
import { formatGiftCode, giftCodeComplete, giftDesign, type GiftDesign } from "@/lib/site/store";
import { GiftCardFace } from "./GiftCardFace";

export function GiftBalance() {
  const t = useTranslations("giftCards.balance");
  const locale = useLocale();
  const search = useSearchParams();
  const id = useId();
  usePublishOrderBack(`/${locale}/gift-cards`, t("back"));
  const [code, setCode] = useState(formatGiftCode(search.get("code") || ""));
  const [state, setState] = useState<{ kind: "idle" | "checking" } | { kind: "found"; balanceCents: number; design: GiftDesign; code: string } | { kind: "error"; text: string }>({ kind: "idle" });

  async function check(value: string) {
    if (!giftCodeComplete(value)) {
      setState({ kind: "error", text: t("incomplete") });
      return;
    }
    setState({ kind: "checking" });
    const res = await fetch(`${SITE_API_URL}/gift-cards/code/${encodeURIComponent(value)}`).catch(() => null);
    if (res?.ok) {
      const body = await res.json().catch(() => null);
      if (body && typeof body.balanceCents === "number") {
        setState({ kind: "found", balanceCents: body.balanceCents, design: giftDesign(body.designId), code: value });
        return;
      }
    }
    setState({ kind: "error", text: res && res.status === 404 ? t("notFound") : t("error") });
  }

  useEffect(() => {
    if (giftCodeComplete(code)) check(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spendInStore = () => {
    if (state.kind !== "found") return;
    try {
      localStorage.setItem("pendingGiftCardCode", state.code);
    } catch {
      /* storage blocked: the code can still be typed at checkout */
    }
  };

  return (
    <div data-gift-balance className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 pt-6 md:grid-cols-2 md:items-center md:gap-12 md:px-8 md:pt-14">
      <div className="min-w-0">
        <Reveal from="fade">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Display locale={locale} className="m-0 mt-2 text-[clamp(2rem,8vw,3.25rem)] text-oh-cream">
            {t("title")}
          </Display>
          <Body locale={locale} className="m-0 mt-3 text-oh-cream/85">
            {t("lede")}
          </Body>
        </Reveal>
        <form
          className="mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            check(code);
          }}
        >
          <label htmlFor={`${id}-code`} className={LABEL}>
            {t("codeLabel")}
          </label>
          <input
            id={`${id}-code`}
            value={code}
            onChange={(e) => {
              setCode(formatGiftCode(e.target.value));
              if (state.kind !== "checking") setState({ kind: "idle" });
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={state.kind === "error" ? true : undefined}
            aria-describedby={state.kind === "error" ? `${id}-err` : undefined}
            className={`${FIELD} font-mono text-lg tracking-[0.08em]`}
            data-field="balanceCode"
          />
          {state.kind === "error" ? (
            <p id={`${id}-err`} role="alert" className="m-0 mt-2 text-sm text-oh-ember-light">
              {state.text}
            </p>
          ) : null}
          <button type="submit" disabled={state.kind === "checking"} aria-busy={state.kind === "checking" ? "true" : "false"} className={`${PRIMARY} mt-4 h-14 w-full`} data-balance-check>
            {state.kind === "checking" ? t("checking") : t("check")}
          </button>
        </form>
      </div>

      <div className="min-w-0">
        <GiftCardFace design={state.kind === "found" ? state.design : "classic"} amount={state.kind === "found" ? state.balanceCents / 100 : null} className="mx-auto w-full max-w-md" />
        {state.kind === "found" ? (
          <Reveal className="mt-6 text-center" data-balance-result>
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("balance")}</p>
            <p className="m-0 mt-1 font-display text-4xl tabular-nums text-oh-cream" data-balance-cents={state.balanceCents}>
              {formatCents(state.balanceCents, locale)}
            </p>
            <p className="m-0 mt-3 text-[15px] text-oh-cream/80">{t("note")}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href={`/${locale}/store`} onClick={spendInStore} className={PRIMARY}>
                {t("spendStore")}
              </Link>
              <Link href={`/${locale}/order`} className={SECONDARY}>
                {t("spendBowl")}
              </Link>
            </div>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}
