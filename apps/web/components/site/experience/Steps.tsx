/**
 * Task D2: the eight steps of a visit (arrive, order, walk, settle, status,
 * panel, taste, leave; the status and panel steps came with the 2026-09-28
 * follow-up), each at least one screen tall, with the journey map pinned
 * beside them.
 *
 * The status step has no photo: it holds the real order status page, live
 * in a phone (StatusPhone, a lazy iframe of the DEMO-PLAN order), and the
 * page's six features: a SnapRail of cards under the phone on phones, a
 * list beside it from 768px. It runs taller than one screen on phones.
 *
 * Phones (below 1024px): every step fills the space between the top bar
 * and the dock, full-bleed photo under the copy, and the page snaps step to
 * step (`scroll-snap-type: y mandatory` on the document, experience.css).
 * The map is a small card pinned to the top right while the steps pass
 * under it (a zero-height sticky row, so it never takes layout space).
 *
 * Desktop: two columns. The steps scroll on the left as framed photos with
 * their copy; the map panel is sticky on the right, with the step caption
 * and a stepper.
 *
 * Server-rendered. The only client islands are the map, Reveal for the
 * copy, and the photo's scroll-driven settle (pure CSS).
 *
 * Photos: SITE_IMAGES (AVIF/WebP at 390/780/1200 through SitePicture) for
 * five steps. The last one (the store on the way out) is the plan's
 * `experience-leave.webp`, copied to public/experience/ as AVIF and WebP at
 * 780 and 1200 so the site never loads from the plan's private /plan/ folder.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buildLayout, LOCATION_LAYOUTS } from "@oh/floor-plan";
import type { CombMapLabels } from "@/components/site/floor-plan/CombMap";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SnapRail } from "@/components/site/motion/SnapRail";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { statusDemoSrc } from "@/lib/plan/statusDemo";
import { EXPERIENCE_LAYOUT, EXPERIENCE_STEPS, type ExperienceStep } from "@/lib/site/experience";
import { stepProgress } from "@/lib/site/experience-progress";
import { SITE_IMAGES, type ImageKey } from "@/lib/site/images";
import { JourneyMap } from "./JourneyMap";
import { StatusPhone } from "./StatusPhone";

/** `position` is a full literal class (Tailwind only sees whole strings): on the <picture> for SITE_IMAGES, on the <img> for a plan file. */
type Photo = { site: ImageKey; position: string } | { own: string; w: number; h: number; position: string };

/** Every step but status (which shows the live phone) has a photo. */
type PhotoStep = Exclude<ExperienceStep, "status">;

const PHOTOS: Record<PhotoStep, Photo> = {
  arrive: { site: "sign-pool", position: "[&>img]:object-[45%_50%]" },
  order: { site: "storefront-queue", position: "[&>img]:object-[80%_50%]" },
  walk: { site: "hall-rows-alt", position: "[&>img]:object-[50%_50%]" },
  settle: { site: "pod-hatch-c", position: "[&>img]:object-[58%_50%]" },
  // OpenPod: the hatch open, a glass of water coming through, the bowl already on the counter.
  panel: { site: "pod-hatch-open", position: "[&>img]:object-[40%_50%]" },
  taste: { site: "bowl-slices-top", position: "[&>img]:object-[50%_40%]" },
  // public/experience/leave-{780,1200}.{avif,webp}: site copies of the plan's experience-leave.webp (the plan's /plan/ folder is private).
  leave: { own: "/experience/leave", w: 1200, h: 900, position: "object-[72%_50%]" },
};

/** The status page's six features, in the plan's order, each with an in-house icon. */
const STATUS_FEATURES = [
  { key: "feed", icon: "flame" },
  { key: "fortune", icon: "seal" },
  { key: "more", icon: "plus" },
  { key: "staff", icon: "bell" },
  { key: "roast", icon: "spark" },
  { key: "redStep", icon: "gift" },
] as const satisfies readonly { key: string; icon: IconName }[];

/** The food step sits on linen (spec: linen panels for food). */
const LINEN: ReadonlySet<ExperienceStep> = new Set(["taste"]);

// Phones draw the photo to cover a tall step (about 134vh wide for a 4:3); desktop frames it in the left column.
const SIZES = "(min-width: 1024px) 55vw, (max-aspect-ratio: 4/3) 134vh, 100vw";

