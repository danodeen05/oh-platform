"use client";

/**
 * Language switch (Task C4). Keeps the path, query and hash and swaps only
 * the locale segment (lib/site/locale-path.ts).
 *
 * - `list`: the four languages as full-width rows (the More sheet).
 * - `compact`: a globe button with a small menu (the desktop top bar).
 *
 * Language names are endonyms from i18n/config (each name is written in its
 * own language, so it reads the same in every locale).
 */
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { localeNames, locales, type Locale } from "@/i18n/config";
import { swapLocalePath } from "@/lib/site/locale-path";

function useSwitchLocale(onDone?: () => void) {
  const router = useRouter();
  return (target: Locale) => {
    const { pathname, search, hash } = window.location;
    router.push(swapLocalePath(pathname, search, target, hash));
    onDone?.();
  };
}

export function LocaleSwitch({ variant, onSwitched }: { variant: "list" | "compact"; onSwitched?: () => void }) {
  return variant === "list" ? <LocaleList onSwitched={onSwitched} /> : <LocaleMenu />;
}

function LocaleList({ onSwitched }: { onSwitched?: () => void }) {
  const t = useTranslations("site.shell");
  const current = useLocale();
  const switchTo = useSwitchLocale(onSwitched);

  return (
    <ul aria-label={t("language")} className="m-0 grid list-none grid-cols-2 gap-2 p-0">
      {locales.map((loc) => {
        const selected = loc === current;
        return (
          <li key={loc}>
            <button
              type="button"
              data-locale-option={loc}
              lang={loc}
              aria-pressed={selected}
              onClick={() => (selected ? onSwitched?.() : switchTo(loc))}
              className="flex min-h-12 w-full cursor-pointer appearance-none items-center justify-between gap-2 rounded-xl border border-oh-stone bg-transparent font-[inherit] px-4 text-left text-base text-oh-cream transition-colors hover:border-oh-ash aria-pressed:border-oh-ember-light aria-pressed:bg-oh-stone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              <span className="truncate">{localeNames[loc]}</span>
              {selected ? <Icon name="check" size={18} className="shrink-0 text-oh-ember-light" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function LocaleMenu() {
  const t = useTranslations("site.shell");
  const current = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const switchTo = useSwitchLocale(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t("language")}: ${localeNames[current]}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 cursor-pointer appearance-none items-center gap-1.5 rounded-full border-0 bg-transparent px-3 font-[inherit] text-sm text-oh-cream/80 transition-colors hover:bg-oh-stone/50 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
      >
        <Icon name="globe" size={20} />
        <span lang={current} className="whitespace-nowrap">
          {localeNames[current]}
        </span>
      </button>
      {open ? (
        <ul
          id={menuId}
          aria-label={t("language")}
          className="absolute right-0 top-full z-50 m-0 mt-2 min-w-44 list-none overflow-hidden rounded-2xl border border-oh-stone bg-oh-ink p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]"
        >
          {locales.map((loc) => (
            <li key={loc}>
              <button
                type="button"
                data-locale-option={loc}
                lang={loc}
                aria-pressed={loc === current}
                onClick={() => (loc === current ? setOpen(false) : switchTo(loc))}
                className="flex min-h-11 w-full cursor-pointer appearance-none items-center justify-between gap-3 rounded-xl border-0 bg-transparent px-3 font-[inherit] text-left text-sm text-oh-cream transition-colors hover:bg-oh-stone/60 focus-visible:outline-2 focus-visible:outline-oh-cream"
              >
                {localeNames[loc]}
                {loc === current ? <Icon name="check" size={16} className="text-oh-ember-light" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
