"use client";

/**
 * Task D1, chapter 3: The pod. Pinned for 3 screens.
 *
 * Three beats on --progress, each with its own caption:
 *   a. pod-hatch-a (MaleClosedPod): your pod, the panel closed.
 *   b. pod-hatch-b (Image 5): the kitchen behind the closed glass hatch.
 *   c. pod-hatch-open (OpenPod): the hatch open, water coming through.
 *
 * b and c share one 1448x1086 frame (the room, pod, tablet and hatch line
 * up), so c opens inside b:
 *   1. Reveal (0.40 to 0.58): an OpenPod layer clipped to the measured hatch
 *      quad (`.hm-pod-hatch` variables, in photo percent) grows from the
 *      hatch's bottom edge up, like the glass lifting, with Image 5's closed
 *      glass kept crisp above the edge. A warm light line rides the leading
 *      edge and the revealed kitchen is lifted slightly.
 *   2. Handoff (0.42 to 0.60): a full-frame OpenPod crossfade under the hatch
 *      layers brings in her reaching arm (her pose, the bowl and chopsticks
 *      differ between the photos, so they cannot be clipped in). Her hand
 *      sits inside the opening, so a feathered hole keeps it out of the hatch
 *      layers and it arrives with the arm instead of being cut at the jamb.
 *   3. Settle (0.62 to 0.68): the lift eases off and the reveal layer fades
 *      out over the finished handoff, so the last frame is exactly OpenPod.
 * Every layer sits inside `.hm-cover` (the photo's own 4:3 box), so the clip
 * stays on the hatch however the cover box crops on a phone (--hm-fx).
 *
 * Reduced motion: PinnedStory's static mode, and here the three photos with
 * their captions as a plain sequence (the last one open, as photographed).
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
  { key: "a", image: "pod-hatch-a", at: -1, until: 0.25 },
  { key: "b", image: "pod-hatch-b", at: 0.26, until: 0.49 },
  { key: "c", image: "pod-hatch-open", at: 0.5, until: 2 },
];

// Timeline (in --progress). --hm-k is 1 / duration for `.hm-ramp`.
// a holds to 0.18, b holds 0.28 to 0.40, c holds from 0.68.
const B_IN = { at: 0.18, k: 10 }; // pod-hatch-a to pod-hatch-b crossfade
const REVEAL = { at: 0.4, k: 1 / 0.18 }; // hatch opens, bottom edge up
const HANDOFF = { at: 0.42, k: 1 / 0.18 }; // full-frame crossfade to OpenPod (her arm)
const SETTLE = { at: 0.62, k: 1 / 0.06 }; // after the handoff: the lift eases off, the reveal layer leaves

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

  const reveal = vars({ "--at": REVEAL.at, "--hm-k": REVEAL.k, "--settle-at": SETTLE.at, "--settle-k": SETTLE.k });

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
              <div className="hm-cover hm-pod-hatch [--hm-fx:40%] md:[--hm-fx:50%]">
                <div className="absolute inset-0">
                  <SitePicture image="pod-hatch-a" sizes={COVER_SIZES} alt={ti(SITE_IMAGES["pod-hatch-a"].alt)} className={PICTURE} />
                </div>
                <div className="hm-ramp hm-fade absolute inset-0" style={vars({ "--at": B_IN.at, "--hm-k": B_IN.k })}>
                  <SitePicture image="pod-hatch-b" sizes={COVER_SIZES} alt={ti(SITE_IMAGES["pod-hatch-b"].alt)} className={PICTURE} />
                </div>
                {/* Handoff: the whole OpenPod frame (her arm, the room), under the hatch layers. */}
                <div className="hm-ramp hm-fade absolute inset-0" style={vars({ "--at": HANDOFF.at, "--hm-k": HANDOFF.k })}>
                  <SitePicture image="pod-hatch-open" sizes={COVER_SIZES} alt={ti(SITE_IMAGES["pod-hatch-open"].alt)} className={PICTURE} />
                </div>
                {/* The glass still closed above the leading edge, crisp while the handoff runs. */}
                <div aria-hidden="true" className="hm-ramp hm-hatch-pane absolute inset-0" style={reveal}>
                  <SitePicture image="pod-hatch-b" sizes={COVER_SIZES} alt="" className={PICTURE} />
                </div>
                {/* The kitchen below the leading edge: OpenPod clipped to the hatch, opened bottom-up. */}
                <div aria-hidden="true" className="hm-ramp hm-hatch-reveal absolute inset-0" style={reveal}>
                  <SitePicture image="pod-hatch-open" sizes={COVER_SIZES} alt="" className={PICTURE} />
                </div>
                <div aria-hidden="true" className="hm-ramp hm-hatch-light absolute inset-0" style={reveal}>
                  <div className="hm-hatch-soft absolute inset-0">
                    <div className="hm-hatch-band absolute inset-0" />
                  </div>
                  <div className="hm-hatch-crisp absolute inset-0">
                    <div className="hm-hatch-band absolute inset-0" />
                  </div>
                </div>
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