export async function Steps({ locale }: { locale: string }) {
  const t = await getTranslations("experience");
  const ti = await getTranslations();
  const layout = buildLayout(LOCATION_LAYOUTS[EXPERIENCE_LAYOUT]);
  const label = layout.journeyTarget.label;
  const progress = stepProgress(layout);
  const total = EXPERIENCE_STEPS.length;
  // Latin titles balance within about 18 characters; a CJK title is one short line, sized to fit a phone without breaking mid-phrase.
  const titleSize = locale.startsWith("zh") ? "max-w-[16em] text-[clamp(1.45rem,6.3vw,3rem)]!" : "max-w-[18ch] text-[clamp(1.9rem,8.4vw,3.25rem)]! [text-wrap:balance]";

  const mapSteps = EXPERIENCE_STEPS.map((key, i) => ({
    key,
    name: t(`steps.${key}.eyebrow`),
    goLabel: t("stepper.go", { n: i + 1, name: t(`steps.${key}.eyebrow`) }),
    caption: t(`map.captions.${key}`, { label }),
  }));

  return (
    <div data-steps className="xp-steps relative mx-auto w-full max-w-[90rem] lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 lg:px-8">
      {/* Phones: a sticky row (the steps list overlaps it, so it takes no net space) holds the card at the top right. Desktop: the right column, sticky. */}
      <div className="xp-map-pin sticky z-20 lg:top-[calc(3.5rem+2rem)] lg:col-start-2 lg:row-start-1 lg:h-auto lg:self-start lg:py-16">
        <div className="xp-map-card absolute right-3 top-0 lg:static lg:w-full">
          <JourneyMap
            comb={t.raw("map.comb") as CombMapLabels}
            title={t("map.title")}
            note={t("map.note")}
            stepperLabel={t("stepper.label")}
            steps={mapSteps}
            progress={progress}
          />
        </div>
      </div>

      <ol aria-label={t("stepper.label")} className="xp-step-list m-0 list-none p-0 lg:col-start-1 lg:row-start-1">
        {EXPERIENCE_STEPS.map((key, i) => {
          if (key === "status") return <StatusStep key={key} locale={locale} index={i} total={total} titleSize={titleSize} />;
          const photo = PHOTOS[key];
          const linen = LINEN.has(key);
          const number = String(i + 1).padStart(2, "0");
          const titleId = `step-${key}-title`;
          const imgClass = `block h-full w-full object-cover ${photo.position}`;
          return (
            <li
              key={key}
              id={`step-${key}`}
              data-step={key}
              tabIndex={-1}
              aria-labelledby={titleId}
              className={`xp-snap xp-step relative isolate flex flex-col justify-end overflow-hidden outline-none lg:justify-center lg:overflow-visible lg:py-16 ${linen ? "bg-oh-linen lg:bg-transparent" : ""}`}
            >
              <div className={`xp-photo absolute inset-0 -z-10 overflow-hidden lg:relative lg:inset-auto lg:z-auto lg:h-[min(62svh,40rem)] lg:rounded-[1.75rem] ${linen ? "bg-oh-linen" : "bg-oh-ink"}`}>
                {"site" in photo ? (
                  <SitePicture
                    image={photo.site}
                    sizes={SIZES}
                    phoneMaxWidth={780}
                    alt={ti(SITE_IMAGES[photo.site].alt)}
                    className={`block h-full w-full [&>img]:h-full [&>img]:w-full [&>img]:object-cover ${photo.position}`}
                  />
                ) : (
                  <picture className="block h-full w-full">
                    <source type="image/avif" srcSet={`${photo.own}-780.avif 780w, ${photo.own}-1200.avif 1200w`} sizes={SIZES} />
                    <source type="image/webp" srcSet={`${photo.own}-780.webp 780w, ${photo.own}-1200.webp 1200w`} sizes={SIZES} />
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static files; next/image stays off (site) pages (G2a) */}
                    <img src={`${photo.own}-780.webp`} alt={t(`steps.${key}.alt`)} width={photo.w} height={photo.h} loading="lazy" decoding="async" className={imgClass} />
                  </picture>
                )}
                {/* Legibility on phones: the copy's ground at the bottom. */}
                <div
                  aria-hidden="true"
                  className={`absolute inset-0 lg:hidden ${
                    linen
                      ? "bg-[linear-gradient(to_bottom,transparent_0%,transparent_30%,color-mix(in_oklab,var(--color-oh-linen)_88%,transparent)_58%,var(--color-oh-linen)_78%)]"
                      : "bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-oh-charcoal)_35%,transparent)_0%,transparent_22%,transparent_36%,color-mix(in_oklab,var(--color-oh-charcoal)_80%,transparent)_62%,var(--color-oh-charcoal)_100%)]"
                  }`}
                />
              </div>

              <Reveal data-step-copy className="relative w-full px-5 pb-7 pt-8 sm:px-8 lg:max-w-2xl lg:px-0 lg:pb-0 lg:pt-8">
                <div className="flex items-baseline gap-3">
                  <span aria-hidden="true" className={`font-display text-2xl leading-none ${linen ? "text-oh-ember-deep lg:text-oh-gold" : "text-oh-gold"}`}>
                    {number}
                  </span>
                  <Eyebrow locale={locale} className={linen ? "text-oh-ember-deep lg:text-oh-ember-light" : "text-oh-ember-light"}>
                    <span className="sr-only">{t("stepper.of", { n: i + 1, total })}: </span>
                    {t(`steps.${key}.eyebrow`)}
                  </Eyebrow>
                </div>
                <Title
                  id={titleId}
                  locale={locale}
                  className={`m-0 mt-3 ${titleSize} leading-[1.08]! ${linen ? "text-oh-charcoal lg:text-oh-cream" : "text-oh-cream"}`}
                >
                  {t(`steps.${key}.title`)}
                </Title>
                <Body locale={locale} className={`m-0 mt-3 max-w-xl md:text-lg ${linen ? "text-oh-charcoal/85 lg:text-oh-cream/80" : "text-oh-cream/85"}`}>
                  {t(`steps.${key}.body`)}
                </Body>
              </Reveal>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const QUIET_LINK =
  "inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-cream/90 no-underline underline-offset-4 hover:text-oh-cream hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

/**
 * Step 05, the order status page. Phones: the phone preview first, in the
 * space beside the pinned map card, with "Try it live" under the card; then
 * the copy, the features as a SnapRail, and the link to the full page.
 * From 768px: the interactive phone with the features listed beside it,
 * then the copy, like the photo steps. The copy stays first in the DOM
 * (CSS `order` moves it), so it reads first. `#status` (the FAQ's link)
 * lands on the whole step.
 */
async function StatusStep({ locale, index, total, titleSize }: { locale: string; index: number; total: number; titleSize: string }) {
  const t = await getTranslations("experience.steps.status");
  const ts = await getTranslations("experience.stepper");
  const titleId = "step-status-title";
  const features = STATUS_FEATURES.map((f) => ({ ...f, title: t(`features.${f.key}.title`), body: t(`features.${f.key}.body`) }));

  return (
    <li
      id="step-status"
      data-step="status"
      tabIndex={-1}
      aria-labelledby={titleId}
      className="xp-snap xp-step xp-step-status relative isolate flex flex-col justify-start bg-oh-charcoal outline-none lg:justify-center lg:py-16"
    >
      <div id="status" className="flex scroll-mt-[calc(3.5rem+1rem)] flex-col">
        <Reveal data-step-copy className="relative order-2 w-full px-5 pt-6 sm:px-8 lg:max-w-2xl lg:px-0 lg:pt-8">
          <div className="flex items-baseline gap-3">
            <span aria-hidden="true" className="font-display text-2xl leading-none text-oh-gold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Eyebrow locale={locale} className="text-oh-ember-light">
              <span className="sr-only">{ts("of", { n: index + 1, total })}: </span>
              {t("eyebrow")}
            </Eyebrow>
          </div>
          <Title id={titleId} locale={locale} className={`m-0 mt-3 ${titleSize} leading-[1.08]! text-oh-cream`}>
            {t("title")}
          </Title>
          <Body locale={locale} className="m-0 mt-3 max-w-xl text-oh-cream/85 md:text-lg">
            {t("body")}
          </Body>
        </Reveal>

        <div data-status-media className="order-1 px-5 sm:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-8 lg:px-0">
          <StatusPhone
            src={statusDemoSrc(locale)}
            title={t("frame")}
            poster={t("poster")}
            posterIcon={<Icon name="bowl" size={40} />}
            tryLive={t("tryLive")}
            sheetLabel={t("sheetLabel")}
            close={t("close")}
            closeIcon={<Icon name="close" size={20} />}
          />
          {/* From 768px: the features, listed beside the phone. */}
          <ul aria-label={t("featuresLabel")} className="m-0 hidden list-none flex-col gap-5 p-0 md:flex">
            {features.map((f) => (
              <li key={f.key} data-status-feature={f.key} className="flex items-start gap-3.5">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oh-ink text-oh-gold ring-1 ring-oh-stone/70">
                  <Icon name={f.icon} size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-oh-cream">{f.title}</span>
                  <span className="mt-0.5 block text-[0.95rem] leading-snug text-oh-cream/75">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Phones: the features as a rail of cards under the phone. */}
        <div className="order-3 mt-6 md:hidden">
          {/* Focusable, so a keyboard can scroll the rail (axe: scrollable-region-focusable). */}
          <SnapRail label={t("featuresLabel")} data-status-rail tabIndex={0} className="pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream">
            {features.map((f) => (
              <div key={f.key} data-status-feature={f.key} className="flex w-[15.5rem] flex-col gap-2 rounded-2xl border border-oh-stone/70 bg-oh-ink p-4">
                <span className="text-oh-gold">
                  <Icon name={f.icon} size={26} />
                </span>
                <span className="text-base font-semibold text-oh-cream">{f.title}</span>
                <span className="text-[0.95rem] leading-snug text-oh-cream/75">{f.body}</span>
              </div>
            ))}
          </SnapRail>
        </div>

        <div className="order-4 mt-4 flex flex-col items-start gap-1 px-5 pb-7 sm:px-8 lg:mt-5 lg:px-0 lg:pb-0">
          <p className="m-0 max-w-xl text-sm leading-snug text-oh-mute">{t("hint")}</p>
          <Link href={statusDemoSrc(locale, { embed: false })} data-status-open className={QUIET_LINK}>
            {t("open")}
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </li>
  );
}
