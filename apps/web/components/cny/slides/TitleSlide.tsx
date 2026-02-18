"use client";

import Image from "next/image";
import { AnimatedBackground } from "../AnimatedBackground";

export function TitleSlide() {
  return (
    <>
      {/* RedTitle.svg IS the full slide - no separate background needed */}
      <Image
        src="/cny/slides/RedTitle.svg"
        alt="Year of the Horse 2026"
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
