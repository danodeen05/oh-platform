"use client";

/**
 * Task D8: the seal collection. Every seal in the catalog (localized names
 * from the badge rows' i18n, read on the server), earned ones pressed in
 * cinnabar, the rest in outline. A seal earned since the member last looked
 * is stamped onto the page (a press, a slight tilt) the first time the
 * collection scrolls into view; the "seen" list lives in localStorage per
 * member, and every read and write is wrapped so a blocked storage just
 * means no stamp animation.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { Seal } from "@/components/site/seal/Seal";
import { Eyebrow, Title } from "@/components/site/Text";
import { localizedHref } from "@/lib/site/nav";
import { newlyEarned, sealsSeenKey } from "./moments";

export interface CollectionSeal {
  slug: string;
  iconKey: string;
  name: string;
}

function readSeen(userId: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(sealsSeenKey(userId));
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : null;
  } catch {
    return null;
  }
}

function writeSeen(userId: string, slugs: string[]) {
  try {
    window.localStorage.setItem(sealsSeenKey(userId), JSON.stringify(slugs));
  } catch {
    /* storage unavailable: the stamp just plays again next time */
  }
}

export function SealCollection({ seals, earned, userId }: { seals: CollectionSeal[]; earned: string[]; userId: string }) {
  const t = useTranslations("passport.seals");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLUListElement>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [play, setPlay] = useState(false);
  const earnedSet = new Set(earned);
  const earnedKey = earned.join(",");

  useEffect(() => {
    const list = earnedKey ? earnedKey.split(",") : [];
    const newOnes = newlyEarned(list, readSeen(userId));
    setFresh(newOnes);
    if (newOnes.length === 0) return;
    const node = ref.current;
    const done = () => writeSeen(userId, list);
    if (reduced || !node || typeof IntersectionObserver === "undefined") {
      done();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlay(true);
          done();
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [userId, earnedKey, reduced]);

  if (seals.length === 0) return null;
  const earnedCount = seals.filter((s) => earnedSet.has(s.slug)).length;

  return (
    <section aria-labelledby="seals-title" className="px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("eyebrow")}
            </Eyebrow>
            <Title id="seals-title" locale={locale} className="m-0 mt-3 text-oh-cream">
              {t("title")}
            </Title>
          </div>
          <p className="m-0 text-base tabular-nums text-oh-cream/75">{t("count", { earned: earnedCount, total: seals.length })}</p>
        </div>
        <ul ref={ref} className="m-0 mt-8 grid list-none grid-cols-3 gap-x-3 gap-y-6 p-0 sm:grid-cols-5 md:grid-cols-7">
          {seals.map((s) => {
            const has = earnedSet.has(s.slug);
            const isFresh = has && fresh.includes(s.slug);
            const stamping = play && !reduced && isFresh;
            // A fresh seal waits off the page until the collection is in view, then stamps in.
            const waiting = isFresh && !play && !reduced;
            return (
              <li key={s.slug} data-seal={s.slug} data-earned={has ? "true" : "false"} className="flex min-w-0 flex-col items-center text-center">
                <span
                  className={`inline-flex ${has ? "-rotate-6" : ""} ${stamping ? "mp-stamp" : ""} ${waiting ? "opacity-0" : ""}`}
                  style={stamping ? { ["--mp-stamp-delay" as string]: `${fresh.indexOf(s.slug) * 160 + 120}ms` } : undefined}
                >
                  <Seal iconKey={s.iconKey} name={s.name} size={64} earned={has} />
                </span>
                <span className={`mt-2 text-sm leading-snug ${has ? "text-oh-cream" : "text-oh-cream/65"}`}>{s.name}</span>
                <span className="sr-only">{has ? t("earned") : t("notEarned")}</span>
                {isFresh ? (
                  <span className="mt-1 rounded-full bg-oh-gold/15 px-2 py-0.5 text-xs font-semibold text-oh-gold">{t("new")}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Link
          href={`${localizedHref(locale, "/rewards")}#seals`}
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-ember-light no-underline hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          {t("guide")}
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </section>
  );
}
