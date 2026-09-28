"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimatedBackground } from "../AnimatedBackground";

export function TitleSlide() {
  const t = useTranslations("cny");
  return (
    <>
      {/* RedTitle.svg IS the full slide - no separate background needed */}
      <Image
        src="/cny/slides/RedTitle.svg"
        alt={t("fortune.year")}
        fill
        className="slide-background title-background"
        priority
      />

      {/* Animated effects overlay */}
      <div className="animated-bg-overlay">
        <AnimatedBackground
          theme="red"
          showBokeh={true}
          showSmoke={true}
          showLights={true}
          showFireworks={true}
          intensity={0.8}
        />
      </div>
    </>
  );
}
