/**
 * Small shared pieces for the store and gift-card pages (Task D10):
 * the product photo, form field styles, button styles and a money line.
 * Server-safe (no hooks), so server pages and client components share it.
 */
import Image from "next/image";
import type { ReactNode } from "react";
import { SitePicture } from "@/components/site/picture/SitePicture";
import type { ProductImage } from "@/lib/site/store";

export const FIELD =
  "block w-full min-h-12 rounded-xl border border-oh-stone bg-oh-charcoal px-4 text-base text-oh-cream placeholder:text-oh-ash transition-colors focus:border-oh-ember-light focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember-light/40 aria-[invalid=true]:border-oh-ember-light disabled:opacity-60";
export const LABEL = "mb-2 block text-sm font-semibold text-oh-cream/85";

export const PRIMARY =
  "inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline transition-[filter,transform] duration-200 hover:brightness-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:bg-oh-stone disabled:text-oh-cream/75 motion-reduce:transition-none motion-reduce:active:scale-100";
export const SECONDARY =
  "inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:opacity-60";
export const TEXT_LINK =
  "inline-flex min-h-11 cursor-pointer appearance-none items-center gap-1.5 border-0 bg-transparent p-0 font-[inherit] text-[15px] font-semibold text-oh-cream underline decoration-oh-ember-light decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
export const PANEL = "rounded-3xl border border-oh-stone/70 bg-oh-ink p-4 md:p-5";
export const PANEL_TITLE = "m-0 mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85";

/** A product photo: the site's photography (SitePicture) or a /public/store file through next/image. Square; full width unless `className` sets one. */
export function ProductPhoto({ image, alt, sizes, priority = false, className = "" }: { image: ProductImage; alt: string; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden bg-oh-linen ${className || "w-full"}`}>
      {image.kind === "site" ? (
        <SitePicture image={image.key} sizes={sizes} alt={alt} priority={priority} className="absolute inset-0 block h-full w-full [&>img]:h-full [&>img]:w-full [&>img]:object-cover" />
      ) : (
        <Image src={image.src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      )}
    </div>
  );
}

/** A label and an amount on one line (a receipt row). */
export function MoneyRow({ label, value, strong = false, muted = false, data, className = "" }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; data?: string; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-lg font-semibold text-oh-cream" : muted ? "text-[15px] text-oh-mute" : "text-[15px] text-oh-cream/90"} ${className}`} {...(data ? { [`data-${data}`]: "" } : {})}>
      <dt className="m-0 min-w-0">{label}</dt>
      <dd className="m-0 shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

/** A plus/minus glyph drawn with two bars (no icon font, no text glyphs). */
export function PlusMinus({ plus }: { plus: boolean }) {
  return (
    <span aria-hidden="true" className="relative block h-3.5 w-3.5">
      <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 rounded-full bg-current" />
      {plus ? <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rounded-full bg-current" /> : null}
    </span>
  );
}

/** Quantity stepper: 44px targets, the count announced politely. */
export function StepperView({ value, min, max, onChange, fewerLabel, moreLabel, label, id }: { value: number; min: number; max: number; onChange: (n: number) => void; fewerLabel: string; moreLabel: string; label: string; id?: string }) {
  const btn =
    "flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-stone bg-transparent p-0 text-oh-cream transition-colors hover:bg-oh-stone/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1.5" data-stepper={id}>
      <button type="button" className={btn} aria-label={fewerLabel} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} data-dec>
        <PlusMinus plus={false} />
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-lg font-semibold tabular-nums text-oh-cream" data-qty>
        {value}
      </output>
      <button type="button" className={btn} aria-label={moreLabel} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} data-inc>
        <PlusMinus plus />
      </button>
    </div>
  );
}
