"use client";
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./icons";

/** Shared control look: 44px tall, 16px text (no iOS zoom), gold focus ring. */
export const controlCls =
  "block min-h-11 w-full rounded-xl border border-oh-stone/25 bg-oh-paper px-3 text-[16px] text-oh-charcoal placeholder:text-oh-ash transition-[border-color,box-shadow] focus:border-oh-gold focus:outline-none focus:ring-3 focus:ring-oh-gold/30 aria-[invalid=true]:border-oh-ember-deep/70 disabled:opacity-60";

/** Label, control, then a hint or an error. The label wraps the control so tapping it focuses. */
export function Field({ label, hint, error, children, className = "" }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-oh-charcoal">{label}</span>
      {children}
      {error
        ? <span role="alert" className="mt-1.5 block text-sm font-medium text-oh-ember-deep">{error}</span>
        : hint && <span className="mt-1.5 block text-sm text-oh-stone/70">{hint}</span>}
    </label>
  );
}

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...rest} className={`${controlCls} ${className}`} />;
}

export function NumberInput({ className = "", inputMode = "numeric", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" inputMode={inputMode} autoComplete="off" {...rest} className={`${controlCls} tabular-nums ${className}`} />;
}

/** Parses a dollars string ("$1,249.99", "12.5") to whole cents. Empty or unparseable gives null. */
export function dollarsToCents(v: string): number | null {
  const clean = v.replace(/[$,\s]/g, "");
  if (clean === "") return null;
  const n = parseFloat(clean);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

type MoneyProps = { cents?: number | null; onCents: (cents: number | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange">;

/** Dollars in, cents out. The text is the source of truth while typing; it tidies to 2 places on blur. */
export function MoneyInput({ cents, onCents, className = "", onBlur, ...rest }: MoneyProps) {
  const [text, setText] = useState(cents == null ? "" : (cents / 100).toFixed(2));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[16px] text-oh-ash" aria-hidden="true">$</span>
      <input type="text" inputMode="decimal" autoComplete="off" {...rest} value={text}
        onChange={(e) => { setText(e.target.value); onCents(dollarsToCents(e.target.value)); }}
        onBlur={(e) => { const c = dollarsToCents(text); if (c !== null) setText((c / 100).toFixed(2)); onBlur?.(e); }}
        className={`${controlCls} pl-7 tabular-nums ${className}`} />
    </div>
  );
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...rest} className={`${controlCls} cursor-pointer appearance-none pr-10 ${className}`}>{children}</select>
      <Icon name="chevron-right" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-oh-ash" />
    </div>
  );
}

export function TextArea({ className = "", rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} {...rest} className={`${controlCls} min-h-24 resize-y py-2.5 leading-relaxed ${className}`} />;
}

/** An on/off switch: a 52x32 track inside a 44px-tall hit box. Olive when on. */
export function Toggle({ checked, onChange, label, disabled, hideLabel = false }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; hideLabel?: boolean }) {
  const id = useId();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 items-center gap-3 rounded-full text-left disabled:cursor-not-allowed disabled:opacity-50">
      <span className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full transition-colors duration-200 ${checked ? "bg-oh-olive" : "bg-oh-stone/30"}`}>
        <span className={`absolute left-1 h-6 w-6 rounded-full bg-oh-paper shadow-[0_1px_3px_rgb(28_27_25/0.3)] transition-transform duration-200 ${checked ? "translate-x-5" : ""}`} />
      </span>
      <span id={id} className={hideLabel ? "sr-only" : "text-[15px] font-medium text-oh-charcoal"}>{label}</span>
    </button>
  );
}
