"use client";

/**
 * Task D7: the seal gallery. Every active badge as its chop seal (earned
 * ones filled, the rest outlined, once the member's profile loads); tap one
 * for a Sheet with how to earn it. Names and descriptions arrive already
 * localized from the server (F1a's `?locale=` plus the same i18n fallback,
 * see lib/site/program.ts).
 */
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { LazySheet as Sheet } from "@/components/site/motion/LazySheet";
import { Seal } from "@/components/site/seal/Seal";
import { useRewardsMember } from "./RewardsMember";

export interface GallerySeal {
  slug: string;
  iconKey: string;
  name: string;
  description: string;
  category: string;
}

const CATEGORIES = ["MILESTONE", "CHALLENGE", "REFERRAL", "SPECIAL", "STREAK"];

// Night palette for the (paper by default) motion-kit sheet, as in the More sheet.
const NIGHT =
  "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone [&_.oh-sheet-panel]:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]";

export function SealGallery({ seals }: { seals: GallerySeal[] }) {
  const t = useTranslations("rewards.seals");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const member = useRewardsMember();
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const signedIn = member.status === "ready";
  const earned = (slug: string) => (signedIn ? member.earnedSlugs.has(slug) : true);
  const open = seals.find((s) => s.slug === openSlug) ?? null;
  const category = (c: string) => (CATEGORIES.includes(c) ? t(`categories.${c}`) : "");

  if (seals.length === 0) {
    return <p className="m-0 text-base text-oh-cream/70">{t("empty")}</p>;
  }

  const earnedCount = signedIn ? seals.filter((s) => member.earnedSlugs.has(s.slug)).length : 0;

  return (
    <>
      {signedIn ? (
        <p data-seal-count className="m-0 mb-5 text-base text-oh-gold">
          {t("count", { earned: earnedCount, total: seals.length })}
        </p>
      ) : null}
      <ul className="m-0 grid list-none grid-cols-3 gap-x-3 gap-y-6 p-0 sm:grid-cols-4 lg:grid-cols-7">
        {seals.map((s) => (
          <li key={s.slug} className="min-w-0">
            <button
              type="button"
              data-seal-button={s.slug}
              data-seal-name={s.name}
              aria-haspopup="dialog"
              onClick={() => setOpenSlug(s.slug)}
              className="group flex w-full min-w-0 cursor-pointer appearance-none flex-col items-center gap-2 rounded-2xl border-0 bg-transparent px-1 py-2 font-[inherit] text-oh-cream transition-colors hover:bg-oh-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              <span className="transition-transform duration-200 group-hover:-rotate-3 group-active:scale-95 motion-reduce:transition-none">
                <Seal iconKey={s.iconKey} name={s.name} size={68} earned={earned(s.slug)} />
              </span>
              <span className="line-clamp-2 w-full text-center text-sm leading-snug text-oh-cream/85">{s.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open != null} onClose={() => setOpenSlug(null)} label={open?.name ?? t("title")} snapPoints={[0.7]} className={NIGHT}>
        {open ? (
          <div data-seal-sheet className={`${cjk ? "font-cjk" : "font-body"} pb-2`}>
            <div className="-mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenSlug(null)}
                aria-label={t("close")}
                className="-mr-2 flex h-11 w-11 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-oh-cream/80 hover:bg-oh-stone/60 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              <Seal iconKey={open.iconKey} name={open.name} size={120} earned={earned(open.slug)} />
              {category(open.category) ? (
                <span className="mt-5 block text-xs font-medium uppercase tracking-[0.2em] text-oh-mute">{category(open.category)}</span>
              ) : null}
              <h3 className={`${cjk ? "font-display-cjk" : "font-display"} m-0 mt-2 text-3xl font-normal leading-tight text-oh-cream`}>
                {open.name}
              </h3>
              {signedIn ? (
                <span
                  className={`mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${
                    earned(open.slug) ? "bg-oh-gold/15 text-oh-gold" : "bg-oh-stone text-oh-cream/80"
                  }`}
                >
                  {earned(open.slug) ? <Icon name="check" size={16} /> : null}
                  {earned(open.slug) ? t("earned") : t("notEarned")}
                </span>
              ) : null}
            </div>
            <div className="mt-6 rounded-2xl bg-oh-charcoal/70 p-4">
              <p className="m-0 text-sm font-semibold text-oh-cream/70">{t("howTo")}</p>
              <p className="m-0 mt-1 text-base text-oh-cream">{open.description}</p>
            </div>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
