"use client";

/**
 * The menu's panels (Task D3): linen food panels grouped by category, each
 * item a tap target that opens its ItemSheet.
 *
 * Data: the page server-renders the guest menu (GET /menu/steps?locale=).
 * When the visitor is signed in, the list asks again with their Clerk token
 * (lib/site/api.ts): the API filters early-access items by the caller's
 * tier, so a member whose tier reaches an item before its release date gets
 * it here, marked "Early for members".
 */
import { OptimizedImg } from "@/components/site/picture/OptimizedImg";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSiteAuth } from "@/lib/site/auth";
import { useLocale, useTranslations } from "next-intl";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Seal } from "@/components/site/seal/Seal";
import { Icon } from "@/components/site/icons/Icon";
import { SITE_API_URL, useSiteApi } from "@/lib/site/api";
import { menuView, type ApiMenuStep, type MenuCard, type MenuGroupKey, type MenuSliderRow } from "@/lib/site/menu";
import { formatCents } from "@/lib/site/order-flow";
import { DietaryMarks } from "./DietaryMarks";
import { ItemSheet } from "./ItemSheet";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ember-deep";
const FOCUS_NIGHT = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const PANEL = "rounded-[28px] bg-oh-linen text-oh-ink";

export function MenuList({ initialSteps }: { initialSteps: ApiMenuStep[] }) {
  const t = useTranslations("menuPage");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const api = useSiteApi();
  const { isLoaded, isSignedIn } = useSiteAuth();
  const [steps, setSteps] = useState<ApiMenuStep[]>(initialSteps);
  const [selected, setSelected] = useState<MenuCard | null>(null);
  const [open, setOpen] = useState(false);

  // Members: ask again with the session token so early-access items come back.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api(`${SITE_API_URL}/menu/steps?locale=${encodeURIComponent(locale)}`, { headers: { "x-tenant-slug": "oh" }, cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && Array.isArray(body?.steps)) setSteps(body.steps);
      } catch {
        /* keep the guest menu */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, api, locale]);

  const view = useMemo(() => menuView(steps, locale), [steps, locale]);
  const show = (item: MenuCard) => {
    setSelected(item);
    setOpen(true);
  };

  const sections: { key: MenuGroupKey; count: number }[] = [];
  // Soups first, then "make it yours" (the sliders), then the rest.
  for (const g of view.groups) {
    sections.push({ key: g.key, count: g.items.length });
    if (g.key === "soup" && view.sliders.length) sections.push({ key: "customize", count: view.sliders.length });
  }
  if (!view.groups.some((g) => g.key === "soup") && view.sliders.length) sections.push({ key: "customize", count: view.sliders.length });

  if (!view.groups.length) {
    return (
      <p role="status" data-menu-empty className="m-0 mt-8 rounded-3xl bg-oh-ink p-6 text-oh-cream">
        {t("empty")}
      </p>
    );
  }

  const titleClass = `m-0 text-[clamp(1.75rem,5vw,2.5rem)] font-normal leading-tight ${cjk ? "font-display-cjk" : "font-display"}`;
  const bodyClass = cjk ? "font-cjk" : "font-body";

  return (
    <>
      <nav aria-label={t("jump")} className="-mx-4 mt-6 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="m-0 flex w-max list-none gap-2 p-0">
          {sections.map((s) => (
            <li key={s.key}>
              <a href={`#menu-${s.key}`} data-menu-jump={s.key} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-oh-stone px-4 text-[15px] text-oh-cream no-underline hover:border-oh-ash ${FOCUS_NIGHT}`}>
                {t(`groups.${s.key}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 flex flex-col gap-6 md:mt-10 md:gap-8">
        {sections.map((s) => {
          if (s.key === "customize") return <SlidersPanel key="customize" rows={view.sliders} titleClass={titleClass} bodyClass={bodyClass} />;
          const group = view.groups.find((g) => g.key === s.key)!;
          return (
            <Reveal key={group.key} as="section" id={`menu-${group.key}`} data-menu-section={group.key} aria-labelledby={`menu-${group.key}-title`} className={`scroll-mt-20 p-5 sm:p-7 md:p-9 ${PANEL}`}>
              <header className="flex flex-col gap-1">
                <h2 id={`menu-${group.key}-title`} className={titleClass}>
                  {t(`groups.${group.key}.title`)}
                </h2>
                <p className={`m-0 text-base text-oh-stone ${bodyClass}`}>{t(`groups.${group.key}.line`)}</p>
              </header>
              {group.key === "soup" ? (
                <ul className="m-0 mt-5 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item, i) => (
                    <li key={item.id}>
                      <FeatureCard item={item} priority={i === 0} onOpen={show} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-x-8 p-0 md:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="border-t border-oh-ink/10 first:border-t-0 md:[&:nth-child(2)]:border-t-0">
                      <ItemRow item={item} onOpen={show} />
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          );
        })}

        <Reveal as="section" aria-labelledby="menu-marks-title" data-menu-legend className="grid gap-6 rounded-[28px] bg-oh-ink p-5 text-oh-cream sm:p-7 md:grid-cols-2 md:p-9">
          <div className="flex flex-col gap-3">
            <h2 id="menu-marks-title" className={`m-0 text-xl font-semibold ${bodyClass}`}>
              {t("marks.title")}
            </h2>
            <Legend />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className={`m-0 text-xl font-semibold ${bodyClass}`}>{t("allergens.title")}</h2>
            <p className={`m-0 text-base leading-relaxed text-oh-cream/80 ${bodyClass}`}>{t("allergens.body")}</p>
            <Link href={`/${locale}/contact`} className={`inline-flex min-h-11 w-fit items-center gap-1.5 text-base font-semibold text-oh-cream underline decoration-oh-gold underline-offset-4 ${FOCUS_NIGHT}`}>
              {t("allergens.link")}
            </Link>
          </div>
        </Reveal>
      </div>

      <ItemSheet item={selected} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function Price({ cents, className }: { cents: number; className?: string }) {
  const t = useTranslations("menuPage");
  const locale = useLocale();
  return <span className={`tabular-nums ${className ?? ""}`}>{cents > 0 ? formatCents(cents, locale) : t("included")}</span>;
}

function EarlySeal({ size = 24 }: { size?: number }) {
  const t = useTranslations("menuPage");
  return (
    <span data-menu-early className="inline-flex items-center gap-1.5 text-sm font-semibold text-oh-clay">
      <Seal iconKey="early-access" name={t("early")} size={size} />
      {t("early")}
    </span>
  );
}

function Thumb({ item, size, priority = false }: { item: MenuCard; size: "sm" | "lg"; priority?: boolean }) {
  if (!item.photo) return <Icon name="bowl" size={size === "sm" ? 28 : 64} className="text-oh-clay/60" />;
  if (item.photo.kind === "site") {
    return (
      <span className="absolute inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
        <SitePicture image={item.photo.key} sizes={size === "sm" ? "64px" : "(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"} priority={priority} alt="" className="block h-full w-full" />
      </span>
    );
  }
  return <OptimizedImg src={item.photo.src} alt="" sizes={size === "sm" ? "64px" : "(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"} priority={priority} className="absolute inset-0 h-full w-full object-cover" />;
}

function FeatureCard({ item, onOpen, priority }: { item: MenuCard; onOpen: (i: MenuCard) => void; priority: boolean }) {
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  return (
    <button
      type="button"
      data-menu-item={item.id}
      aria-haspopup="dialog"
      onClick={() => onOpen(item)}
      className={`group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-3xl border-0 bg-oh-paper p-0 text-left text-oh-ink shadow-[0_1px_0_rgba(42,39,36,0.08)] ${FOCUS}`}
    >
      <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-oh-linen [&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-[1.03] motion-reduce:[&_img]:transition-none">
        <Thumb item={item} size="lg" priority={priority} />
      </span>
      <span className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        {item.early ? <EarlySeal /> : null}
        <span className="flex items-start justify-between gap-3">
          <span className={`min-w-0 text-[1.375rem] leading-tight [overflow-wrap:anywhere] ${cjk ? "font-display-cjk" : "font-display"}`}>{item.name}</span>
          <Price cents={item.priceCents} className="shrink-0 pt-1 text-base font-semibold" />
        </span>
        <span className="mt-auto flex min-h-6 items-center justify-between gap-3 pt-1">
          <DietaryMarks marks={item.marks} />
          <Icon name="chevron" size={18} className="ml-auto shrink-0 text-oh-ink/50" />
        </span>
      </span>
    </button>
  );
}

function ItemRow({ item, onOpen }: { item: MenuCard; onOpen: (i: MenuCard) => void }) {
  return (
    <button
      type="button"
      data-menu-item={item.id}
      aria-haspopup="dialog"
      onClick={() => onOpen(item)}
      className={`flex min-h-[72px] w-full cursor-pointer items-center gap-3 rounded-2xl border-0 bg-transparent px-0 py-3 text-left text-oh-ink ${FOCUS}`}
    >
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-oh-paper">
        <Thumb item={item} size="sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {item.early ? <EarlySeal size={20} /> : null}
        <span className="text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">{item.name}</span>
        <DietaryMarks marks={item.marks} />
      </span>
      <Price cents={item.priceCents} className="shrink-0 text-base font-semibold" />
      <Icon name="chevron" size={18} className="shrink-0 text-oh-ink/50" />
    </button>
  );
}

function SlidersPanel({ rows, titleClass, bodyClass }: { rows: MenuSliderRow[]; titleClass: string; bodyClass: string }) {
  const t = useTranslations("menuPage");
  return (
    <Reveal as="section" id="menu-customize" data-menu-section="customize" data-menu-sliders aria-labelledby="menu-customize-title" className={`scroll-mt-20 p-5 sm:p-7 md:p-9 ${PANEL}`}>
      <header className="flex flex-col gap-1">
        <h2 id="menu-customize-title" className={titleClass}>
          {t("groups.customize.title")}
        </h2>
        <p className={`m-0 text-base text-oh-stone ${bodyClass}`}>{t("groups.customize.line")}</p>
      </header>
      <dl className="m-0 mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id} data-menu-slider={row.id} className="flex flex-col gap-2 border-t border-oh-ink/10 py-3 first:border-t-0 md:[&:nth-child(2)]:border-t-0">
            <dt className="text-[17px] font-semibold">{row.name}</dt>
            <dd className="m-0">
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {row.options.map((opt, i) => (
                  <li
                    key={`${i}-${opt}`}
                    data-slider-option={i === row.defaultIndex ? "default" : "option"}
                    className={`inline-flex min-h-8 items-center rounded-full px-3 text-sm ${i === row.defaultIndex ? "bg-oh-ink text-oh-cream" : "bg-oh-paper text-oh-ink"}`}
                  >
                    <span data-slider-label>{opt}</span>
                    {i === row.defaultIndex ? <span className="sr-only"> ({t("sliderDefault")})</span> : null}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}

function Legend() {
  const t = useTranslations("menuPage.marks");
  const rows: { key: string; icon: "leaf" | "wheat-off" | "flame"; count: number; label: string; tone: string }[] = [
    { key: "vegan", icon: "leaf", count: 1, label: `${t("vegan")} / ${t("vegetarian")}`, tone: "text-oh-olive-light" },
    { key: "gf", icon: "wheat-off", count: 1, label: t("glutenFree"), tone: "text-oh-gold" },
    { key: "s1", icon: "flame", count: 1, label: t("spice1"), tone: "text-oh-ember-light" },
    { key: "s2", icon: "flame", count: 2, label: t("spice2"), tone: "text-oh-ember-light" },
    { key: "s3", icon: "flame", count: 3, label: t("spice3"), tone: "text-oh-ember-light" },
  ];
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 text-base text-oh-cream">
          <span aria-hidden="true" className={`inline-flex w-14 ${r.tone}`}>
            {Array.from({ length: r.count }, (_, i) => (
              <Icon key={i} name={r.icon} size={20} className={i ? "-ml-1" : undefined} />
            ))}
          </span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}
