/**
 * Site typography primitives (spec 4). These are the building blocks the
 * Phase D rebuilds use instead of bare <h1>/<h2>/<p> tags styled by the old
 * global element rules (retired in Task C1, see app/globals.css).
 *
 * Display and Title use the serif family: Instrument Serif for Latin
 * locales, Noto Serif TC/SC for Chinese ones. Body and Eyebrow use the sans
 * family: Raleway (self-hosted, components/site/site-fonts.ts) or
 * Noto Sans TC/SC (zh pages only, components/site/shell/CjkFonts.tsx). The TC/SC choice always follows the `locale` prop, not
 * the visitor's script preference.
 *
 * These are plain server-safe components (no "use client"): pass the
 * current locale explicitly, the same way app/[locale]/plan layouts do
 * (`locale.startsWith("zh")`), rather than reading it from a client hook.
 */
import { createElement, type ElementType, type HTMLAttributes, type ReactNode } from "react";

function isCjk(locale?: string): boolean {
  return !!locale && locale.startsWith("zh");
}

function cx(...classes: Array<string | false | undefined | null>): string {
  return classes.filter(Boolean).join(" ");
}

export interface TextProps extends HTMLAttributes<HTMLElement> {
  /** Render as a different tag, e.g. `as="span"` for a Display used inline. */
  as?: ElementType;
  /** Current locale, e.g. from route params (`{ locale }`). */
  locale?: string;
  children?: ReactNode;
}

function textElement(
  defaultTag: ElementType,
  fontClass: (locale?: string) => string,
  sizeClass: string,
  { as, locale, className, children, ...rest }: TextProps
) {
  return createElement(
    as ?? defaultTag,
    { className: cx(fontClass(locale), sizeClass, className), ...rest },
    children
  );
}

/** Large serif headline: the page's single H1-scale statement. */
export function Display(props: TextProps) {
  return textElement(
    "h1",
    (locale) => (isCjk(locale) ? "font-display-cjk" : "font-display"),
    "text-[clamp(2rem,5vw,3.5rem)] font-normal leading-[1.05]",
    props
  );
}

/** Section-level serif heading, one step down from Display. */
export function Title(props: TextProps) {
  return textElement(
    "h2",
    (locale) => (isCjk(locale) ? "font-display-cjk" : "font-display"),
    "text-[clamp(1.5rem,4vw,2.5rem)] font-normal leading-[1.15]",
    props
  );
}

/** Body copy. Never below 16px on phones (spec 2, mobile-first). */
export function Body(props: TextProps) {
  return textElement(
    "p",
    (locale) => (isCjk(locale) ? "font-cjk" : "font-body"),
    "text-base leading-relaxed",
    props
  );
}

/** Small tracked uppercase label that sits above a Display or Title. */
export function Eyebrow(props: TextProps) {
  return textElement(
    "span",
    (locale) => (isCjk(locale) ? "font-cjk" : "font-body"),
    "block text-xs font-medium uppercase tracking-[0.2em]",
    props
  );
}
