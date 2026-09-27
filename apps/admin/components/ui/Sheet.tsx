"use client";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./Button";

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "full" | "auto" };

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const CLOSE_DRAG_PX = 120;

/**
 * Bottom sheet on phones (drag the charcoal header down to close); from lg a
 * 480px right panel, or a centred dialog when size is "auto".
 */
export function Sheet({ open, onClose, title, children, footer, size = "full" }: Props) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  // Keep Tab inside the dialog.
  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (els.length === 0) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && window.matchMedia("(min-width: 1024px)").matches) return;
    if ((e.target as HTMLElement).closest("button")) return;
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => { if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current)); };
  const onUp = () => { if (drag > CLOSE_DRAG_PX) closeRef.current(); setDrag(0); startY.current = null; };
  const onCancel = () => { setDrag(0); startY.current = null; };

  const auto = size === "auto";
  const desktop = auto
    ? "lg:m-auto lg:max-h-[80svh] lg:w-[440px] lg:rounded-card lg:motion-safe:animate-[oh-toast-in_180ms_ease-out]"
    : "lg:ml-auto lg:h-full lg:max-h-none lg:w-[480px] lg:rounded-none lg:motion-safe:animate-[oh-sheet-left_220ms_ease-out]";

  return createPortal(
    <div className="oh-console fixed inset-0 z-50 flex items-end bg-transparent lg:items-stretch">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={() => closeRef.current()}
        className="absolute inset-0 cursor-default bg-oh-charcoal/55 motion-safe:animate-[oh-fade_150ms_ease-out]" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={trap}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined} // style-ok: live drag offset
        className={`relative flex w-full flex-col overflow-hidden rounded-t-[20px] bg-oh-paper shadow-[0_-8px_40px_rgb(28_27_25/0.25)] outline-none ${drag ? "" : "transition-transform duration-200"} ${auto ? "max-h-[92svh]" : "h-[92svh]"} motion-safe:animate-[oh-sheet-up_240ms_cubic-bezier(0.2,0.8,0.2,1)] ${desktop}`}>
        <div className="shrink-0 touch-none select-none bg-oh-charcoal text-oh-cream lg:touch-auto"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>
          <div className="flex h-5 items-end justify-center lg:hidden" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-oh-cream/35" />
          </div>
          <div className="flex min-h-14 items-center gap-2 pb-1 pl-4 pr-2 lg:py-2">
            <h2 className="min-w-0 flex-1 truncate font-display text-[1.625rem] leading-tight">{title}</h2>
            <IconButton icon="close" label="Close" onClick={() => closeRef.current()} className="text-oh-cream/85 hover:bg-oh-cream/10 hover:text-oh-cream" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-oh-stone/15 bg-oh-paper px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
