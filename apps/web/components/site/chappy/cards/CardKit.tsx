"use client";

/**
 * What every Chappy card shares (Task E2): the context the widget hands the
 * cards, the card frame, the eyebrow, and money formatting.
 *
 * Two surfaces, as on the rest of the site: food sits on linen (the cart,
 * a dish), everything else on ink. Every card is a labeled <section> with
 * `data-chappy-card` (the e2e and E1's tests find cards by it).
 */
import { createContext, useContext, type ReactNode } from "react";
import type { Order } from "@/lib/site/orders";
import type { SiteFetch } from "@/lib/site/api";

export interface ChappyCardContext {
  locale: string;
  cjk: boolean;
  /** Opens Clerk's sign-in (Chappy steps aside and comes back). */
  onSignIn: () => void;
  /** Sends a message as the customer (a card's own button, e.g. "Add to my order"). */
  send: (text: string) => void;
  /** A pay card (or confirm-zero card) settled: the order the API verified as PAID. */
  onPaid: (order: Order) => void;
  /** fetch with the member's Clerk token (confirm-payment returns the full order to its owner). */
  api: SiteFetch;
  /** Chappy is answering; card buttons that send a message wait. */
  busy: boolean;
}

const noop = () => {};
const Ctx = createContext<ChappyCardContext>({
  locale: "en",
  cjk: false,
  onSignIn: noop,
  send: noop,
  onPaid: noop,
  api: (input, init) => fetch(input, init),
  busy: false,
});

export const ChappyCardProvider = Ctx.Provider;
export const useCardContext = () => useContext(Ctx);

/** A pod label that never breaks at its hyphen ("B-07" stays on one line). */
export function podText(pod: string): string {
  return pod.replace(/-/g, "\u2011");
}

/** USD with the bare "$" in every locale (zh-TW's "US$" reads as English), always cents on a receipt. */
export function money(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function CardFrame({
  type,
  label,
  tone = "ink",
  children,
  className = "",
}: {
  type: string;
  label: string;
  tone?: "ink" | "linen";
  children: ReactNode;
  className?: string;
}) {
  const surface = tone === "linen" ? "bg-oh-linen text-oh-ink" : "border border-solid border-oh-stone/80 bg-oh-ink text-oh-cream";
  return (
    <section data-chappy-card={type} aria-label={label} className={`chappy-card min-w-0 overflow-hidden rounded-2xl ${surface} ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "linen" }) {
  return (
    <p className={`m-0 text-[0.72rem] font-semibold uppercase leading-snug tracking-[0.16em] ${tone === "linen" ? "text-oh-clay" : "text-oh-ember-light"}`}>{children}</p>
  );
}

/** The ember-deep filled button (cream text), 48px tall, full width by default. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  busy,
  full = true,
  className = "",
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  busy?: boolean;
  /** Full width (the default) or sized to its label. */
  full?: boolean;
  className?: string;
  [data: `data-${string}`]: string | boolean | undefined;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-12 ${full ? "w-full" : "w-auto"} cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-5 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:bg-oh-ember disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream ${className}`}
      {...rest}
    >
      {busy ? <span className="chappy-brush chappy-brush--sm" aria-hidden="true" /> : null}
      <span className="min-w-0">{children}</span>
    </button>
  );
}

/** A quiet outline button for secondary actions (44px). */
export function QuietButton({
  children,
  onClick,
  disabled,
  tone = "ink",
  className = "",
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "ink" | "linen";
  className?: string;
  [data: `data-${string}`]: string | boolean | undefined;
}) {
  const look =
    tone === "linen"
      ? "border-oh-ink/25 text-oh-ink hover:border-oh-ink/60 hover:bg-oh-ink/5 focus-visible:outline-oh-ink"
      : "border-oh-stone text-oh-cream hover:border-oh-ash hover:bg-oh-stone/40 focus-visible:outline-oh-cream";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border border-solid bg-transparent px-4 font-[inherit] text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 ${look} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
