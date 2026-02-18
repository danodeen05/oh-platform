"use client";

import Image from "next/image";
import { ZodiacAnimal, ZODIAC_COMPATIBLE } from "@/lib/cny/zodiac";
import {
  Attendee,
  ZODIAC_FORTUNES,
  ZODIAC_SVG_FILES,
  ZODIAC_INCOMPATIBLE,
} from "@/lib/cny/slides-data";
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
  const fortune = ZODIAC_FORTUNES[zodiac];
  const years = ZODIAC_YEARS[zodiac];
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
            <h1 className="zodiac-name">{zodiac}</h1>
            <p className="zodiac-years">{years.join(" · ")}</p>
          </div>

          {/* Attendees with this zodiac */}
          <AttendeeNames
            attendees={attendees}
            title="At the Party Tonight"
            icon="🎉"
          />

          {/* Fortune sections */}
          <ZodiacFortune
            lookForwardTo={fortune.lookForwardTo}
            thingsToAvoid={fortune.thingsToAvoid}
          />

          {/* Compatibility sections */}
          <CompatibilitySection
            title="Connect With Tonight"
            icon="✨"
            attendees={compatibleAttendees}
            type="compatible"
          />

          <CompatibilitySection
            title="Tread Carefully With Tonight"
            icon="⚡"
            attendees={incompatibleAttendees}
            type="avoid"
          />
        </div>
      </div>
    </>
  );
}
