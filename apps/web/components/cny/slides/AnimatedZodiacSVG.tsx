"use client";

import Image from "next/image";
import { ZodiacAnimal } from "@/lib/cny/zodiac";
import { ZODIAC_SVG_FILES } from "@/lib/cny/slides-data";

interface AnimatedZodiacSVGProps {
  zodiac: ZodiacAnimal;
}

export function AnimatedZodiacSVG({ zodiac }: AnimatedZodiacSVGProps) {
  const svgPath = ZODIAC_SVG_FILES[zodiac];

  return (
    <div className="zodiac-svg-container">
      <Image
        src={svgPath}
        alt={zodiac}
        width={500}
        height={500}
        className="zodiac-svg"
        priority
      />
    </div>
  );
}
