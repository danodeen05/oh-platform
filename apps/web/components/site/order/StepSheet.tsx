"use client";

/**
 * One step of the order flow (Task D5): a full-height page on the phone
 * with the step's progress, a serif title, the step's content and a sticky
 * call to action at the bottom, above the home indicator. The dock is hidden
 * on these routes (`data-order-flow` sets the shell's --dock-h to 0) and the
 * top bar carries a Back chevron to `backHref`.
 *
 * One-handed: the only primary action sits in the thumb zone, 56px tall and
 * full width on phones. On 768px and up the page centers in a readable
 * column and the CTA bar keeps the same column.
 */
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Eyebrow, Title } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { useChappy } from "@/components/site/chappy/ChappyLauncher";
import { ORDER_STEPS, type OrderStepKey } from "@/lib/site/order-draft";
import { usePublishOrderBack } from "@/lib/site/order-back";

export interface StepCta {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Extra attributes for tests and forms (e.g. `form` to submit a form elsewhere on the page). */
  form?: string;
  type?: "button" | "submit";
  dataAttr?: string;
}

export interface StepSheetProps {
  step: OrderStepKey;
  title: string;
  lede?: string;
  backHref: string | null;
  /** The summary on the left of the CTA bar, e.g. the server's total. */
  summary?: ReactNode;
  cta?: StepCta | null;
  /** Wider content column (the bowl builder at 1440). */
  wide?: boolean;
  /** A problem to show right above the CTA, in the thumb zone (role="alert"). */
  alert?: ReactNode;
  children: ReactNode;
}

export const CTA_CLASS =
  "flex h-14 min-w-0 flex-1 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline shadow-[0_12px_30px_-14px] shadow-oh-ember-deep transition-[background-color,transform,opacity] duration-200 hover:bg-oh-ember active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:bg-oh-stone disabled:text-oh-mute disabled:shadow-none motion-reduce:transition-none motion-reduce:active:scale-100";

export function StepSheet({ step, title, lede, backHref, summary, cta, wide = false, alert, children }: StepSheetProps) {
  const t = useTranslations("orderFlow");
  const locale = useLocale();
  const chappy = useChappy();
  const index = ORDER_STEPS.indexOf(step);
  usePublishOrderBack(backHref, t("back"));

  return (
    <div data-order-flow data-order-step={step} className="flex min-h-[calc(100svh-3.5rem-env(safe-area-inset-top,0px))] flex-col">
      <div className={`mx-auto w-full flex-1 px-4 pb-10 pt-2 md:pt-8 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <nav aria-label={t("progressLabel")} className="mb-5">
          <Eyebrow locale={locale} as="p" className="m-0 mb-2.5 text-oh-mute">
            {t("stepOf", { current: index + 1, total: ORDER_STEPS.length })}
            <span aria-hidden="true" className="px-2 text-oh-stone">
              /
            </span>
            <span className="text-oh-cream">{t(`steps.${step}`)}</span>
          </Eyebrow>
          <ol className="m-0 flex list-none gap-1.5 p-0" aria-hidden="true">
            {ORDER_STEPS.map((s, i) => (
              <li
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none ${
                  i < index ? "bg-oh-ember-light/70" : i === index ? "bg-oh-ember-light" : "bg-oh-stone"
                }`}
              />
            ))}
          </ol>
        </nav>

        <Reveal from="fade">
          <Title locale={locale} as="h1" className="m-0 text-oh-cream">
            {title}
          </Title>
          {lede ? <p className="m-0 mt-2 max-w-prose text-base leading-relaxed text-oh-mute">{lede}</p> : null}
        </Reveal>

        <div className="mt-7">{children}</div>

        <p className="m-0 mt-10 flex flex-wrap items-center gap-x-1.5 text-sm text-oh-mute">
          <span>{t("help")}</span>
          <button
            type="button"
            onClick={() => chappy.openChappy()}
            className="inline-flex min-h-11 cursor-pointer appearance-none items-center border-0 bg-transparent p-0 font-[inherit] text-sm font-semibold text-oh-cream underline decoration-oh-ember-light decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("helpCta")}
          </button>
        </p>
      </div>

      {cta ? (
        <div className="sticky bottom-0 z-30 border-t border-oh-stone/70 bg-oh-charcoal/92 backdrop-blur-md">
          {alert ? (
            <div role="alert" className={`mx-auto w-full px-4 pt-3 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
              <div className="flex items-start gap-2.5 rounded-2xl bg-oh-ember-deep/25 px-3.5 py-2.5 text-[15px] leading-snug text-oh-cream">
                <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
                <div className="min-w-0 flex-1">{alert}</div>
              </div>
            </div>
          ) : null}
          <div className={`mx-auto flex w-full items-center gap-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
            {summary ? <div className="min-w-0 shrink-0 text-left">{summary}</div> : null}
            <button
              type={cta.type ?? "button"}
              form={cta.form}
              data-order-cta
              {...(cta.dataAttr ? { [cta.dataAttr]: "" } : {})}
              onClick={cta.onClick}
              disabled={cta.disabled || cta.busy}
              aria-busy={cta.busy ? "true" : "false"}
              className={CTA_CLASS}
            >
              {cta.busy ? <Spinner /> : null}
              <span className="truncate">{cta.label}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none ${className}`}
    />
  );
}

/** A server amount for the CTA bar (`kind` names it for tests: data-due / data-total). `cents` null while a quote is in flight. */
export function TotalSummary({ label, cents, note, format, kind = "due" }: { label: string; cents: number | null; note?: string; format: (c: number) => string; kind?: "due" | "total" }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-xs text-oh-mute">{label}</span>
      <span {...{ [`data-${kind}`]: "" }} data-cents={cents ?? undefined} aria-live="polite" className="text-lg font-semibold tabular-nums text-oh-cream">
        {cents === null ? <span className="inline-block h-5 w-16 animate-pulse rounded bg-oh-stone motion-reduce:animate-none" /> : format(cents)}
      </span>
      {note ? <span className="text-[11px] text-oh-mute">{note}</span> : null}
    </div>
  );
}
