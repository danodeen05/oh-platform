"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { ZodiacAnimal } from "@/lib/cny/zodiac";
import { ZODIAC_SVG_FILES } from "@/lib/cny/slides-data";

interface AnimatedZodiacSVGProps {
  zodiac: ZodiacAnimal;
}

export function AnimatedZodiacSVG({ zodiac }: AnimatedZodiacSVGProps) {
  const t = useTranslations("cny");
  const svgPath = ZODIAC_SVG_FILES[zodiac];

  return (
    <div className="zodiac-svg-container">
      <Image
        src={svgPath}
        alt={t(`zodiac.animals.${zodiac}`)}
        width={500}
        height={500}
        className="zodiac-svg"
        priority
      />
    </div>
  );
}
