"use client";

/**
 * Task D1: the top-down bowl that turns as you scroll past it
 * (`rotate: calc(var(--progress) * 40deg)`, centered on upright; see
 * home.css). Native view timeline where supported; elsewhere the rewards
 * page's IntersectionObserver-gated scroll fallback writes --progress.
 * The four numbered marks sit on the ingredients and turn with the bowl.
 * Reduced motion: upright and still.
 */
import { useRef } from "react";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { coverProgress, useScrollVars } from "@/components/site/rewards/useScrollVars";
import "./home.css";

// Ingredient marks, in photo percentages, matching the four callouts (TheBowl):
// 1 the broth, 2 the smoked crust, 3 the slices, 4 the bok choy (greens and citrus).
const MARKS = [
  { n: 1, x: "31%", y: "68%" },
  { n: 2, x: "64%", y: "36%" },
  { n: 3, x: "52%", y: "58%" },
  { n: 4, x: "38%", y: "36%" },
];

export function BowlSpin({ alt }: { alt: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  useScrollVars(
    ref,
    (el, viewport) => {
      const p = coverProgress(el.getBoundingClientRect(), viewport, 0, 1);
      el.style.setProperty("--progress", p.toFixed(4));
    },
    !reduced,
  );

  return (
    <div ref={ref} className="hm-bowl relative mx-auto aspect-square w-full max-w-[26rem]">
      <div className="absolute inset-0 overflow-hidden rounded-full shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--color-oh-clay)_60%,transparent)]">
        <div className="hm-bowl-spin absolute inset-[-4%]">
          <SitePicture
            image="bowl-slices-top"
            sizes="(min-width: 768px) 416px, 90vw"
            alt={alt}
            className="absolute inset-0 block [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
          />
          {MARKS.map((m) => (
            <span
              key={m.n}
              aria-hidden="true"
              className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-oh-ember-deep text-sm font-semibold text-oh-cream ring-2 ring-oh-linen left-[var(--x)] top-[var(--y)]"
              style={{ ["--x" as string]: m.x, ["--y" as string]: m.y }}
            >
              {m.n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
