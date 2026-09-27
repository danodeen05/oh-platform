"use client";

import type { SectionKey } from "@/lib/plan/sections";

export const CHAPPY_OPEN_EVENT = "plan:chappy-open";

export interface ChappyOpenDetail {
  /** Text placed in the input, ready to edit and send. */
  prefill?: string;
  sectionKey?: SectionKey;
}

export function openChappy(detail: ChappyOpenDetail = {}): void {
  window.dispatchEvent(new CustomEvent<ChappyOpenDetail>(CHAPPY_OPEN_EVENT, { detail }));
}

/**
 * Opens the one Chappy panel (mounted in the plan layout). Replaces the old
 * "Ask a question" dialog: the section footer and the diligence request both
 * use this, so every question goes through Chappy, who answers from the plan
 * or passes it to the owner.
 */
export function AskChappyButton({ label, prefill, sectionKey, className }: { label: string; prefill?: string; sectionKey?: SectionKey; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openChappy({ prefill, sectionKey })}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-md border border-oh-stone bg-transparent px-3 py-1.5 text-[0.8rem] text-oh-cream hover:border-oh-mute hover:bg-oh-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/plan/chappy-96.webp" alt="" width={20} height={20} className="h-5 w-5 rounded-full bg-oh-cream/10" />
      {label}
    </button>
  );
}
