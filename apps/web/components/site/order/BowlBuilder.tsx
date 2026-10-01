"use client";

/**
 * The bowl step (Task D5): soup, noodles, the slider choices, add-ons, sides,
 * drinks and dessert, from GET /menu/steps?locale=. Food sits on linen
 * panels; the selected soup's photo leads (Classic shows the slices, Wagyu
 * the chunks, from the C6 pipeline).
 *
 * Choices only change the draft; prices shown per item are the menu's list
 * prices, and the CTA bar's total is the server quote (OrderFlow).
 * Slider rows show `sliderConfig.displayLabels[i]` and the draft keeps the
 * index, which buildLines sends as the English `labels[i]`.
 */
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Icon } from "@/components/site/icons/Icon";
import { Title } from "@/components/site/Text";
import "./order.css";
import { SITE_IMAGES, type ImageKey } from "@/lib/site/images";
import { getMenuItemImage } from "@/lib/menu-images";
import { englishName, type MenuItem, type MenuSection, type MenuStep, type OrderDraft } from "@/lib/site/order-draft";
import { formatCents } from "@/lib/site/order-flow";

const SOUP_PHOTO: Record<string, ImageKey> = {
  "Classic Beef Noodle Soup": "bowl-slices-top",
  "American Wagyu Beef Noodle Soup": "bowl-chunks-top",
};

/** The quiet outline on a slider's usual choice (and its legend swatch): cream at 25% so it never leads. */
const DEFAULT_RING = "ring-1 ring-inset ring-oh-cream/25";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export interface BowlBuilderProps {
  steps: MenuStep[];
  draft: OrderDraft;
  update: (fn: (d: OrderDraft) => OrderDraft) => void;
  /** Omit every price (soup caption, soup rows, extras), e.g. for a complimentary private event. */
  hidePrices?: boolean;
}

