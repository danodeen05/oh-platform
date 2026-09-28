/**
 * Task D2: the six steps of a visit (arrive, order, walk, settle, taste,
 * leave), each one screen tall, with the journey map pinned beside them.
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
import { getTranslations } from "next-intl/server";
import { buildLayout, LOCATION_LAYOUTS } from "@oh/floor-plan";
import type { CombMapLabels } from "@/components/site/floor-plan/CombMap";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { EXPERIENCE_LAYOUT, EXPERIENCE_STEPS, type ExperienceStep } from "@/lib/site/experience";
import { stepProgress } from "@/lib/site/experience-progress";
import { SITE_IMAGES, type ImageKey } from "@/lib/site/images";
import { JourneyMap } from "./JourneyMap";

/** `position` is a full literal class (Tailwind only sees whole strings): on the <picture> for SITE_IMAGES, on the <img> for a plan file. */
type Photo = { site: ImageKey; position: string } | { own: string; w: number; h: number; position: string };

const PHOTOS: Record<ExperienceStep, Photo> = {
  arrive: { site: "sign-pool", position: "[&>img]:object-[45%_50%]" },
  order: { site: "storefront-queue", position: "[&>img]:object-[80%_50%]" },
  walk: { site: "hall-rows-alt", position: "[&>img]:object-[50%_50%]" },
  settle: { site: "pod-hatch-c", position: "[&>img]:object-[58%_50%]" },
  taste: { site: "bowl-slices-top", position: "[&>img]:object-[50%_40%]" },
  // public/experience/leave-{780,1200}.{avif,webp}: site copies of the plan's experience-leave.webp (the plan's /plan/ folder is private).
  leave: { own: "/experience/leave", w: 1200, h: 900, position: "object-[72%_50%]" },
};

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
  const titleSize = locale.startsWith("zh") ? "max-w-[16em] text-[clamp(1.6rem,7vw,3rem)]!" : "max-w-[18ch] text-[clamp(1.9rem,8.4vw,3.25rem)]! [text-wrap:balance]";

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
