"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { PlanPhoto } from "@/components/plan/primitives/PlanPhoto";
import { PhoneFrame } from "@/components/plan/primitives/PhoneFrame";
import { statusDemoSrc } from "@/lib/plan/statusDemo";
import { KioskFrame } from "./KioskFrame";

/** The live kiosk opens on City Creek Mall so the demo skips the location picker. */
const KIOSK_DEMO_LOCATION_ID = "cmip6jbz700022nnnxxpmm5hf";
const STEPS = ["arrive", "order", "walk", "settle", "status", "panel", "taste", "leave"] as const;
type StepKey = (typeof STEPS)[number];
/** Rendered sizes of /plan/experience-<step>.webp; taste is the square bowl shot. "status" shows the live phone instead. */
const PHOTO_SIZE: Record<Exclude<StepKey, "status">, [number, number]> = { arrive: [1200, 900], order: [1200, 900], walk: [1200, 900], settle: [1200, 900], panel: [1200, 900], taste: [1200, 1200], leave: [1200, 900] };

interface Feature {
  title: string;
  body: string;
}

/** Step 05: the order status page, live in a phone, with what it does for the guest. */
function StatusMedia() {
  const t = useTranslations("plan.experience.steps.status");
  const locale = useLocale();
  return (
    <div className="flex flex-col items-center gap-3">
      <PhoneFrame src={statusDemoSrc(locale)} title={t("photo")} className="w-[300px] sm:w-[330px]" />
      <p className="m-0 max-w-[330px] text-center text-[0.78rem] leading-snug text-oh-mute">{t("hint")}</p>
      <a href={statusDemoSrc(locale, { embed: false })} target="_blank" rel="noreferrer" className="text-[0.8rem] text-oh-ember-light underline-offset-2 hover:underline">
        {t("open")}
      </a>
    </div>
  );
}

function StatusFeatures() {
  const t = useTranslations("plan.experience.steps.status");
  const features = t.raw("features") as Feature[];
  return (
    <ul className="m-0 mt-6 grid list-none gap-x-6 gap-y-4 p-0 sm:grid-cols-2">
      {features.map((f) => (
        <li key={f.title} className="border-l-2 border-oh-gold/70 pl-3">
          <p className="m-0 text-[0.92rem] font-semibold text-oh-cream">{f.title}</p>
          <p className="m-0 mt-0.5 text-[0.85rem] leading-snug text-oh-mute">{f.body}</p>
        </li>
      ))}
    </ul>
  );
}

function Step({ index, keyName }: { index: number; keyName: StepKey }) {
  const t = useTranslations("plan.experience");
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Scroll-linked, not scroll-triggered: opacity and lift follow the viewport position (spec 3.3).
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 90%", "start 45%"] });
  const y = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const even = index % 2 === 0;
  return (
    <article ref={ref} className={["grid items-center gap-6 md:gap-12", even ? "md:grid-cols-[1fr_1.1fr]" : "md:grid-cols-[1.1fr_1fr]"].join(" ")}>
      <motion.div style={reduce ? undefined : { y }} className={even ? "" : "md:order-2"}>
        <p className="m-0 mb-2 font-display text-[0.9rem] tabular-nums tracking-[0.2em] text-oh-ember-light">{String(index + 1).padStart(2, "0")}</p>
        <h2 className="m-0 font-display text-[clamp(1.7rem,3.5vw,2.4rem)] leading-[1.05] text-oh-cream">{t(`steps.${keyName}.title`)}</h2>
        <p className="m-0 mt-4 max-w-md text-[1.02rem] leading-relaxed text-oh-mute">{t(`steps.${keyName}.body`)}</p>
        {keyName === "status" ? <StatusFeatures /> : null}
      </motion.div>
      <motion.div style={reduce ? undefined : { y }} className={even ? "" : "md:order-1"}>
        {keyName === "status" ? (
          <StatusMedia />
        ) : (
          <PlanPhoto src={`/plan/experience-${keyName}.webp`} alt={t(`steps.${keyName}.photo`)} width={PHOTO_SIZE[keyName][0]} height={PHOTO_SIZE[keyName][1]} note={t("photoNote")} priority={index === 0} />
        )}
      </motion.div>
    </article>
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
        <img src="/plan/mark-light-176.png" alt="" width={72} height={72} className="mx-auto mb-6 h-16 w-auto opacity-90" />
        <p className="m-0 font-display text-[clamp(1.4rem,2.8vw,1.9rem)] leading-snug text-oh-cream">{t("intro")}</p>
      </div>
      {STEPS.map((k, i) => (
        <Step key={k} index={i} keyName={k} />
      ))}
      <section className="flex flex-col gap-8">
        <div className="max-w-2xl">
          <p className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-gold">{t("kiosk.eyebrow")}</p>
          <h2 className="m-0 font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05] text-oh-cream">{t("kiosk.title")}</h2>
          <p className="m-0 mt-4 text-[1rem] leading-relaxed text-oh-mute">{t("kiosk.body")}</p>
          <a href={`/${locale}/kiosk?locationId=${KIOSK_DEMO_LOCATION_ID}&fit=1`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[0.85rem] text-oh-ember-light underline-offset-2 hover:underline">{t("kiosk.open")}</a>
        </div>
        <KioskFrame src={`/${locale}/kiosk?locationId=${KIOSK_DEMO_LOCATION_ID}&fit=1`} title={t("kiosk.title")} />
      </section>
    </div>
  );
}
