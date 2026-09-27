"use client";

interface Props {
  src: string;
  title: string;
}

/**
 * A landscape tablet around the live kiosk, drawn in the plan's own palette:
 * a charcoal body with a stone edge, a thin inner bezel, the camera dot on
 * the long edge, and a screen with real rounded corners. The screen keeps
 * the kiosk's 4:3 shape; inside it the kiosk runs in its presentation mode
 * (see the kiosk layout), which renders the full 1366 x 1024 design and
 * scales it to whatever size the screen is, so nothing re-flows or overlaps.
 */
export function KioskFrame({ src, title }: Props) {
  return (
    <div className="mx-auto w-full max-w-[980px]">
      {/* body */}
      <div className="relative rounded-[2.2rem] border border-oh-stone bg-[linear-gradient(160deg,#34302B_0%,#1C1B19_55%,#26231F_100%)] p-[18px] shadow-[0_40px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(242,237,228,0.08)] sm:p-[22px]">
        {/* camera on the long edge */}
        <span aria-hidden="true" className="absolute left-1/2 top-[9px] h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-oh-charcoal shadow-[inset_0_0_0_1.5px_#3A3632,0_0_0_1px_rgba(242,237,228,0.06)]" />
        {/* bezel */}
        <div className="rounded-[1.5rem] bg-oh-charcoal p-[10px] shadow-[inset_0_0_0_1px_rgba(242,237,228,0.06)]">
          {/* screen, 4:3 like the tablet the kiosk was built for */}
          <div className="relative overflow-hidden rounded-[1.1rem] bg-[#FAF9F6] ring-1 ring-oh-stone/70" style={{ aspectRatio: "1366 / 1024" }}>
            <iframe src={src} title={title} loading="lazy" className="absolute inset-0 h-full w-full border-0" />
            {/* glass: a faint highlight along the top edge, never in the way of taps */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[1.1rem] bg-[linear-gradient(180deg,rgba(242,237,228,0.05)_0%,rgba(242,237,228,0)_18%)]" />
          </div>
        </div>
      </div>
      {/* stand shadow */}
      <div aria-hidden="true" className="mx-auto mt-3 h-3 w-[70%] rounded-[50%] bg-black/50 blur-md" />
    </div>
  );
}
