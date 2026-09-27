"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sectionFromPath, sectionHref, type PlanSection } from "@/lib/plan/sections";
import { SectionGlyph } from "./icons";

export interface PaletteSection {
  key: PlanSection["key"];
  slug: PlanSection["slug"];
  icon: PlanSection["icon"];
  order: number;
  title: string;
  subtitle: string;
}

interface Props {
  locale: string;
  sections: readonly PaletteSection[];
  labels: { open: string; placeholder: string; sections: string; noResults: string; hint: string };
}

const EDITABLE = "input, textarea, select, [contenteditable], [role=slider], dialog";
const OPEN_EVENT = "plan-palette:open";

/**
 * A second trigger for the one palette (the phone bottom bar). The palette
 * itself is mounted once, in the header, so there is a single dialog and a
 * single set of shortcuts; this button just asks it to open.
 */
export function PlanPaletteTrigger({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))} className={className}>
      {label}
    </button>
  );
}

/**
 * Jump anywhere: "/" or Cmd/Ctrl+K opens a contents palette, type to filter,
 * Enter navigates. Alt+Left/Right step to the previous or next section.
 * Native dialog, bottom sheet on phones. Keys are ignored while focus is in
 * a field, a slider or another dialog, so the model's levers keep theirs.
 */
export function PlanPalette({ locale, sections, labels }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const current = sectionFromPath(pathname);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sections.filter((s) => `${s.order} ${s.title} ${s.subtitle}`.toLowerCase().includes(q)) : sections;
  }, [query, sections]);

  const open = () => {
    setQuery("");
    setCursor(Math.max(0, sections.findIndex((s) => s.key === current)));
    dialog.current?.showModal();
    window.requestAnimationFrame(() => input.current?.focus());
  };
  const close = () => dialog.current?.close();
  const go = (s: PaletteSection) => {
    close();
    router.push(sectionHref(locale, s));
  };

  useEffect(() => {
    const el = dialog.current;
    const onClick = (e: MouseEvent) => {
      if (e.target === el) el?.close();
    };
    el?.addEventListener("click", onClick);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      const inField = Boolean(target?.closest(EDITABLE));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (dialog.current?.open) close();
        else open();
        return;
      }
      if (inField) return;
      if (e.key === "/") {
        e.preventDefault();
        open();
        return;
      }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const i = sections.findIndex((s) => s.key === current);
        const n = sections[i + (e.key === "ArrowRight" ? 1 : -1)];
        if (n) {
          e.preventDefault();
          router.push(sectionHref(locale, n));
        }
      }
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, open);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, open);
      el?.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, sections, locale]);

  return (
    <div data-plan-shell="">
      <button
        type="button"
        onClick={open}
        aria-keyshortcuts="/ Control+K Meta+K"
        className="hidden items-center gap-2 rounded-md border border-oh-stone bg-transparent px-2.5 py-1 text-[0.75rem] text-oh-mute hover:border-oh-mute hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember md:inline-flex"
      >
        <span>{labels.open}</span>
        <kbd className="rounded border border-oh-stone px-1 font-mono text-[0.65rem] text-oh-mute">/</kbd>
      </button>
      <dialog
        ref={dialog}
        aria-label={labels.sections}
        data-plan-shell=""
        className="m-auto w-[min(100vw-2rem,32rem)] rounded-lg border border-oh-stone bg-oh-charcoal p-0 text-oh-cream shadow-2xl backdrop:bg-black/80 max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      >
        <div className="border-b border-oh-stone p-3">
          <input
            ref={input}
            id="plan-palette-query"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(matches.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const s = matches[cursor];
                if (s) go(s);
              }
            }}
            placeholder={labels.placeholder}
            aria-controls="plan-palette-list"
            aria-activedescendant={matches[cursor] ? `plan-palette-${matches[cursor].key}` : undefined}
            className="w-full rounded-md border border-oh-stone bg-oh-ink px-3 py-2 text-[0.95rem] text-oh-cream placeholder:text-oh-mute/70 focus:border-oh-ember focus:outline-none"
          />
        </div>
        <ul id="plan-palette-list" role="listbox" aria-label={labels.sections} className="m-0 max-h-[60vh] list-none overflow-y-auto p-2">
          {matches.length === 0 ? <li className="px-3 py-4 text-[0.85rem] text-oh-mute">{labels.noResults}</li> : null}
          {matches.map((s, i) => (
            <li key={s.key} id={`plan-palette-${s.key}`} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(s)}
                className={["flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", i === cursor ? "bg-oh-ink text-oh-cream" : "bg-transparent text-oh-mute hover:text-oh-cream", s.key === current ? "plan-nav-current" : ""].join(" ")}
              >
                <span className="w-6 shrink-0 font-display text-[0.85rem] tabular-nums text-oh-ember-light">{String(s.order).padStart(2, "0")}</span>
                <SectionGlyph icon={s.icon} className="shrink-0 text-current" />
                <span className="min-w-0">
                  <span className="block text-[0.9rem] leading-tight">{s.title}</span>
                  {s.subtitle && s.subtitle !== s.title ? <span className="block truncate text-[0.72rem] text-oh-mute">{s.subtitle}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="m-0 border-t border-oh-stone px-4 py-2 text-[0.7rem] text-oh-mute">{labels.hint}</p>
      </dialog>
    </div>
  );
}
