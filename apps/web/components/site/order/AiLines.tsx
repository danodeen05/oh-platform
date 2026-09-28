"use client";

/**
 * The status page's lines (Task D6): the live kitchen feed, and three
 * things to open while the bowl cooks (a fortune, a roast of the order, the
 * ingredients' backstories), then One Red Step's mental-health fact.
 *
 * The words come from the API's AI routes, in the page's language, exactly
 * as the legacy page called them (the plan's demo relies on it):
 *   GET /orders/commentary?orderQrCode=&locale=     (useOrderStatus, per stage)
 *   GET /orders/fortune?orderQrCode=&locale=        (on open)
 *   GET /orders/roast?orderQrCode=&locale=          (on open)
 *   GET /orders/:id/backstory?locale=               (on open)
 *   GET /orders/mental-health-fact?locale=          (once checked in)
 * The chrome around them is `orderStatus.lines.*`.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Eyebrow } from "@/components/site/Text";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { SITE_API_URL } from "@/lib/site/api";
import { Spinner } from "./StepSheet";
import { SECONDARY } from "./PodCard";
import { TENANT, type FeedLine } from "./useOrderStatus";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: TENANT });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ kitchen feed */

export function KitchenFeed({ feed, loading }: { feed: FeedLine | null; loading: boolean }) {
  const t = useTranslations("orderStatus.lines.feed");
  const locale = useLocale();
  const line = feed?.commentary;
  return (
    <section data-kitchen-feed data-status-section aria-label={t("label")} className="rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
          <span className="oh-status-pulse absolute inset-0 rounded-full bg-oh-ember-light/60" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-oh-ember-light" />
        </span>
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("label")}
        </Eyebrow>
      </div>
      <div aria-live="polite" className="mt-3">
        {loading && !line ? (
          <p className="m-0 text-[15px] text-oh-mute">{t("listening")}</p>
        ) : line ? (
          <blockquote className={`m-0 text-[1.35rem] leading-snug text-oh-cream ${locale.startsWith("zh") ? "font-display-cjk" : "font-display [font-style:italic]"}`}>
            {line}
          </blockquote>
        ) : (
          <p className="m-0 text-[15px] text-oh-mute">{t("quiet")}</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ the three lines */

interface Fortune {
  fortune: string;
  luckyNumbers?: number[];
  thisDayInHistory?: { year: number; event: string } | null;
  learnChinese?: { traditional: string; pinyin: string; english: string; funFact?: string } | null;
}
interface Roast {
  roast: string;
  highlights?: string[];
}
interface Backstory {
  backstories: string[];
}

type LineKind = "fortune" | "roast" | "backstory";

function LineCard({
  kind,
  icon,
  tone,
  onOpen,
  state,
  children,
}: {
  kind: LineKind;
  icon: IconName;
  tone: "linen" | "ink";
  onOpen: () => void;
  state: "closed" | "loading" | "open" | "empty";
  children?: ReactNode;
}) {
  const t = useTranslations(`orderStatus.lines.${kind}`);
  const locale = useLocale();
  const linen = tone === "linen";
  return (
    <section
      data-line={kind}
      data-status-section
      aria-label={t("title")}
      className={`rounded-[1.75rem] px-5 py-5 ${linen ? "bg-oh-linen text-oh-charcoal" : "bg-oh-ink text-oh-cream ring-1 ring-oh-stone"}`}
    >
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${linen ? "bg-oh-charcoal text-oh-linen" : "bg-oh-charcoal text-oh-ember-light"}`}>
          <Icon name={icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`m-0 text-lg font-semibold leading-snug ${locale.startsWith("zh") ? "font-cjk" : "font-body"}`}>{t("title")}</h2>
          {state === "closed" ? <p className={`m-0 mt-1 text-[15px] leading-relaxed ${linen ? "text-oh-charcoal/75" : "text-oh-mute"}`}>{t("lede")}</p> : null}
        </div>
      </div>
      {state === "closed" ? (
        <button
          type="button"
          data-line-open={kind}
          onClick={onOpen}
          className={`${SECONDARY} mt-4 ${linen ? "!bg-oh-charcoal !text-oh-cream !ring-0" : ""}`}
        >
          {t("open")}
        </button>
      ) : state === "loading" ? (
        <p role="status" className={`m-0 mt-4 flex items-center gap-2.5 text-[15px] ${linen ? "text-oh-charcoal/75" : "text-oh-mute"}`}>
          <Spinner />
          {t("loading")}
        </p>
      ) : state === "empty" ? (
        <p className={`m-0 mt-4 text-[15px] leading-relaxed ${linen ? "text-oh-charcoal/75" : "text-oh-mute"}`}>{t("unavailable")}</p>
      ) : (
        <div aria-live="polite" className="mt-4">
          {children}
        </div>
      )}
    </section>
  );
}

export function FortuneLine({ orderQrCode }: { orderQrCode: string }) {
  const t = useTranslations("orderStatus.lines.fortune");
  const locale = useLocale();
  const [state, setState] = useState<"closed" | "loading" | "open" | "empty">("closed");
  const [data, setData] = useState<Fortune | null>(null);
  async function open() {
    setState("loading");
    const d = await getJson<Fortune>(`${SITE_API_URL}/orders/fortune?orderQrCode=${encodeURIComponent(orderQrCode)}&locale=${encodeURIComponent(locale)}`);
    setData(d);
    setState(d?.fortune ? "open" : "empty");
  }
  const zh = locale.startsWith("zh");
  return (
    <LineCard kind="fortune" icon="seal" tone="linen" onOpen={open} state={state}>
      {data ? (
        <>
          <p data-line-text className={`m-0 text-[1.35rem] leading-snug text-oh-charcoal ${zh ? "font-display-cjk" : "font-display [font-style:italic]"}`}>
            {data.fortune}
          </p>
          {data.luckyNumbers?.length ? (
            <div className="mt-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-charcoal/70">{t("lucky")}</p>
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                {data.luckyNumbers.map((n, i) => (
                  <li key={i} className="flex h-10 min-w-10 items-center justify-center rounded-full bg-oh-charcoal px-2 text-[15px] font-semibold tabular-nums text-oh-linen">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.thisDayInHistory ? (
            <div className="mt-4 rounded-2xl bg-oh-charcoal/[0.06] px-4 py-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-charcoal/70">{t("thisDay", { year: data.thisDayInHistory.year })}</p>
              <p className="m-0 mt-1 text-[15px] leading-relaxed text-oh-charcoal">{data.thisDayInHistory.event}</p>
            </div>
          ) : null}
          {/* "Learn Chinese" teaches the English word for the characters: only on the Latin-script pages. */}
          {data.learnChinese && !zh ? (
            <div className="mt-4 rounded-2xl bg-oh-ember-deep px-4 py-4 text-oh-cream">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-cream/80">{t("learn")}</p>
              <p className="m-0 mt-2 font-display-cjk text-[2.25rem] leading-none" lang="zh-Hant">
                {data.learnChinese.traditional}
              </p>
              <p className="m-0 mt-2 text-[15px] font-semibold">{data.learnChinese.pinyin}</p>
              <p className="m-0 text-[15px] text-oh-cream/90">{data.learnChinese.english}</p>
              {data.learnChinese.funFact ? <p className="m-0 mt-2 text-sm leading-relaxed text-oh-cream/90">{data.learnChinese.funFact}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </LineCard>
  );
}

export function RoastLine({ orderQrCode }: { orderQrCode: string }) {
  const t = useTranslations("orderStatus.lines.roast");
  const locale = useLocale();
  const [state, setState] = useState<"closed" | "loading" | "open" | "empty">("closed");
  const [data, setData] = useState<Roast | null>(null);
  async function open() {
    setState("loading");
    const d = await getJson<Roast>(`${SITE_API_URL}/orders/roast?orderQrCode=${encodeURIComponent(orderQrCode)}&locale=${encodeURIComponent(locale)}`);
    setData(d);
    setState(d?.roast ? "open" : "empty");
  }
  return (
    <LineCard kind="roast" icon="flame" tone="ink" onOpen={open} state={state}>
      {data ? (
        <>
          <p data-line-text className="m-0 text-[17px] leading-relaxed text-oh-cream">
            {data.roast}
          </p>
          {data.highlights?.length ? (
            <div className="mt-4 border-t border-oh-stone pt-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-ember-light">{t("highlights")}</p>
              <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                {data.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-oh-cream/90">
                    <Icon name="flame" size={16} className="mt-1 shrink-0 text-oh-ember-light" />
                    <span className="min-w-0">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </LineCard>
  );
}

export function BackstoryLine({ orderId }: { orderId: string }) {
  const locale = useLocale();
  const [state, setState] = useState<"closed" | "loading" | "open" | "empty">("closed");
  const [data, setData] = useState<Backstory | null>(null);
  async function open() {
    setState("loading");
    const d = await getJson<Backstory>(`${SITE_API_URL}/orders/${encodeURIComponent(orderId)}/backstory?locale=${encodeURIComponent(locale)}`);
    setData(d);
    setState(d?.backstories?.length ? "open" : "empty");
  }
  return (
    <LineCard kind="backstory" icon="chopsticks" tone="linen" onOpen={open} state={state}>
      {data ? (
        <ol data-line-text className="m-0 list-none space-y-3 p-0">
          {data.backstories.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-oh-charcoal">
              <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-oh-charcoal text-xs font-semibold text-oh-linen">
                {i + 1}
              </span>
              <span className="min-w-0">{s}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </LineCard>
  );
}

/* ------------------------------------------------------------ One Red Step */

export function RedStepLine({ name }: { name: string }) {
  const t = useTranslations("orderStatus.lines.redStep");
  const locale = useLocale();
  const [fact, setFact] = useState<{ question: string; fact: string; source: string } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");
  useEffect(() => {
    let live = true;
    getJson<{ question: string; fact: string; source: string }>(`${SITE_API_URL}/orders/mental-health-fact?locale=${encodeURIComponent(locale)}`).then((d) => {
      if (!live) return;
      setFact(d);
      setState(d?.fact ? "ready" : "none");
    });
    return () => {
      live = false;
    };
  }, [locale]);
  if (state === "none") return null;
  return (
    <section data-red-step data-status-section aria-label={t("label")} className="rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
      <Eyebrow locale={locale} className="text-oh-ember-light">
        {t("label")}
      </Eyebrow>
      {state === "loading" || !fact ? (
        <p className="m-0 mt-3 text-[15px] text-oh-mute">{t("loading")}</p>
      ) : (
        <>
          <h2 className={`m-0 mt-3 text-lg font-semibold leading-snug text-oh-cream ${locale.startsWith("zh") ? "font-cjk" : "font-body"}`}>{fact.question}</h2>
          <p className="m-0 mt-2 text-[15px] leading-relaxed text-oh-cream/90">{fact.fact}</p>
          <p className="m-0 mt-2 text-sm text-oh-mute">{t("source", { source: fact.source })}</p>
          <p className="m-0 mt-4 text-[15px] leading-relaxed text-oh-mute">{t("lede", { name })}</p>
          <a
            href="https://www.oneredstepatatime.org"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-oh-charcoal px-5 text-[15px] font-semibold text-oh-cream no-underline ring-1 ring-inset ring-oh-ember-light/60 hover:bg-oh-stone/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("cta")}
            <Icon name="arrow" size={18} className="text-oh-ember-light" />
            <span className="sr-only">{t("newTab")}</span>
          </a>
          <p className="m-0 mt-3 text-xs uppercase tracking-[0.14em] text-oh-mute">{t("foundation")}</p>
        </>
      )}
    </section>
  );
}
