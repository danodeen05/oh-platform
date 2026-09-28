"use client";

/**
 * Task C3 (motion kit): a bottom sheet.
 *
 * Accessibility (tested in __tests__/sheet.test.tsx):
 *  - `role="dialog"` + `aria-modal="true"` + `aria-label` (the required
 *    `label` prop -- there's no visible heading to point `aria-labelledby`
 *    at in every usage, so this stays a plain string label).
 *  - Focus moves into the panel on open (the first focusable element),
 *    and Tab/Shift+Tab is trapped at the panel's edges.
 *  - Esc calls `onClose`.
 *  - Focus returns to whatever was focused right before the sheet opened.
 *
 * Motion: framer-motion drag="y", dismissing once the user has dragged
 * past 30% of the panel's own height or let go with enough downward
 * velocity. The drag gesture only starts from the grabber handle
 * (`dragListener={false}` + `dragControls`), not the whole panel: the
 * panel body keeps normal `overflow-y: auto` and native touch scrolling,
 * so a tall sheet's content scrolls untouched instead of dragging the
 * whole sheet around. `snapPoints` sizes the panel (its largest entry
 * sets the max height); resting at an intermediate snap point mid-drag is
 * not implemented, only open/dismiss (documented as a follow-up in the C3
 * report).
 *
 * Reduced motion: no enter/exit animation and no drag -- the sheet still
 * opens and closes (via the open/onClose contract), it just does so
 * instantly rather than sliding.
 *
 * Body scroll lock (iOS): `overflow: hidden` on body alone doesn't stop
 * rubber-band scrolling on iOS Safari, so while any sheet is open the body
 * is pinned with `position: fixed` at its negated `scrollY` (the
 * documented iOS-safe technique), and released back to that same scroll
 * position on close via `window.scrollTo`. The lock is ref-counted at
 * module scope so a nested sheet opening/closing over an already-open one
 * doesn't unlock the page out from under the outer sheet.
 */
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import "./motion.css";
import { useReducedMotion } from "./useReducedMotion";

let bodyScrollLockCount = 0;
let bodyScrollLockSavedY = 0;

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (bodyScrollLockCount === 0) {
    bodyScrollLockSavedY = window.scrollY;
    const { style } = document.body;
    style.position = "fixed";
    style.top = `-${bodyScrollLockSavedY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    const { style } = document.body;
    style.position = "";
    style.top = "";
    style.left = "";
    style.right = "";
    style.width = "";
    window.scrollTo(0, bodyScrollLockSavedY);
  }
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Fractions of the viewport height the sheet can rest at, e.g. [0.5, 1]. The largest sets the panel's max height. */
  snapPoints?: number[];
  /** Accessible name for the dialog (there's rarely a visible heading to point aria-labelledby at). */
  label: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function Sheet({ open, onClose, snapPoints = [1], label, children, className }: SheetProps) {
  const reducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);
  const dragControls = useDragControls();

  // Capture the opener on open, return focus to it on close.
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement;
    } else if (openerRef.current instanceof HTMLElement) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [open]);

  // Lock body scroll (iOS-safe) while open; ref-counted so a nested sheet
  // doesn't release the lock an outer sheet still needs.
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  // Focus trap + Esc, only while open.
  useEffect(() => {
    if (!open) return;

    const initial = focusableElements(panelRef.current)[0] ?? panelRef.current;
    initial?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = focusableElements(panelRef.current);
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  function handleDragEnd(_event: unknown, info: PanInfo) {
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const draggedFarEnough = panelHeight > 0 && info.offset.y > panelHeight * 0.3;
    const flungDown = info.velocity.y > 500;
    if (draggedFarEnough || flungDown) {
      onClose();
    }
  }

  const maxHeightVh = Math.round(Math.max(...snapPoints, 0.01) * 100);

  return (
    <AnimatePresence>
      {open && (
        <div className={["oh-sheet-root", className].filter(Boolean).join(" ")}>
          <motion.div
            className="oh-sheet-backdrop"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="oh-sheet-panel"
            style={{ ["--oh-sheet-max-height" as string]: `${maxHeightVh}svh` }}
            {...(reducedMotion
              ? {}
              : {
                  drag: "y" as const,
                  dragListener: false,
                  dragControls,
                  dragConstraints: { top: 0, bottom: 0 },
                  dragElastic: { top: 0, bottom: 0.4 },
                  onDragEnd: handleDragEnd,
                })}
            initial={reducedMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reducedMotion ? undefined : { y: "100%" }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }}
          >
            {/* Drag starts only from this handle (44px touch target), so the
                panel body below keeps native touch scrolling for its content. */}
            <div
              className="oh-sheet-grab-zone"
              onPointerDown={(event) => {
                if (!reducedMotion) dragControls.start(event);
              }}
            >
              <div className="oh-sheet-grabber" aria-hidden="true" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
