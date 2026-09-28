"use client";

/**
 * The savings step (Task D5): rewards (a FREE_BOWL takes the bowl line to
 * $0.00), member credit with an expiring-soon hint, a promo code and a gift
 * card. The member's balance and lots come from GET /users/:id/profile and
 * the rewards from GET /users/:id/rewards, both with the Clerk token.
 *
 * Nothing is computed here: every choice changes the draft, OrderFlow
 * re-quotes (POST /orders/quote) and the receipt shows the server's numbers.
 * Nothing is spent until the order is paid.
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { Seal } from "@/components/site/seal/Seal";
import { SITE_API_URL, type SiteFetch } from "@/lib/site/api";
import type { DraftSavings } from "@/lib/site/order-draft";
import { formatCents } from "@/lib/site/order-flow";
import type { OrderApiError } from "@/lib/site/orders";
import { Receipt, type ReceiptLine, type ReceiptTotals } from "./Receipt";
import type { ServerQuote } from "./useQuote";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const INPUT =
  "h-12 min-w-0 flex-1 rounded-2xl border border-oh-stone bg-oh-charcoal px-4 font-[inherit] text-base uppercase tracking-wider text-oh-cream placeholder:normal-case placeholder:tracking-normal placeholder:text-oh-mute focus-visible:border-oh-cream focus-visible:outline-none";
const SMALL_BTN = `h-12 shrink-0 cursor-pointer appearance-none rounded-2xl border border-oh-stone bg-oh-stone px-4 font-[inherit] text-[15px] font-semibold text-oh-cream hover:bg-oh-stone/70 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

type Reward = { id: string; type: "FREE_BOWL" | "PREMIUM_ADDON" | string; windowEndsAt: string; active?: boolean };
type Lot = { remainingCents: number; expiresAt: string };
type MealGift = { id: string; amountCents: number; messageFromGiver?: string | null; giver?: { name?: string | null } | null };

export interface SavingsStepProps {
  locationId: string;
  userId: string | null;
  api: SiteFetch;
  savings: DraftSavings;
  onSavings: (next: DraftSavings) => void;
  quote: ServerQuote | null;
  quoteError: OrderApiError | null;
  lines: ReceiptLine[];
}

export function SavingsStep({ locationId, userId, api, savings, onSavings, quote, quoteError, lines }: SavingsStepProps) {
  const t = useTranslations("orderFlow.savings");
  const tw = useTranslations("orderFlow.warnings");
  const te = useTranslations("orderFlow.errors");
  const locale = useLocale();
  const money = (c: number) => formatCents(c, locale);
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "America/Denver" }).format(new Date(iso));

  const [wallet, setWallet] = useState<{ credits: number; expiring: Lot[]; rewards: Reward[]; loaded: boolean }>({ credits: 0, expiring: [], rewards: [], loaded: false });
  const [promoInput, setPromoInput] = useState(savings.promoCode || "");
  const [giftInput, setGiftInput] = useState(savings.giftCardCode || "");
  const [mealGift, setMealGift] = useState<MealGift | null>(null);

  // A meal someone paid forward at this location (oldest first, funded, unexpired). It is a
  // tender the server quotes and spends at PAID, exactly as the old checkout did.
  useEffect(() => {
    let cancelled = false;
    fetch(`${SITE_API_URL}/meal-gifts/next/${encodeURIComponent(locationId)}`, { headers: { "x-tenant-slug": "oh" }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!cancelled) setMealGift(g && typeof g.id === "string" && typeof g.amountCents === "number" ? g : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [profile, rewards] = await Promise.all([
        api(`${SITE_API_URL}/users/${encodeURIComponent(userId)}/profile?locale=${locale}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        api(`${SITE_API_URL}/users/${encodeURIComponent(userId)}/rewards`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      const m = profile?.membership;
      setWallet({
        credits: typeof m?.credits === "number" ? m.credits : 0,
        expiring: Array.isArray(m?.expiring) ? m.expiring : [],
        rewards: Array.isArray(rewards?.rewards) ? rewards.rewards.filter((r: Reward) => r.active !== false) : [],
        loaded: true,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, locale]);

  const warnings = new Set(quote?.warnings || []);
  const d = quote?.discounts;
  const rewardProblem = savings.rewardId && quoteError && ["REWARD_NOT_APPLICABLE", "REWARD_UNAVAILABLE"].includes(quoteError.code || "") ? quoteError.code : null;
  const expiringCents = wallet.expiring.reduce((s, l) => s + (l.remainingCents || 0), 0);
  const soonest = wallet.expiring[0]?.expiresAt;

  const totals: ReceiptTotals | null = quote
    ? {
        subtotalCents: quote.subtotalCents,
        rewardCents: d?.rewardCents || 0,
        promoCents: d?.promoCents || 0,
        taxCents: quote.taxCents,
        totalCents: quote.totalCents,
        creditsCents: d?.creditsCents || 0,
        giftCardCents: d?.giftCardCents || 0,
        mealGiftCents: d?.mealGiftCents || 0,
        amountDueCents: quote.amountDueCents,
      }
    : null;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="flex flex-col gap-6">
        {/* Rewards */}
        <Block name="rewards" title={t("rewards")}>
          {wallet.rewards.length === 0 ? (
            <p className="m-0 text-[15px] text-oh-mute">{wallet.loaded ? t("noRewards") : t("loading")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {wallet.rewards.map((r) => {
                const on = savings.rewardId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      data-reward={r.id}
                      onClick={() => onSavings({ ...savings, rewardId: on ? null : r.id })}
                      className={`flex min-h-16 w-full cursor-pointer appearance-none items-center gap-3 rounded-2xl border px-3 py-2.5 text-left font-[inherit] transition-colors duration-200 motion-reduce:transition-none ${FOCUS} ${
                        on ? "border-oh-gold bg-oh-stone/60" : "border-oh-stone bg-oh-charcoal hover:border-oh-mute"
                      }`}
                    >
                      <span className="shrink-0" aria-hidden="true">
                        <Seal iconKey={r.type === "FREE_BOWL" ? "10-orders" : "vip"} name={r.type === "FREE_BOWL" ? t("rewardFreeBowl") : t("rewardPremiumAddon")} size={40} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] font-semibold text-oh-cream">{r.type === "FREE_BOWL" ? t("rewardFreeBowl") : t("rewardPremiumAddon")}</span>
                        <span className="text-sm text-oh-mute">{t("rewardUntil", { date: day(r.windowEndsAt) })}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${on ? "bg-oh-gold text-oh-charcoal" : "bg-oh-stone text-oh-cream"}`}>
                        {on ? t("applied") : t("apply")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {rewardProblem ? (
            <p role="alert" className="m-0 mt-2 text-sm text-oh-ember-light">
              {te(rewardProblem)}
            </p>
          ) : null}
        </Block>

        {/* Credit */}
        <Block name="credits" title={t("credits")}>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold text-oh-cream">{wallet.credits > 0 ? t("creditsBalance", { amount: money(wallet.credits) }) : t("creditsNone")}</span>
              {typeof quote?.maxCreditsCents === "number" ? <span className="text-sm text-oh-mute">{t("creditsCap", { amount: money(quote.maxCreditsCents as number) })}</span> : null}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={savings.useCredits}
              aria-label={t("creditsUse")}
              disabled={wallet.credits <= 0}
              onClick={() => onSavings({ ...savings, useCredits: !savings.useCredits, creditsCents: wallet.credits })}
              className={`relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full border-0 p-0 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${FOCUS} ${
                savings.useCredits ? "bg-oh-olive" : "bg-oh-stone"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-oh-cream shadow transition-transform duration-200 motion-reduce:transition-none ${savings.useCredits ? "translate-x-6" : ""}`}
              />
            </button>
          </div>
          {expiringCents > 0 && soonest ? (
            <p className="m-0 mt-3 flex items-center gap-2 rounded-xl bg-oh-charcoal px-3 py-2 text-sm text-oh-cream">
              <Icon name="clock" size={16} className="shrink-0 text-oh-gold" />
              {t("creditsExpiring", { amount: money(expiringCents), date: day(soonest) })}
            </p>
          ) : null}
        </Block>

        {/* A meal paid forward */}
        {mealGift || savings.mealGiftId ? (
          <Block name="mealGift" title={t("mealGift")}>
            {mealGift ? (
              <button
                type="button"
                aria-pressed={savings.mealGiftId === mealGift.id}
                data-meal-gift={mealGift.id}
                onClick={() => onSavings({ ...savings, mealGiftId: savings.mealGiftId === mealGift.id ? null : mealGift.id })}
                className={`flex min-h-16 w-full cursor-pointer appearance-none items-center gap-3 rounded-2xl border px-3 py-2.5 text-left font-[inherit] transition-colors duration-200 motion-reduce:transition-none ${FOCUS} ${
                  savings.mealGiftId === mealGift.id ? "border-oh-gold bg-oh-stone/60" : "border-oh-stone bg-oh-charcoal hover:border-oh-mute"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oh-stone text-oh-gold">
                  <Icon name="gift" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold text-oh-cream">
                    {firstName(mealGift.giver?.name) ? t("mealGiftFrom", { name: firstName(mealGift.giver?.name)! }) : t("mealGiftAnonymous")}
                  </span>
                  <span className="text-sm text-oh-mute">{t("mealGiftNote", { amount: money(mealGift.amountCents) })}</span>
                  {mealGift.messageFromGiver ? <span className="mt-1 text-sm italic text-oh-cream/85 [overflow-wrap:anywhere]">{mealGift.messageFromGiver}</span> : null}
                </span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${savings.mealGiftId === mealGift.id ? "bg-oh-gold text-oh-charcoal" : "bg-oh-stone text-oh-cream"}`}>
                  {savings.mealGiftId === mealGift.id ? t("applied") : t("apply")}
                </span>
              </button>
            ) : null}
            {savings.mealGiftId && (warnings.has("MEAL_GIFT_UNAVAILABLE") || (mealGift && mealGift.id !== savings.mealGiftId)) ? (
              <p role="alert" className="m-0 mt-2 text-sm text-oh-ember-light">
                {tw("MEAL_GIFT_UNAVAILABLE")}{" "}
                <button type="button" onClick={() => onSavings({ ...savings, mealGiftId: null })} className="min-h-11 cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-sm font-semibold text-oh-cream underline underline-offset-4">
                  {t("remove")}
                </button>
              </p>
            ) : null}
          </Block>
        ) : null}

        {/* Promo */}
        <Block name="promo" title={t("promo")}>
          {savings.promoCode && !warnings.has("PROMO_INVALID") && (d?.promoCents || 0) > 0 ? (
            <Applied text={t("promoApplied", { code: savings.promoCode })} onRemove={() => { setPromoInput(""); onSavings({ ...savings, promoCode: null }); }} removeLabel={t("remove")} />
          ) : (
            <CodeForm
              id="promo-code"
              label={t("promo")}
              placeholder={t("promoPlaceholder")}
              value={promoInput}
              onChange={setPromoInput}
              onApply={() => onSavings({ ...savings, promoCode: promoInput.trim() || null })}
              applyLabel={t("apply")}
              error={savings.promoCode && warnings.has("PROMO_INVALID") ? tw("PROMO_INVALID") : null}
            />
          )}
        </Block>

        {/* Gift card */}
        <Block name="giftCard" title={t("giftCard")}>
          {savings.giftCardCode && !warnings.has("GIFT_CARD_INVALID") && (d?.giftCardCents || 0) > 0 ? (
            <Applied text={t("giftCardApplied")} onRemove={() => { setGiftInput(""); onSavings({ ...savings, giftCardCode: null }); }} removeLabel={t("remove")} />
          ) : (
            <CodeForm
              id="gift-card-code"
              label={t("giftCard")}
              placeholder={t("giftCardPlaceholder")}
              value={giftInput}
              onChange={setGiftInput}
              onApply={() => onSavings({ ...savings, giftCardCode: giftInput.trim() || null })}
              applyLabel={t("apply")}
              error={savings.giftCardCode && warnings.has("GIFT_CARD_INVALID") ? tw("GIFT_CARD_INVALID") : null}
            />
          )}
        </Block>
      </div>

      <div className="md:sticky md:top-20">
        <Receipt lines={lines} totals={totals} />
      </div>
    </div>
  );
}

/** The giver's first name only: the gift's recipient never sees a full name. */
function firstName(name: string | null | undefined): string | null {
  const first = (name || "").trim().split(/\s+/)[0];
  return first ? first : null;
}

function Block({ name, title, children }: { name: string; title: string; children: React.ReactNode }) {
  return (
    <section data-savings={name} aria-labelledby={`savings-${name}`} className="rounded-3xl bg-oh-ink p-4">
      <h2 id={`savings-${name}`} className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CodeForm({ id, label, placeholder, value, onChange, onApply, applyLabel, error }: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void; onApply: () => void; applyLabel: string; error: string | null }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={INPUT}
        />
        <button type="submit" disabled={!value.trim()} className={SMALL_BTN}>
          {applyLabel}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="m-0 mt-2 text-sm text-oh-ember-light">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Applied({ text, onRemove, removeLabel }: { text: string; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oh-olive text-oh-cream">
        <Icon name="check" size={18} />
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-oh-cream">{text}</span>
      <button type="button" onClick={onRemove} className={`min-h-11 cursor-pointer appearance-none rounded-full border-0 bg-transparent px-3 font-[inherit] text-sm text-oh-mute underline underline-offset-4 hover:text-oh-cream ${FOCUS}`}>
        {removeLabel}
      </button>
    </div>
  );
}
