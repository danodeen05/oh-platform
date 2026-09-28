/**
 * Task D7: how credits work, as the life of one credit lot: earned on day
 * 0, spent soonest-to-expire first, a reminder `expiryWarningDays` before
 * the end, gone at `creditExpiryDays`. Every number is the program's.
 *
 * Server component: no interactivity; the track and the wallet are plain
 * markup (Reveal adds the entrance at the page level).
 */
import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { Icon } from "@/components/site/icons/Icon";
import type { IconName } from "@/components/site/icons/paths";
import type { PublicProgram } from "@/lib/site/program";
import { formatMoney } from "./format";

export async function CreditTimeline({ program }: { program: PublicProgram }) {
  const t = await getTranslations("rewards.credits");
  const locale = await getLocale();
  const expiry = program.creditExpiryDays;
  const warn = Math.min(expiry, Math.max(0, program.expiryWarningDays ?? 7));
  const warnDay = expiry - warn;
  const warnPct = expiry > 0 ? (warnDay / expiry) * 100 : 100;
  const low = program.tiers[0]?.cashbackPct ?? 0;
  const high = program.tiers[program.tiers.length - 1]?.cashbackPct ?? low;

  const steps: { key: "earn" | "spend" | "remind" | "expire"; icon: IconName; body: string }[] = [
    { key: "earn", icon: "wallet", body: t("earn.body", { low, high, referrer: formatMoney(program.referral.referrerCents, locale) }) },
    { key: "spend", icon: "check", body: t("spend.body") },
    { key: "remind", icon: "clock", body: t("remind.body", { days: warn }) },
    { key: "expire", icon: "alert", body: t("expire.body", { days: expiry }) },
  ];

  // Three example lots in a wallet, soonest first: the one checkout spends.
  const wallet = [Math.max(1, warn - 1), Math.round(expiry * 0.45), Math.max(1, expiry - 2)];

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12">
      <div className="min-w-0">
        {/* The track */}
        <figure className="m-0 rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-5 md:p-7">
          <figcaption className="text-sm text-oh-cream/70">{t("track")}</figcaption>
          {/* The reminder day sits above the track; start and end sit below. */}
          <div className="relative mt-4 h-6 text-sm tabular-nums" style={{ ["--warn" as string]: `${warnPct}%` } as CSSProperties}>
            <span className="absolute left-[var(--warn)] top-0 -translate-x-[70%] whitespace-nowrap text-oh-gold">{t("day", { day: warnDay })}</span>
          </div>
          <div className="relative mt-2 h-3 rounded-full bg-oh-stone" style={{ ["--warn" as string]: `${warnPct}%` } as CSSProperties}>
            <div className="absolute inset-y-0 left-0 w-[var(--warn)] rounded-l-full bg-linear-to-r from-oh-olive-light to-oh-gold" />
            <div className="absolute inset-y-0 left-[var(--warn)] right-0 rounded-r-full bg-oh-ember" />
            <span aria-hidden="true" className="absolute -top-1.5 left-0 h-6 w-6 -translate-x-1/3 rounded-full border-4 border-oh-ink bg-oh-olive-light" />
            <span aria-hidden="true" className="absolute -top-1.5 left-[var(--warn)] h-6 w-6 -translate-x-1/2 rounded-full border-4 border-oh-ink bg-oh-gold" />
            <span aria-hidden="true" className="absolute -top-1.5 right-0 h-6 w-6 translate-x-1/3 rounded-full border-4 border-oh-ink bg-oh-ember" />
          </div>
          <div className="mt-3 flex justify-between gap-4 text-sm tabular-nums">
            <span className="text-oh-cream/80">{t("day", { day: 0 })}</span>
            <span className="text-oh-ember-light">{t("day", { day: expiry })}</span>
          </div>
        </figure>

        <ol className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.key} className="flex gap-4 rounded-2xl bg-oh-ink/60 p-4">
              <Icon name={s.icon} size={24} className="mt-0.5 shrink-0 text-oh-ember-light" />
              <div className="min-w-0">
                <p className="m-0 text-base font-semibold text-oh-cream">{t(`${s.key}.title`)}</p>
                <p className="m-0 mt-1 text-base leading-snug text-oh-cream/75">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* The wallet: spend order */}
      <figure className="m-0 min-w-0 self-start rounded-[1.75rem] bg-oh-linen p-5 text-oh-ink md:p-7">
        <figcaption className="text-sm font-semibold text-oh-ink/80">{t("wallet")}</figcaption>
        <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
          {wallet.map((days, i) => (
            <li
              key={days}
              className={`flex min-h-14 items-center justify-between gap-3 rounded-xl px-4 ${
                i === 0 ? "bg-oh-ink text-oh-cream" : "bg-oh-paper text-oh-ink"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon name="wallet" size={20} className={i === 0 ? "shrink-0 text-oh-gold" : "shrink-0 text-oh-clay"} />
                <span className="truncate text-base tabular-nums">{t("daysLeft", { days })}</span>
              </span>
              {i === 0 ? (
                <span className="shrink-0 rounded-full bg-oh-ember-deep px-3 py-1 text-sm font-semibold text-oh-cream">{t("spentFirst")}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </figure>
    </div>
  );
}
