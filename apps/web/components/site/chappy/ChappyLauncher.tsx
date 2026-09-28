"use client";

/**
 * Chappy's entry points (Task C4 API, Task E1 widget).
 *
 * `useChappy()` / `ChappyProvider` are re-exported from ChappyProvider.tsx so
 * the dock, the desktop nav and the site shell keep importing them from
 * here unchanged.
 *
 * `ChappyLauncher` is the floating button for pages that have no dock: the
 * `(legacy)` routes (components/legacy/LegacyChappy.tsx). Chappy's own face,
 * bottom right above the safe area, hidden while the chat is open.
 */
import { useTranslations } from "next-intl";
import { CHAPPY_AVATAR } from "@/lib/site/nav";
import { useChappy } from "./ChappyProvider";

export { ChappyProvider, useChappy, type ChappyApi } from "./ChappyProvider";

export function ChappyLauncher() {
  const t = useTranslations("chappyWeb");
  const chappy = useChappy();
  if (chappy.isOpen) return null;
  return (
    <button
      type="button"
      data-chappy-launcher
      aria-haspopup="dialog"
      aria-label={t("open")}
      onClick={() => chappy.openChappy()}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-50 flex h-14 w-14 cursor-pointer appearance-none items-center justify-center rounded-full border-2 border-solid border-oh-cream/25 bg-oh-ink p-0 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ember motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <img src={CHAPPY_AVATAR} alt="" width={48} height={48} className="h-12 w-12 rounded-full" />
    </button>
  );
}
