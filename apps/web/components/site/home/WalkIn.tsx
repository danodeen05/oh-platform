"use client";

/**
 * Task D1, chapter 2: Walk in. Pinned for 2.5 screens.
 *
 * You start in the dim hall (hall-rows-alt). As you scroll, six row lights
 * come on in sequence, near to far, left and right (each overlay's opacity
 * follows --progress past its own threshold), the view eases forward, and
 * the lit hall (hall-rows) settles in. The plan's lines arrive one by one:
 * "You walk in and nobody greets you. That is the design."
 *
 * The overlays live in a 4:3 box that covers the stage exactly like the
 * photo does (.hm-cover), so they stay on the pod rows at any viewport.
 * Reduced motion: PinnedStory renders its static mode and this renders the
 * final state as plain flow, the lit hall and every line.
 */
import { useLocale, useTranslations } from "next-intl";
import { PinnedStory } from "@/components/site/motion/PinnedStory";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Eyebrow, Title } from "@/components/site/Text";
import { SITE_IMAGES } from "@/lib/site/images";
import "./home.css";

const COVER_SIZES = "(max-aspect-ratio: 4/3) 134vh, 100vw";
const PICTURE = "absolute inset-0 block [&>img]:h-full [&>img]:w-full [&>img]:object-cover";

// Row lights in photo percentages: near to far, alternating sides.
const ROW_LIGHTS = [
  { x: "25%", y: "44%", w: "14%", h: "46%", at: 0.06 },
  { x: "78%", y: "44%", w: "14%", h: "46%", at: 0.14 },
  { x: "35%", y: "46%", w: "8%", h: "34%", at: 0.22 },
  { x: "66%", y: "46%", w: "8%", h: "34%", at: 0.3 },
  { x: "41%", y: "48%", w: "5%", h: "24%", at: 0.38 },
  { x: "60%", y: "48%", w: "5%", h: "24%", at: 0.46 },
];

const LINES = [
  { key: "one", at: -1 },
  { key: "two", at: 0.16 },
  { key: "three", at: 0.36 },
  { key: "four", at: 0.58 },
] as const;

function vars(v: Record<string, string | number>) {
  return v as React.CSSProperties;
}

export function WalkIn() {
  const t = useTranslations("home.walkIn");
  const ti = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const altDim = ti(SITE_IMAGES["hall-rows-alt"].alt);
  const altLit = ti(SITE_IMAGES["hall-rows"].alt);

  const eyebrow = (
    <Eyebrow as="p" locale={locale} className="m-0 text-oh-ember-light">
      {t("eyebrow")}
    </Eyebrow>
  );

  return (
    <section id="walk-in" data-chapter="walk-in" aria-labelledby="walk-in-title" className="relative scroll-mt-0">
      <PinnedStory screens={2.5} className="hm-story">
        {() =>
          reduced ? (
            <div className="w-full px-5 py-16 md:px-8 md:py-24">
              <div className="mx-auto max-w-6xl">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <SitePicture image="hall-rows" sizes="(min-width: 1152px) 1152px, 100vw" alt={altLit} className={PICTURE} />
                </div>
                <div className="mt-8 max-w-2xl">
                  {eyebrow}
                  <Title id="walk-in-title" locale={locale} className="m-0 mt-3 text-[clamp(1.75rem,7vw,3.25rem)]! leading-[1.1]! text-oh-cream [text-wrap:balance]">
                    <span className="block">{t("lines.one")}</span>
                    <span className="block text-oh-gold">{t("lines.two")}</span>
                  </Title>
                  <p className="m-0 mt-5 text-base leading-relaxed text-oh-cream/85 md:text-lg">{t("lines.three")}</p>
                  <p className="m-0 mt-3 text-base leading-relaxed text-oh-cream/85 md:text-lg">{t("lines.four")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full overflow-hidden bg-oh-charcoal">
              <div className="hm-cover">
                <div className="hm-walk-zoom absolute inset-0">
                  <SitePicture image="hall-rows-alt" sizes={COVER_SIZES} alt={altDim} className={PICTURE} />
                  {ROW_LIGHTS.map((l, i) => (
                    <span key={i} aria-hidden="true" className="hm-ramp hm-row-light" style={vars({ "--x": l.x, "--y": l.y, "--w": l.w, "--h": l.h, "--at": l.at, "--hm-k": 7 })} />
                  ))}
                  <div className="hm-ramp hm-fade absolute inset-0" style={vars({ "--at": 0.56, "--hm-k": 4 })}>
                    <SitePicture image="hall-rows" sizes={COVER_SIZES} alt={altLit} className={PICTURE} />
                  </div>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,var(--color-oh-charcoal)_0%,color-mix(in_oklab,var(--color-oh-charcoal)_82%,transparent)_45%,transparent_100%)] px-5 pb-[calc(var(--dock-h)+2rem)] pt-32 md:px-8 md:pb-16">
                <div className="mx-auto max-w-6xl">
                  <div className="max-w-2xl">
                    {eyebrow}
                    <Title id="walk-in-title" locale={locale} className="m-0 mt-3 text-[clamp(1.75rem,7.4vw,3.5rem)]! leading-[1.1]! text-oh-cream [text-wrap:balance]">
                      <span className="hm-ramp hm-line block" style={vars({ "--at": LINES[0].at })}>
                        {t("lines.one")}
                      </span>
                      <span className="hm-ramp hm-line block text-oh-gold" style={vars({ "--at": LINES[1].at })}>
                        {t("lines.two")}
                      </span>
                    </Title>
                    <p className="hm-ramp hm-line m-0 mt-4 text-base leading-relaxed text-oh-cream/85 md:text-lg" style={vars({ "--at": LINES[2].at })}>
                      {t("lines.three")}
                    </p>
                    <p className="hm-ramp hm-line m-0 mt-2 text-base leading-relaxed text-oh-cream/85 md:text-lg" style={vars({ "--at": LINES[3].at })}>
                      {t("lines.four")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      </PinnedStory>
    </section>
  );
}
