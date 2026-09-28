"use client";

/**
 * Task D8: the welcome sheet, shown the first time a member opens the
 * passport (`welcomeSeenAt` is null). Four screens: your tier, the climb,
 * the welcome credit (or, for a member who came without a friend's link,
 * how referral credit works), and Wallet. Finishing, skipping, Esc or a
 * tap on the backdrop all count as seen: the parent records it once
 * (POST /users/:id/moments).
 */
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { LazySheet as Sheet } from "@/components/site/motion/LazySheet";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { Seal } from "@/components/site/seal/Seal";
import { TierMark } from "@/components/site/tiers/TierMark";
import type { SiteFetch } from "@/lib/site/api";
import type { PublicProgram } from "@/lib/site/simulate";
import { tierMeta } from "@/lib/site/tier-meta";
import { formatMoney } from "./format";
import type { PassportProfile } from "./usePassport";
import { WalletButtons } from "./WalletButtons";

const NIGHT =
  "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone [&_.oh-sheet-panel]:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]";

const STEPS = 4;

export function WelcomeSheet({
  open,
  onDone,
  profile,
  program,
  api,
}: {
  open: boolean;
  onDone: () => void;
  profile: PassportProfile;
  program: PublicProgram;
  api: SiteFetch;
}) {
  const t = useTranslations("passport.welcome");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const reduced = useReducedMotion();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<"next" | "back">("next");
  const name = (key: string) => tiers(`${tierMeta(key).msg}.name`);

  const first = program.tiers.find((x) => x.key === profile.tier) ?? program.tiers[0];
  const top = program.tiers[program.tiers.length - 1];
  const nextKey = first.next;
  const referred = Boolean(profile.referredById);
  const heading = "m-0 mt-5 text-[1.9rem] leading-[1.1] text-oh-cream " + (cjk ? "font-display-cjk" : "font-display");
  const body = "m-0 mt-3 text-base leading-relaxed text-oh-cream/80";

  const go = (to: number) => {
    setDir(to > step ? "next" : "back");
    setStep(to);
  };

  let screen;
  if (step === 1) {
    screen = (
      <>
        <span className="inline-flex rounded-full p-3 text-oh-gold ring-1 ring-oh-gold/40">
          <TierMark tier={tierMeta(profile.tier).mark} tone="current" size={64} />
        </span>
        <h2 className={heading}>{t("s1.title", { tier: name(profile.tier) })}</h2>
        <p className={body}>{t("s1.body", { pct: profile.cashbackPct })}</p>
      </>
    );
  } else if (step === 2) {
    screen = (
      <>
        <div aria-hidden="true" className="flex items-end gap-3">
          {program.tiers.map((tier, i) => (
            <span key={tier.key} className={i === 0 ? "text-oh-cream/60" : i === program.tiers.length - 1 ? "text-oh-gold" : "text-oh-cream"}>
              <TierMark tier={tierMeta(tier.key).mark} tone="current" size={i === program.tiers.length - 1 ? 60 : 44} />
            </span>
          ))}
        </div>
        <h2 className={heading}>{t("s2.title", { top: name(top.key) })}</h2>
        <p className={body}>
          {nextKey && first.need
            ? t("s2.body", { orders: first.need.orders, referrals: first.need.referrals, next: name(nextKey) })
            : t("s2.bodyTop")}
        </p>
      </>
    );
  } else if (step === 3) {
    screen = (
      <>
        <Seal iconKey="first-referral" name={t("s3.sealName")} size={72} earned />
        <h2 className={heading}>
          {referred ? t("s3.titleReferred", { amount: formatMoney(program.referral.refereeCents, locale) }) : t("s3.title")}
        </h2>
        <p className={body}>
          {referred
            ? t("s3.bodyReferred", { days: program.creditExpiryDays })
            : t("s3.body", {
                referee: formatMoney(program.referral.refereeCents, locale),
                referrer: formatMoney(program.referral.referrerCents, locale),
              })}
        </p>
      </>
    );
  } else {
    screen = (
      <>
        <span className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-oh-cream text-oh-ink">
          <Icon name="wallet" size={40} />
        </span>
        <h2 className={heading}>{t("s4.title")}</h2>
        <p className={body}>{t("s4.body")}</p>
        <div className="mt-5">
          <WalletButtons api={api} userId={profile.userId} />
        </div>
      </>
    );
  }

  return (
    <Sheet open={open} onClose={onDone} label={t("label")} snapPoints={[0.92]} className={NIGHT}>
      <div data-welcome-sheet className={`${cjk ? "font-cjk" : "font-body"} flex min-h-[26rem] flex-col`}>
        <div className="-mt-1 flex items-center justify-between">
          <p className="m-0 text-sm tabular-nums text-oh-cream/65">{t("step", { current: step, total: STEPS })}</p>
          <button
            type="button"
            data-welcome-skip
            onClick={onDone}
            className="-mr-2 inline-flex min-h-11 cursor-pointer appearance-none items-center rounded-full border-0 bg-transparent px-3 font-[inherit] text-base text-oh-cream/80 hover:bg-oh-stone/60 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
          >
            {t("skip")}
          </button>
        </div>

        <div
          key={step}
          data-welcome-step={step}
          data-dir={dir}
          data-reduced={reduced ? "true" : "false"}
          aria-live="polite"
          className="mp-screen mt-4 flex-1"
        >
          {screen}
        </div>

        <div aria-hidden="true" className="mt-6 flex gap-1.5">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i + 1 === step ? "w-6 bg-oh-gold" : "w-1.5 bg-oh-stone"}`} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              data-welcome-back
              onClick={() => go(step - 1)}
              className="inline-flex min-h-12 shrink-0 cursor-pointer appearance-none items-center whitespace-nowrap rounded-full border border-oh-cream/35 bg-transparent px-5 font-[inherit] text-base font-semibold text-oh-cream hover:border-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("back")}
            </button>
          ) : null}
          {step < STEPS ? (
            <button
              type="button"
              data-welcome-next
              onClick={() => go(step + 1)}
              className="inline-flex min-h-12 cursor-pointer appearance-none items-center gap-2 flex-1 justify-center whitespace-nowrap rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("next")}
              <Icon name="arrow" size={18} />
            </button>
          ) : (
            <button
              type="button"
              data-welcome-finish
              onClick={onDone}
              className="inline-flex min-h-12 cursor-pointer appearance-none items-center flex-1 justify-center whitespace-nowrap rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("finish")}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
