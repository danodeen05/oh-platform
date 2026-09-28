"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { ZodiacAnimal, ZODIAC_COMPATIBLE } from "@/lib/cny/zodiac";
import { Attendee, ZODIAC_INCOMPATIBLE } from "@/lib/cny/slides-data";
import { ZODIAC_YEARS } from "@/lib/cny/zodiac-years";
import { AnimatedBackground } from "../AnimatedBackground";
import { AnimatedZodiacSVG } from "./AnimatedZodiacSVG";
import { AttendeeNames } from "./AttendeeNames";
import { ZodiacFortune } from "./ZodiacFortune";
import { CompatibilitySection } from "./CompatibilitySection";

interface ZodiacSlideProps {
  zodiac: ZodiacAnimal;
  background: "red" | "gray";
  attendees: Attendee[];
  allAttendeesByZodiac: Record<ZodiacAnimal, Attendee[]>;
}

export function ZodiacSlide({
  zodiac,
  background,
  attendees,
  allAttendeesByZodiac,
}: ZodiacSlideProps) {
  // Task D11: the zodiac copy (name, traits, fortune) in the reader's language.
  const t = useTranslations("cny");
  const years = ZODIAC_YEARS[zodiac];
  const traits = t.raw(`zodiac.traits.${zodiac}`) as string[];
  const compatibleZodiacs = ZODIAC_COMPATIBLE[zodiac];
  const incompatibleZodiacs = ZODIAC_INCOMPATIBLE[zodiac];

  // Get compatible and incompatible attendees
  const compatibleAttendees = compatibleZodiacs.flatMap(
    (z) => allAttendeesByZodiac[z] || []
  );
  const incompatibleAttendees = incompatibleZodiacs.flatMap(
    (z) => allAttendeesByZodiac[z] || []
  );

  const backgroundSrc =
    background === "red"
      ? "/cny/slides/RedBackground.svg"
      : "/cny/slides/GrayBackground.svg";

  return (
    <>
      {/* Background */}
      <Image src={backgroundSrc} alt="" fill className="slide-background" />

      {/* Animated effects overlay */}
      <div className="animated-bg-overlay">
        <AnimatedBackground
          theme={background === "red" ? "red" : "gold"}
          showBokeh={true}
          showSmoke={true}
          showLights={true}
          showFireworks={false}
          intensity={0.6}
        />
      </div>

      {/* Slide content */}
      <div className="slide-content zodiac-slide-content">
        {/* Left panel - Zodiac image */}
        <div className="zodiac-left-panel">
          <AnimatedZodiacSVG zodiac={zodiac} />
        </div>

        {/* Right panel - Info */}
        <div className="zodiac-right-panel">
          {/* Zodiac name */}
          <div>
            <h1 className="zodiac-name">{t(`zodiac.animals.${zodiac}`)}</h1>
            <p className="zodiac-traits">{traits.join(" · ")}</p>
            <p className="zodiac-years">{years.join(" · ")}</p>
          </div>

          {/* Attendees with this zodiac */}
          <AttendeeNames attendees={attendees} title={t("slides.atParty")} />

          {/* Fortune sections */}
          <ZodiacFortune
            lookForwardTo={t(`zodiac.fortunes.${zodiac}.lookForwardTo`)}
            thingsToAvoid={t(`zodiac.fortunes.${zodiac}.thingsToAvoid`)}
          />

          {/* Compatibility sections */}
          <CompatibilitySection
            title={t("slides.connect")}
            attendees={compatibleAttendees}
            type="compatible"
          />

          <CompatibilitySection
            title={t("slides.careful")}
            attendees={incompatibleAttendees}
            type="avoid"
          />
        </div>
      </div>
    </>
  );
}
