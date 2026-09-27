"use client";

import { useCallback, useEffect, useRef } from "react";

interface Props {
  /** Inline (thumbnail) image. */
  src: string;
  /** Full-resolution image, shown in the dialog and linked for a new tab. */
  fullSrc: string;
  alt: string;
  width: number;
  height: number;
  labels: { open: string; close: string; fullSize: string };
}

/**
 * Click-to-enlarge image. The thumbnail is a button that opens a native
 * <dialog> (Escape and backdrop click close it; focus is trapped by the
 * browser), and a text link opens the original file in a new tab for
 * pinch-zoom or saving. No dependency, works with reduced motion.
 */
export function Lightbox({ src, fullSrc, alt, width, height, labels }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => dialog.current?.showModal(), []);
  const close = useCallback(() => dialog.current?.close(), []);

  // Close when the backdrop (the dialog element itself, not its content) is clicked.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={labels.open}
        className="group block w-full cursor-zoom-in overflow-hidden rounded-md bg-oh-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ember"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={width} height={height} loading="lazy" className="block h-auto w-full transition-opacity group-hover:opacity-90" />
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem]">
        <button type="button" onClick={open} className="border-0 bg-transparent p-0 text-oh-mute underline-offset-2 hover:text-oh-cream hover:underline">
          {labels.open}
        </button>
        <a href={fullSrc} target="_blank" rel="noopener" className="text-oh-mute underline-offset-2 hover:text-oh-cream hover:underline">
          {labels.fullSize}
        </a>
      </div>

      <dialog
        ref={dialog}
        aria-label={alt}
        className="m-auto max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] rounded-lg border border-oh-stone bg-oh-charcoal p-0 text-oh-cream shadow-2xl backdrop:bg-black/80"
      >
        <div className="flex max-h-[calc(100vh-2rem)] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-oh-stone px-4 py-2">
            <a href={fullSrc} target="_blank" rel="noopener" className="text-[0.8rem] text-oh-mute underline-offset-2 hover:text-oh-cream hover:underline">
              {labels.fullSize}
            </a>
            <button type="button" onClick={close} className="rounded-md border border-oh-stone bg-oh-charcoal px-3 py-1 text-[0.8rem] text-oh-cream hover:bg-oh-ink">
              {labels.close}
            </button>
          </div>
          <div className="overflow-auto bg-oh-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fullSrc} alt={alt} width={width} height={height} className="block h-auto max-h-[calc(100vh-6rem)] w-auto max-w-full object-contain" />
          </div>
        </div>
      </dialog>
    </>
  );
}