export function BowlBuilder({ steps, draft, update, hidePrices = false }: BowlBuilderProps) {
  const locale = useLocale();
  const t = useTranslations("orderFlow.bowl");
  const tRoot = useTranslations();
  const soupSection = steps.flatMap((s) => s.sections).find((s) => s.id === "soup");
  const soup = soupSection?.items?.find((i) => i.id === draft.singles.soup) ?? null;
  const soupPhoto = soup ? SOUP_PHOTO[englishName(soup)] : undefined;
  const soupPng = soup && !soupPhoto ? getMenuItemImage(englishName(soup)) : null;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-12">
      <div className="md:sticky md:top-20 md:self-start">
        {/* TODO(tokens): bg-oh-linen is the food panel (spec 4). */}
        <figure className="relative m-0 aspect-[4/3] overflow-hidden rounded-[28px] bg-oh-linen md:aspect-square">
          {soupPhoto ? (
            <div key={soupPhoto} className="oh-bowl-in absolute inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
              <SitePicture image={soupPhoto} sizes="(min-width: 768px) 460px, 100vw" priority alt={tRoot(SITE_IMAGES[soupPhoto].alt)} className="block h-full w-full" />
            </div>
          ) : soupPng ? (
            <div key={soupPng} className="oh-bowl-in absolute inset-6">
              <Image src={soupPng} alt={soup ? soup.name : ""} fill sizes="(min-width: 768px) 420px, 90vw" className="object-contain" />
            </div>
          ) : null}
          {soup ? (
            <figcaption className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-oh-charcoal/80 px-4 py-2.5 text-oh-cream backdrop-blur-sm">
              <span className="min-w-0 truncate text-sm font-semibold">{soup.name}</span>
              {hidePrices ? null : <span className="shrink-0 text-sm tabular-nums text-oh-cream/80">{formatCents(soup.basePriceCents, locale)}</span>}
            </figcaption>
          ) : null}
        </figure>
      </div>

      <div className="flex min-w-0 flex-col gap-10">
        {steps.map((step) => (
          <section key={step.id} aria-labelledby={`bowl-step-${step.id}`} className="flex flex-col gap-7">
            {step.id !== "bowl" ? (
              <div className="flex flex-col gap-2 border-t border-oh-stone pt-6">
                <Title locale={locale} id={`bowl-step-${step.id}`} className="m-0 text-oh-cream">
                  {step.title}
                </Title>
                {step.id === "customize" && step.sections.some((s) => typeof s.sliderConfig?.default === "number") ? (
                  <p className="m-0 flex items-center justify-end gap-2 text-xs text-oh-mute">
                    <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-sm bg-oh-ink ${DEFAULT_RING}`} />
                    {t("defaultLegend")}
                  </p>
                ) : null}
              </div>
            ) : (
              <h2 id={`bowl-step-${step.id}`} className="sr-only">
                {step.title}
              </h2>
            )}
            {step.sections.map((section) => (
              <Section key={section.id} section={section} draft={draft} update={update} locale={locale} t={t} hidePrices={hidePrices} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

type T = (key: string, values?: Record<string, string | number>) => string;

function Section({ section, draft, update, locale, t, hidePrices }: { section: MenuSection; draft: OrderDraft; update: BowlBuilderProps["update"]; locale: string; t: T; hidePrices: boolean }) {
  const labelId = `sec-${section.id}`;
  if (section.selectionMode === "SINGLE") {
    const items = (section.items || []).filter((i) => i.isAvailable !== false);
    const isSoup = section.id === "soup";
    return (
      <div>
        <SectionLabel id={labelId}>{section.name}</SectionLabel>
        <div role="radiogroup" aria-labelledby={labelId} className={isSoup ? "flex flex-col gap-2.5" : "flex flex-wrap gap-2"}>
          {items.map((item) => {
            const checked = draft.singles[section.id] === item.id;
            const select = () => update((d) => ({ ...d, singles: { ...d.singles, [section.id]: item.id } }));
            return isSoup ? (
              <SoupOption key={item.id} item={item} checked={checked} onSelect={select} locale={locale} hidePrices={hidePrices} />
            ) : (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={checked}
                data-noodle={item.id}
                onClick={select}
                className={`min-h-11 cursor-pointer appearance-none rounded-full border px-4 py-2 font-[inherit] text-[15px] transition-colors duration-200 motion-reduce:transition-none ${FOCUS} ${
                  checked ? "border-oh-cream bg-oh-cream font-semibold text-oh-charcoal" : "border-oh-stone bg-oh-ink text-oh-cream hover:border-oh-mute"
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (section.selectionMode === "SLIDER" && section.item) {
    const item = section.item;
    const values = section.sliderConfig?.labels || [];
    const shown = section.sliderConfig?.displayLabels || values;
    const current = draft.sliders[item.id] ?? section.sliderConfig?.default ?? 0;
    const def = section.sliderConfig?.default;
    const isDefault = (i: number) => typeof def === "number" && i === def;
    return (
      <div>
        <SectionLabel id={labelId}>{section.name}</SectionLabel>
        <div role="radiogroup" aria-labelledby={labelId} data-slider={englishName(item)} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-oh-ink p-1">
          {values.map((_, i) => {
            const checked = current === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={checked}
                data-default={isDefault(i) ? "true" : undefined}
                data-selected={checked ? "true" : undefined}
                aria-description={isDefault(i) ? t("defaultAria") : undefined}
                onClick={() => update((d) => ({ ...d, sliders: { ...d.sliders, [item.id]: i } }))}
                className={`min-h-11 min-w-0 cursor-pointer appearance-none rounded-xl border-0 px-1 py-1.5 font-[inherit] text-sm leading-tight [overflow-wrap:anywhere] transition-colors duration-200 motion-reduce:transition-none ${FOCUS} ${
                  checked ? "bg-oh-cream font-semibold text-oh-charcoal" : "bg-transparent text-oh-mute hover:text-oh-cream"
                } ${isDefault(i) && !checked ? DEFAULT_RING : ""}`}
              >
                {shown[i] ?? values[i]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (section.selectionMode === "MULTIPLE") {
    const items = (section.items || []).filter((i) => i.isAvailable !== false);
    const cap = section.maxQuantity ?? 20;
    return (
      <div>
        <SectionLabel id={labelId}>
          {section.name}
          {cap < 20 ? <span className="ml-2 font-normal normal-case tracking-normal text-oh-mute">{t("max", { count: cap })}</span> : null}
        </SectionLabel>
        <ul aria-labelledby={labelId} className="m-0 flex list-none flex-col divide-y divide-oh-stone/70 overflow-hidden rounded-3xl bg-oh-ink p-0">
          {items.map((item) => (
            <ExtraRow key={item.id} item={item} qty={draft.extras[item.id] || 0} cap={cap} update={update} locale={locale} t={t} hidePrices={hidePrices} />
          ))}
        </ul>
      </div>
    );
  }
  return null;
}

function SectionLabel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
      {children}
    </p>
  );
}

function SoupOption({ item, checked, onSelect, locale, hidePrices }: { item: MenuItem; checked: boolean; onSelect: () => void; locale: string; hidePrices: boolean }) {
  const photo = SOUP_PHOTO[englishName(item)];
  const png = photo ? null : getMenuItemImage(englishName(item));
  const thumb = photo ? SITE_IMAGES[photo].src.webp : png;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      data-soup={item.id}
      onClick={onSelect}
      className={`flex min-h-[72px] w-full cursor-pointer appearance-none items-center gap-4 rounded-3xl border p-2.5 pr-4 text-left font-[inherit] transition-[border-color,background-color] duration-200 motion-reduce:transition-none ${FOCUS} ${
        checked ? "border-oh-ember-light bg-oh-stone/60" : "border-oh-stone bg-oh-ink hover:border-oh-mute"
      }`}
    >
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-oh-linen">
        {thumb ? <Image src={thumb} alt="" fill sizes="56px" className={photo ? "object-cover" : "object-contain p-1"} /> : null}
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-oh-cream">{item.name}</span>
      {hidePrices ? null : <span className="shrink-0 text-sm tabular-nums text-oh-mute">{formatCents(item.basePriceCents, locale)}</span>}
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${checked ? "border-oh-ember-light bg-oh-ember-light text-oh-charcoal" : "border-oh-mute"}`}
      >
        {checked ? <Icon name="check" size={16} /> : null}
      </span>
    </button>
  );
}

function ExtraRow({ item, qty, cap, update, locale, t, hidePrices }: { item: MenuItem; qty: number; cap: number; update: BowlBuilderProps["update"]; locale: string; t: T; hidePrices: boolean }) {
  const img = getMenuItemImage(englishName(item));
  const set = (n: number) =>
    update((d) => {
      const extras = { ...d.extras };
      if (n > 0) extras[item.id] = n;
      else delete extras[item.id];
      return { ...d, extras };
    });
  const price = item.basePriceCents > 0 ? `+${formatCents(item.basePriceCents, locale)}` : t("included");
  return (
    <li data-item={englishName(item)} className="flex items-center gap-3 px-3 py-2.5">
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-oh-linen">
        {img ? <Image src={img} alt="" fill sizes="48px" className="object-contain p-1" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold leading-snug text-oh-cream [overflow-wrap:anywhere]">{item.name}</span>
        {hidePrices ? null : <span className="text-sm tabular-nums text-oh-mute">{price}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {qty > 0 ? (
          <>
            <StepButton label={t("remove", { name: item.name })} icon="minus" onClick={() => set(qty - 1)} data="data-dec" />
            <span data-qty aria-live="polite" className="w-6 text-center text-base font-semibold tabular-nums text-oh-cream">
              {qty}
            </span>
          </>
        ) : null}
        <StepButton label={t("add", { name: item.name })} icon="plus" onClick={() => set(qty + 1)} disabled={qty >= cap} data="data-inc" filled={qty === 0} />
      </span>
    </li>
  );
}

function StepButton({ label, icon, onClick, disabled, data, filled }: { label: string; icon: "plus" | "minus"; onClick: () => void; disabled?: boolean; data: string; filled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...{ [data]: "" }}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-11 cursor-pointer appearance-none items-center justify-center rounded-full border p-0 font-[inherit] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${FOCUS} ${
        filled ? "border-oh-cream bg-oh-cream text-oh-charcoal hover:bg-oh-paper" : "border-oh-stone bg-transparent text-oh-cream hover:border-oh-mute"
      }`}
    >
      <PlusMinus kind={icon} />
    </button>
  );
}

/** Plus and minus drawn as filled, slightly tapered bars (house style: no strokes). */
function PlusMinus({ kind }: { kind: "plus" | "minus" }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <path d="M5 11.1 Q12 10.5 19 11.1 Q19.6 12 19 12.9 Q12 13.5 5 12.9 Q4.4 12 5 11.1 Z" fill="currentColor" />
      {kind === "plus" ? <path d="M11.1 5 Q10.5 12 11.1 19 Q12 19.6 12.9 19 Q13.5 12 12.9 5 Q12 4.4 11.1 5 Z" fill="currentColor" /> : null}
    </svg>
  );
}
