"use client";

/**
 * Task D1, chapter 3: The pod. Pinned for 3 screens.
 *
 * Three photos crossfade on --progress (pod-hatch-a, then b, then c), each
 * with its own caption. On pod-hatch-b a hatch panel starts closed over the
 * opening and slides up out of the way. Fix round 1: the panel is a crop of
 * the photo's own slatted panel above the hatch (not a drawn SVG), so it
 * matches the room exactly. A
 * three-part progress rule tracks where you are.
 *
 * Reduced motion: PinnedStory's static mode, and here the three photos with
 * their captions as a plain sequence (hatch open, as photographed).
 */
import { useLocale, useTranslations } from "next-intl";
import { PinnedStory } from "@/components/site/motion/PinnedStory";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Eyebrow, Title } from "@/components/site/Text";
import { SITE_IMAGES, type ImageKey } from "@/lib/site/images";
import "./home.css";

const COVER_SIZES = "(max-aspect-ratio: 4/3) 134vh, 100vw";
const PICTURE = "absolute inset-0 block [&>img]:h-full [&>img]:w-full [&>img]:object-cover";

const STEPS: Array<{ key: "a" | "b" | "c"; image: ImageKey; at: number; until: number }> = [
  { key: "a", image: "pod-hatch-a", at: -1, until: 0.31 },
  { key: "b", image: "pod-hatch-b", at: 0.33, until: 0.64 },
  { key: "c", image: "pod-hatch-c", at: 0.66, until: 2 },
];

function vars(v: Record<string, string | number>) {
  return v as React.CSSProperties;
}

export function ThePod() {
  const t = useTranslations("home.pod");
  const ti = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const serif = locale.startsWith("zh") ? "font-display-cjk" : "font-display";

  const heading = (
    <Title id="the-pod-title" locale={locale} className="m-0">
      <Eyebrow as="span" locale={locale} className="text-oh-ember-light">
        {t("eyebrow")}
      </Eyebrow>
    </Title>
  );

  return (
    <section id="the-pod" data-chapter="the-pod" aria-labelledby="the-pod-title" className="relative">
      <PinnedStory screens={3} className="hm-story">
        {() =>
          reduced ? (
            <div className="w-full px-5 py-16 md:px-8 md:py-24">
              <div className="mx-auto max-w-6xl">
                {heading}
                <ol className="m-0 mt-6 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-6">
                  {STEPS.map((s) => (
                    <li key={s.key} data-pod-step={s.key} className="min-w-0">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                        <SitePicture image={s.image} sizes="(min-width: 768px) 33vw, 100vw" alt={ti(SITE_IMAGES[s.image].alt)} className={PICTURE} />
                      </div>
                      <h3 className="m-0 mt-5 text-xl font-semibold leading-snug text-oh-cream">{t(`steps.${s.key}.title`)}</h3>
                      <p className="m-0 mt-2 text-base leading-relaxed text-oh-cream/80">{t(`steps.${s.key}.body`)}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full overflow-hidden bg-oh-charcoal">
              <div className="hm-cover [--hm-fx:40%] md:[--hm-fx:50%]">
                {STEPS.map((s, i) => (
                  <div
                    key={s.key}
                    className={i === 0 ? "absolute inset-0" : "hm-ramp hm-fade absolute inset-0"}
                    style={i === 0 ? undefined : vars({ "--at": s.at - 0.04, "--hm-k": 7 })}
                  >
                    <SitePicture image={s.image} sizes={COVER_SIZES} alt={ti(SITE_IMAGES[s.image].alt)} className={PICTURE} />
                    {s.key === "b" ? (
                      <div aria-hidden="true" className="absolute left-[16.9%] top-[31.2%] h-[19.4%] w-[35%] overflow-hidden">
                        {/* The panel is the photo's own slatted panel directly above the
                            hatch (photo y 11.8% to 31.2%), shifted down over the opening, so
                            its wood, pitch and light match exactly. It slides up to open. */}
                        <div className="hm-ramp hm-hatch-panel absolute inset-0 shadow-[inset_0_-2px_0_color-mix(in_oklab,var(--color-oh-charcoal)_60%,transparent)]" style={vars({ "--at": 0.4, "--hm-k": 6 })}>
                          <div className="absolute left-[-48.29%] top-[-61.34%] h-[515.46%] w-[285.71%]">
                            <SitePicture image="pod-hatch-b" sizes={COVER_SIZES} alt="" className={PICTURE} />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,var(--color-oh-charcoal)_0%,color-mix(in_oklab,var(--color-oh-charcoal)_85%,transparent)_50%,transparent_100%)] px-5 pb-[calc(var(--dock-h)+2rem)] pt-36 md:px-8 md:pb-16">
                <div className="mx-auto max-w-6xl">
                  <div className="max-w-xl">
                    {heading}
                    <div aria-hidden="true" className="mt-4 grid grid-cols-3 gap-1.5">
                      {STEPS.map((s) => (
                        <span key={s.key} className="block h-0.5 overflow-hidden rounded-full bg-oh-cream/20">
                          <span className="hm-seg-fill block h-full bg-oh-gold" style={vars({ "--at": Math.max(0, s.at), "--span": Math.min(s.until, 1) - Math.max(0, s.at) })} />
                        </span>
                      ))}
                    </div>
                    <ol className="relative m-0 mt-5 grid list-none p-0">
                      {STEPS.map((s) => (
                        <li
                          key={s.key}
                          data-pod-step={s.key}
                          className="hm-window col-start-1 row-start-1 min-w-0"
                          style={vars({ "--at": s.at, "--until": s.until })}
                        >
                          <h3 className={`m-0 ${serif} text-[clamp(1.6rem,6.6vw,2.75rem)] font-normal leading-[1.1] text-oh-cream [text-wrap:balance]`}>
                            {t(`steps.${s.key}.title`)}
                          </h3>
                          <p className="m-0 mt-3 text-base leading-relaxed text-oh-cream/85 md:text-lg">{t(`steps.${s.key}.body`)}</p>
                        </li>
                      ))}
                    </ol>
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
