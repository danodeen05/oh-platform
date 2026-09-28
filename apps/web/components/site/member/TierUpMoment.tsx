"use client";

/**
 * Task D8: the tier-up moment. Full screen, once per new tier: the new tier
 * mark is pressed onto the page inside a cinnabar seal ring (ink spreading
 * from the press), the phone gives one short buzz (`navigator.vibrate?.(30)`),
 * then the free bowl the upgrade earned rises into view as a linen ticket
 * with its use-by date. Closing (Later, the close button or Esc) records
 * the tier as celebrated.
 *
 * A modal dialog: focus moves to the close button, Tab stays inside, Esc
 * closes, and the page behind is inert while it's open (it renders in a
 * portal at the end of the site shell, so it keeps the shell's fonts and
 * palette, and the shell's other children are made inert). Reduced motion
 * shows the final frame at once.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/site/icons/Icon";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { TierMark } from "@/components/site/tiers/TierMark";
import { localizedHref } from "@/lib/site/nav";
import { tierMeta } from "@/lib/site/tier-meta";
import { formatDate } from "./format";
import type { MemberReward } from "./usePassport";

export function TierUpMoment({
  tier,
  cashbackPct,
  freeBowl,
  onClose,
}: {
  tier: string;
  cashbackPct: number | null;
  freeBowl: MemberReward | null;
  onClose: () => void;
}) {
  const t = useTranslations("passport.tierUp");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const buzzed = useRef(false);
  const meta = tierMeta(tier);
  const tierName = tiers(`${meta.msg}.name`);

  // One short buzz, once (a ref survives React's dev double-invoke).
  useEffect(() => {
    if (buzzed.current) return;
    buzzed.current = true;
    try {
      navigator.vibrate?.(30);
    } catch {
      /* not supported */
    }
  }, []);

  // Modal behavior: focus, Tab trap, Esc, and the page behind made inert.
  useEffect(() => {
    closeRef.current?.focus();
    const main = document.getElementById("site-main");
    const root = rootRef.current;
    const siblings = root?.parentElement ? Array.from(root.parentElement.children).filter((el) => el !== root) : [];
    const touched: Element[] = [];
    for (const el of siblings) {
      if (!el.hasAttribute("inert")) {
        el.setAttribute("inert", "");
        touched.push(el);
      }
    }
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? []);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      for (const el of touched) el.removeAttribute("inert");
      document.documentElement.style.overflow = prevOverflow;
      main?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={rootRef}
      data-tier-up={tier}
      data-reduced={reduced ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tier-up-title"
      className={`fixed inset-0 z-[70] overflow-y-auto overscroll-contain ${cjk ? "font-cjk" : "font-body"}`}
    >
      <div aria-hidden="true" className="mp-moment-backdrop fixed inset-0" />
      <div className="relative mx-auto flex min-h-svh max-w-lg flex-col items-center px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] text-center">
        <div className="flex w-full justify-end">
          <button
            ref={closeRef}
            type="button"
            data-tier-up-close
            onClick={onClose}
            aria-label={t("close")}
            className="-mr-2 flex h-11 w-11 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-oh-cream/80 hover:bg-oh-stone/60 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
          >
            <Icon name="close" size={24} />
          </button>
        </div>

        {/* The seal: a cinnabar double ring with the tier mark, pressed in. */}
        <div className="relative mt-2 flex h-48 w-48 items-center justify-center">
          <span aria-hidden="true" className="mp-moment-ink absolute inset-0 rounded-full border-[10px] border-oh-ember/60" />
          <div className="mp-moment-stamp relative flex h-full w-full -rotate-6 items-center justify-center rounded-full border-[6px] border-oh-ember bg-oh-ember-deep/25">
            <span aria-hidden="true" className="absolute inset-3 rounded-full border-2 border-oh-ember/80" />
            <span className="text-oh-cream">
              <TierMark tier={meta.mark} tone="current" size={96} />
            </span>
          </div>
        </div>

        <div className="mp-moment-rise mt-6 [--mp-rise-delay:0.7s]">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-oh-gold">{t("eyebrow")}</p>
          <h2 id="tier-up-title" className={`m-0 mt-3 text-[2.6rem] leading-[1.05] text-oh-cream ${cjk ? "font-display-cjk" : "font-display"}`}>
            {t("title", { tier: tierName })}
          </h2>
          {cashbackPct != null ? <p className="m-0 mt-3 text-base leading-relaxed text-oh-cream/80">{t("body", { pct: cashbackPct })}</p> : null}
        </div>

        <div data-free-bowl-reveal className="mp-moment-rise mp-ticket mt-6 w-full rounded-2xl px-6 py-5 text-left text-oh-ink [--mp-rise-delay:1.15s]">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-ember-deep">{t("bowlEyebrow")}</p>
          <p className="m-0 mt-1.5 font-display text-2xl leading-tight">{t("bowlTitle")}</p>
          <p className="m-0 mt-2 text-sm text-oh-ink/80">
            {freeBowl ? t("bowlBody", { date: formatDate(freeBowl.windowEndsAt, locale) }) : t("bowlNoDate")}
          </p>
        </div>

        <div className="mp-moment-rise mt-6 flex w-full flex-col gap-3 [--mp-rise-delay:1.35s]">
          <Link
            href={localizedHref(locale, "/order")}
            onClick={onClose}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("order")}
            <Icon name="arrow" size={18} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream hover:border-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("later")}
          </button>
        </div>
      </div>
    </div>,
    document.querySelector("[data-site-shell]") ?? document.body,
  );
}
