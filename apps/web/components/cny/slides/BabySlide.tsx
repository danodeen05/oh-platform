"use client";

import Image from "next/image";
import { Attendee } from "@/lib/cny/slides-data";
import { ZodiacAnimal, ZODIAC_COMPATIBLE } from "@/lib/cny/zodiac";
import { AnimatedBackground } from "../AnimatedBackground";

interface BabySlideProps {
  allAttendeesByZodiac: Record<ZodiacAnimal, Attendee[]>;
}

// Horse babies' compatible zodiacs (Tiger, Goat, Dog)
const HORSE_COMPATIBLE: ZodiacAnimal[] = ["Tiger", "Goat", "Dog"];

// Year of the Horse baby info
const BABIES_2026 = [
  {
    parents: "Payton & Sadee Didericksen",
    nickname: "Baby Didericksen #1",
  },
  {
    parents: "Ty & Cozy Didericksen",
    nickname: "Baby Didericksen #2",
  },
];

export function BabySlide({ allAttendeesByZodiac }: BabySlideProps) {
  // Get compatible guests for the Horse babies
  const compatibleGuests = HORSE_COMPATIBLE.flatMap(
    (z) => allAttendeesByZodiac[z] || []
  );

  // Get first names grouped by zodiac
  const compatibleByZodiac = HORSE_COMPATIBLE.reduce(
    (acc, zodiac) => {
      const guests = allAttendeesByZodiac[zodiac] || [];
      if (guests.length > 0) {
        acc[zodiac] = guests.map((g) => g.name.split(" ")[0]).slice(0, 4);
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <>
      {/* Special golden background for babies */}
      <Image
        src="/cny/slides/GrayBackground.svg"
        alt=""
        fill
        className="slide-background"
      />

      {/* Extra celebratory animated effects */}
      <div className="animated-bg-overlay">
        <AnimatedBackground
          theme="gold"
          showBokeh={true}
          showSmoke={true}
          showLights={true}
          showFireworks={true}
          intensity={1}
        />
      </div>

      {/* Baby slide content */}
      <div className="slide-content baby-slide-content">
        {/* Left panel - Horse image */}
        <div className="zodiac-left-panel">
          <div className="zodiac-svg-container baby-zodiac">
            <Image
              src="/cny/slides/Zodiacs/Horse.svg"
              alt="Year of the Horse"
              width={500}
              height={500}
              className="zodiac-svg baby-horse"
              priority
            />
          </div>
        </div>

        {/* Right panel - Baby info */}
        <div className="zodiac-right-panel baby-info-panel">
          {/* Header */}
          <div className="baby-header">
            <h1 className="baby-title">Welcome to the Herd!</h1>
            <p className="baby-subtitle">
              Year of the Horse Babies Arriving 2026
            </p>
          </div>

          {/* Expecting parents */}
          <div className="slide-section baby-parents-section">
            <h2 className="section-header">
              <span className="section-header-icon">🐴</span>
              Expecting Parents
            </h2>
            <div className="baby-parents-list">
              {BABIES_2026.map((baby, i) => (
                <div key={i} className="baby-parent-item">
                  <span className="parent-names">{baby.parents}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Horse baby traits */}
          <div className="slide-section baby-traits-section">
            <h2 className="section-header">
              <span className="section-header-icon">✨</span>
              Born Under Lucky Stars
            </h2>
            <p className="fortune-text">
              2026 Horse babies are blessed with natural charisma, boundless
              energy, and an adventurous spirit. They'll grow up confident,
              independent, and destined to lead with warmth and passion.
            </p>
          </div>

          {/* What to look forward to */}
          <div className="slide-section baby-future-section">
            <h2 className="section-header">
              <span className="section-header-icon">🌟</span>
              Their Bright Future
            </h2>
            <p className="fortune-text">
              Fire Horse children are rare and powerful! Born only every 60
              years, they bring transformation and positive change. Watch them
              gallop toward greatness!
            </p>
          </div>

          {/* Compatible zodiac friends at the party */}
          <div className="slide-section baby-friends-section">
            <h2 className="section-header">
              <span className="section-header-icon">🎉</span>
              Future Best Friends Here Tonight
            </h2>
            {Object.keys(compatibleByZodiac).length > 0 ? (
              <div className="compatibility-names">
                {Object.entries(compatibleByZodiac).map(
                  ([zodiac, names], i, arr) => (
                    <span key={zodiac} className="compatibility-item">
                      <span className="compatibility-name">
                        {names.join(", ")}
                      </span>{" "}
                      <span className="compatibility-zodiac">({zodiac})</span>
                      {i < arr.length - 1 && " · "}
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="no-attendees">
                Tigers, Goats & Dogs will be their lifelong allies!
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
