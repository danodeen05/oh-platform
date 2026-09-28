/**
 * Task D1: the 峨 mark, written in on load.
 *
 * The owner's `Oh_Logo_Mark_Light` artwork (public/brand/oh-mark-light-360.webp,
 * a web-sized copy of public/Oh_Logo_Mark_Light.png) sits inside an SVG,
 * masked by a set of wide, round-capped brush paths that follow the
 * calligraphy in stroke order. Each path's `stroke-dashoffset` animates
 * from 1 to 0 (pathLength 1), so the ink appears the way it was written.
 * The unmasked artwork then settles in over the top, so the final state is
 * always the complete mark, whatever the paths missed.
 *
 * Pure CSS (home.css), server-rendered, no JS. Decorative: the H1 beside it
 * carries the meaning. Reduced motion shows the finished mark.
 */
import "./home.css";

const MARK_SRC = "/brand/oh-mark-light-360.webp";

// Stroke order over a 600 x 594 box (the artwork's aspect ratio).
const STROKES: Array<{ d: string; w: number }> = [
  { d: "M118 42 C 170 26, 252 84, 292 200", w: 132 },
  { d: "M338 58 L 408 82", w: 60 },
  { d: "M326 96 C 334 200, 352 322, 346 440", w: 104 },
  { d: "M222 232 C 250 300, 288 378, 300 452", w: 84 },
  { d: "M136 372 C 218 350, 300 318, 404 276", w: 76 },
  { d: "M332 300 C 300 362, 250 430, 192 482", w: 64 },
  { d: "M192 330 C 118 298, 18 322, 22 402 C 26 462, 122 472, 178 420", w: 86 },
  { d: "M380 200 C 420 280, 440 330, 510 330 C 604 330, 602 470, 480 482 C 430 486, 400 452, 410 410", w: 108 },
  { d: "M300 444 C 290 522, 240 562, 188 588", w: 64 },
  { d: "M12 490 C 50 530, 140 520, 232 556", w: 64 },
];

export function BrushMark({ className, id = "hm-brush" }: { className?: string; id?: string }) {
  const mask = `${id}-mask`;
  return (
    <svg viewBox="0 0 600 594" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="594">
          {STROKES.map((s, i) => (
            <path
              key={i}
              d={s.d}
              pathLength={1}
              fill="none"
              stroke="#fff"
              strokeWidth={s.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hm-brush-stroke"
              style={{ ["--hm-i" as string]: i }}
            />
          ))}
        </mask>
      </defs>
      <image href={MARK_SRC} width="600" height="594" mask={`url(#${mask})`} />
      <image href={MARK_SRC} width="600" height="594" className="hm-brush-full" />
    </svg>
  );
}
