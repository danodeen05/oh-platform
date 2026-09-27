"use client";
import { useRef } from "react";
import { controlCls } from "./Field";
import { Icon } from "./icons";

type Props = { value: string; onChange: (v: string) => void; onSubmit?: (v: string) => void; placeholder: string; autoFocus?: boolean; label?: string };

export function SearchField({ value, onChange, onSubmit, placeholder, autoFocus, label }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <form role="search" className="relative" onSubmit={(e) => { e.preventDefault(); input.current?.blur(); onSubmit?.(value); }}>
      <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-oh-ash" />
      <input ref={input} type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
        aria-label={label ?? placeholder} placeholder={placeholder} autoFocus={autoFocus} value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlCls} appearance-none pl-10 pr-11 [&::-webkit-search-cancel-button]:appearance-none`} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => { onChange(""); input.current?.focus(); }}
          className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-oh-stone/70 hover:text-oh-charcoal">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-oh-stone/15"><Icon name="close" size={12} /></span>
        </button>
      )}
    </form>
  );
}
