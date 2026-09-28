"use client";

/**
 * Chappy at 768px and up: a 420px panel docked to the right edge. It is not
 * modal: the page stays usable beside it (read the menu while you ask about
 * it). Esc closes it while focus is inside, focus moves in on open and
 * returns to the opener on close. Reduced motion: it appears without the
 * slide.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";

export function ChappyPanel({
  open,
  onClose,
  label,
  onOpened,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  /** Called once the panel is in the DOM, to place focus (the composer). */
  onOpened?: () => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      const id = requestAnimationFrame(() => onOpened?.());
      return () => cancelAnimationFrame(id);
    }
    if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    opener.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="chappy-panel"
          data-chappy-surface="panel"
          role="dialog"
          aria-modal="false"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onClose();
            }
          }}
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: 24 }}
          transition={reduced ? { duration: 0 } : { type: "spring", damping: 34, stiffness: 340 }}
          className="fixed bottom-4 right-4 top-16 z-[60] flex w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-solid border-oh-stone bg-oh-ink text-oh-cream shadow-[0_24px_64px_-16px_rgba(0,0,0,0.6)]"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
