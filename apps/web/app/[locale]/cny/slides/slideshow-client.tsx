"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ZODIAC_ANIMALS,
  ZodiacAnimal,
  getChineseZodiac,
} from "@/lib/cny/zodiac";
import { Attendee, groupAttendeesByZodiac } from "@/lib/cny/slides-data";
import { TitleSlide } from "@/components/cny/slides/TitleSlide";
import { ZodiacSlide } from "@/components/cny/slides/ZodiacSlide";
import { BabySlide } from "@/components/cny/slides/BabySlide";

const SLIDE_DURATION = 120_000; // 2 minutes in milliseconds
const TOTAL_SLIDES = 14; // 1 title + 12 zodiacs + 1 baby slide
const DATA_REFRESH_INTERVAL = 60_000; // Refresh RSVP data every 1 minute

const CNY_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyUdlLe3sVsJcs5XSh4LvZcmBJA3IyUi0qNHkZVc4GdY7n6nFXcoQhFpZIK2_dOFLU2dg/exec";

interface SlideshowClientProps {
  initialAttendeesByZodiac: Record<ZodiacAnimal, Attendee[]>;
}

interface RSVPResponse {
  name: string;
  phone?: string;
  birthdate?: string;
  birthday?: string;
  zodiac?: string;
}

async function fetchRSVPs(): Promise<Attendee[]> {
  try {
    const response = await fetch(`${CNY_APPS_SCRIPT_URL}?action=getRSVPs`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch RSVPs:", response.status);
      return [];
    }

    const text = await response.text();
    const data: RSVPResponse[] = JSON.parse(text);

    return data.map((rsvp) => {
      const birthdate = rsvp.birthdate || rsvp.birthday;
      let zodiac: ZodiacAnimal | undefined = rsvp.zodiac as ZodiacAnimal;

      if (!zodiac && birthdate) {
        try {
          const zodiacInfo = getChineseZodiac(birthdate);
          zodiac = zodiacInfo.animal;
        } catch {
          // Ignore calculation errors
        }
      }

      return {
        name: rsvp.name,
        phone: rsvp.phone,
        birthdate,
        zodiac,
      };
    });
  } catch (error) {
    console.error("Error fetching RSVPs:", error);
    return [];
  }
}

export function SlideshowClient({
  initialAttendeesByZodiac,
}: SlideshowClientProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [attendeesByZodiac, setAttendeesByZodiac] = useState(
    initialAttendeesByZodiac
  );

  // Real-time data refresh - poll Google Sheets every minute
  useEffect(() => {
    const refreshData = async () => {
      const attendees = await fetchRSVPs();
      if (attendees.length > 0) {
        setAttendeesByZodiac(groupAttendeesByZodiac(attendees));
      }
    };

    // Initial fetch after mount
    refreshData();

    // Set up polling interval
    const dataTimer = setInterval(refreshData, DATA_REFRESH_INTERVAL);

    return () => clearInterval(dataTimer);
  }, []);

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);

      // Wait for exit animation, then change slide
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
        setIsTransitioning(false);
      }, 600); // Match CSS transition duration
    }, SLIDE_DURATION);

    return () => clearInterval(timer);
  }, []);

  // Keyboard controls for testing (won't be used in kiosk mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
      } else if (e.key === "ArrowLeft") {
        setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renderSlide = useCallback(
    (index: number) => {
      // Slide 0: Title
      if (index === 0) {
        return <TitleSlide />;
      }

      // Slide 13: Baby slide (last slide)
      if (index === 13) {
        return <BabySlide allAttendeesByZodiac={attendeesByZodiac} />;
      }

      // Slides 1-12: Zodiac slides
      const zodiacIndex = index - 1;
      const zodiac = ZODIAC_ANIMALS[zodiacIndex];
      const isGrayBackground = zodiacIndex % 2 === 1; // Alternate backgrounds

      return (
        <ZodiacSlide
          zodiac={zodiac}
          background={isGrayBackground ? "gray" : "red"}
          attendees={attendeesByZodiac[zodiac] || []}
          allAttendeesByZodiac={attendeesByZodiac}
        />
      );
    },
    [attendeesByZodiac]
  );

  // Get background color class for each slide
  const getSlideColorClass = (index: number): string => {
    // Title slide (0) is red
    if (index === 0) return "slide-red";
    // Baby slide (13) uses gray background
    if (index === 13) return "slide-gray";
    // Zodiac slides alternate: even zodiac index = red, odd = gray
    const zodiacIndex = index - 1;
    return zodiacIndex % 2 === 0 ? "slide-red" : "slide-gray";
  };

  return (
    <div className="slideshow-container">
      {/* Render all slides, only show active one */}
      {Array.from({ length: TOTAL_SLIDES }).map((_, index) => (
        <div
          key={index}
          className={`slide ${getSlideColorClass(index)} ${
            index === currentSlide ? "active" : ""
          } ${isTransitioning && index === currentSlide ? "slide-exiting" : ""}`}
        >
          {/* Only render content for nearby slides for performance */}
          {Math.abs(index - currentSlide) <= 1 ||
          (currentSlide === 0 && index === TOTAL_SLIDES - 1) ||
          (currentSlide === TOTAL_SLIDES - 1 && index === 0)
            ? renderSlide(index)
            : null}
        </div>
      ))}

      {/* Progress dots */}
      <div className="slide-progress">
        {Array.from({ length: TOTAL_SLIDES }).map((_, index) => (
          <div
            key={index}
            className={`progress-dot ${index === currentSlide ? "active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
