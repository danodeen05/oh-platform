"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { PhotoPlaceholder } from "@/components/plan/primitives/PhotoPlaceholder";

const STEPS = ["arrive", "order", "walk", "settle", "panel", "taste", "leave"] as const;

function Step({ index, keyName }: { index: number; keyName: (typeof STEPS)[number] }) {
  const t = useTranslations("plan.experience");
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Scroll-linked, not scroll-triggered: opacity and lift follow the viewport position (spec 3.3).
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 90%", "start 45%"] });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.25, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const even = index % 2 === 0;
  return (
    <motion.article ref={ref} style={reduce ? undefined : { opacity, y }} className={["grid items-center gap-6 md:gap-12", even ? "md:grid-cols-[1fr_1.1fr]" : "md:grid-cols-[1.1fr_1fr]"].join(" ")}>
      <div className={even ? "" : "md:order-2"}>
        <p className="m-0 mb-2 font-display text-[0.9rem] tabular-nums tracking-[0.2em] text-oh-ember">{String(index + 1).padStart(2, "0")}</p>
        <h2 className="m-0 font-display text-[clamp(1.7rem,3.5vw,2.4rem)] leading-[1.05] text-oh-cream">{t(`steps.${keyName}.title`)}</h2>
        <p className="m-0 mt-4 max-w-md text-[1.02rem] leading-relaxed text-oh-mute">{t(`steps.${keyName}.body`)}</p>
      </div>
      <PhotoPlaceholder label={t("photoLabel")} needs={t(`steps.${keyName}.photo`)} className={even ? "" : "md:order-1"} />
    </motion.article>
  );
}

/**
 * The Experience (spec 6.6): one guest's visit, arrival to last bite, told
 * with the real mark and photo slots that name the shot they are waiting
 * for. The kiosk demo is embedded live in a device frame.
 */
export function ExperienceModule() {
  const t = useTranslations("plan.experience");
  const locale = useLocale();
  return (
    <div data-plan-module="experience" className="flex flex-col gap-20 md:gap-28">
      <div className="mx-auto max-w-2xl text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Oh_Logo_Mark_Light.png" alt="" width={72} height={72} className="mx-auto mb-6 h-16 w-auto opacity-90" />
        <p className="m-0 font-display text-[clamp(1.4rem,2.8vw,1.9rem)] leading-snug text-oh-cream">{t("intro")}</p>
      </div>
      {STEPS.map((k, i) => (
        <Step key={k} index={i} keyName={k} />
      ))}
      <section className="grid items-start gap-8 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-gold">{t("kiosk.eyebrow")}</p>
          <h2 className="m-0 font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] text-oh-cream">{t("kiosk.title")}</h2>
          <p className="m-0 mt-4 text-[1rem] leading-relaxed text-oh-mute">{t("kiosk.body")}</p>
          <a href={`/${locale}/kiosk`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[0.85rem] text-oh-ember underline-offset-2 hover:underline">{t("kiosk.open")}</a>
        </div>
        <div className="mx-auto w-full max-w-[380px]">
          <div className="rounded-[2rem] border-[6px] border-oh-stone bg-oh-ink p-2 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
            <div className="overflow-hidden rounded-[1.4rem] bg-oh-charcoal" style={{ aspectRatio: "9 / 16" }}>
              <iframe src={`/${locale}/kiosk`} title={t("kiosk.title")} loading="lazy" className="h-full w-full border-0" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
