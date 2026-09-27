"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Confidence, RegistryGroup, SourceKind } from "@oh/plan-model";
import type { RegisterRowData } from "./data";
import { formatRegistryValue, type UnitLabels } from "./format";

interface Props {
  rows: readonly RegisterRowData[];
  groups: readonly RegistryGroup[];
  changeDates: readonly string[];
  total: number;
  locale: string;
  modelHref: string;
}

const SOURCES: readonly SourceKind[] = ["spec", "owner-decision", "public-benchmark", "engine-assumption", "supplier-quote"];
const CONFIDENCE: readonly Confidence[] = ["high", "medium", "low"];
const CONF_CLASS: Readonly<Record<Confidence, string>> = {
  high: "bg-oh-olive-light/15 text-oh-olive-light ring-oh-olive-light/40",
  medium: "bg-oh-gold/15 text-oh-gold ring-oh-gold/40",
  low: "bg-oh-ember-light/15 text-oh-ember-light ring-oh-ember-light/40",
};

const select = "rounded-md border border-oh-stone bg-oh-charcoal px-2.5 py-1.5 text-[0.8rem] text-oh-cream focus:border-oh-ember focus:outline-none";
const check = "flex items-center gap-2 text-[0.8rem] text-oh-mute";

/**
 * The assumptions register: every value the engine reads, with its group,
 * source, date, confidence, whether it is a lever, what changed it, and
 * what would validate it. Search and filters narrow the table; a row
 * anchor (#a-unit-utilization-rate) clears the filters so a deep link from
 * the change log, an open item or a stat card always lands on its row.
 */
export function AssumptionsRegister({ rows, groups, changeDates, total, locale: localeProp, modelHref }: Props) {
  const t = useTranslations("plan.integrity.register");
  const to = useTranslations("plan.integrity.openItems.items");
  const locale = useLocale() || localeProp;
  const id = useId();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<RegistryGroup | "">("");
  const [source, setSource] = useState<SourceKind | "">("");
  const [confidence, setConfidence] = useState<Confidence | "">("");
  const [changed, setChanged] = useState<string>("");
  const [varies, setVaries] = useState(false);
  const [levers, setLevers] = useState(false);

  const units: UnitLabels = useMemo(
    () => ({ hours: t("units.hours"), days: t("units.days"), minutes: t("units.minutes"), months: t("units.months"), years: t("units.years"), oz: t("units.oz"), perYear: t("units.perYear"), perMonth: t("units.perMonth"), perHour: t("units.perHour"), perSqFt: t("units.perSqFt"), perLb: t("units.perLb"), yes: t("units.yes"), no: t("units.no") }),
    [t],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (group && r.group !== group) return false;
      if (source && r.source.kind !== source) return false;
      if (confidence && r.source.confidence !== confidence) return false;
      if (changed && !r.changedIn.includes(changed)) return false;
      if (varies && !r.variesByScenario) return false;
      if (levers && !r.lever) return false;
      if (needle && !`${r.label} ${r.key} ${r.source.detail}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, group, source, confidence, changed, varies, levers]);

  const clear = () => {
    setQ("");
    setGroup("");
    setSource("");
    setConfidence("");
    setChanged("");
    setVaries(false);
    setLevers(false);
  };
  const filtered = Boolean(q || group || source || confidence || changed || varies || levers);

  // Deep links: a hash that names a row clears the filters and scrolls to it.
  useEffect(() => {
    const go = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash.startsWith("a-") || !rows.some((r) => r.anchor === hash)) return;
      clear();
      window.requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "center" }));
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const fmtDate = (iso: string) => new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

  return (
    <div data-register="">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-oh-mute">
          {t("search")}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className={[select, "w-full normal-case tracking-normal"].join(" ")} />
        </label>
        <label className="flex flex-col gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-oh-mute">
          {t("filters.group")}
          <select value={group} onChange={(e) => setGroup(e.target.value as RegistryGroup | "")} className={select}>
            <option value="">{t("filters.any")}</option>
            {groups.map((g) => (
              <option key={g} value={g}>{t(`groups.${g}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-oh-mute">
          {t("filters.source")}
          <select value={source} onChange={(e) => setSource(e.target.value as SourceKind | "")} className={select}>
            <option value="">{t("filters.any")}</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{t(`sources.${s}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-oh-mute">
          {t("filters.confidence")}
          <select value={confidence} onChange={(e) => setConfidence(e.target.value as Confidence | "")} className={select}>
            <option value="">{t("filters.any")}</option>
            {CONFIDENCE.map((c) => (
              <option key={c} value={c}>{t(`confidence.${c}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-oh-mute">
          {t("filters.changed")}
          <select value={changed} onChange={(e) => setChanged(e.target.value)} className={select}>
            <option value="">{t("filters.any")}</option>
            {changeDates.map((d) => (
              <option key={d} value={d}>{fmtDate(d)}</option>
            ))}
          </select>
        </label>
        <label className={check}>
          <input type="checkbox" checked={varies} onChange={(e) => setVaries(e.target.checked)} className="accent-oh-ember" />
          {t("filters.varies")}
        </label>
        <label className={check}>
          <input type="checkbox" checked={levers} onChange={(e) => setLevers(e.target.checked)} className="accent-oh-ember" />
          {t("filters.levers")}
        </label>
      </div>
      <p className="m-0 mb-3 flex flex-wrap items-center gap-3 text-[0.78rem] text-oh-mute" aria-live="polite" data-register-count={shown.length}>
        <span>{t("count", { shown: shown.length, total: rows.length, all: total })}</span>
        {filtered ? (
          <button type="button" onClick={clear} className="rounded-md border border-oh-stone bg-transparent px-2 py-0.5 text-[0.74rem] text-oh-mute hover:border-oh-mute hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember">
            {t("clear")}
          </button>
        ) : null}
      </p>
      <div className="overflow-x-auto rounded-lg border border-oh-stone">
        <table id={`${id}-table`} className="w-full min-w-[56rem] border-collapse text-[0.8rem]">
          <thead>
            <tr className="border-b border-oh-stone bg-oh-ink text-left text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.assumption")}</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">{t("cols.value")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.source")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.asOf")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.confidence")}</th>
              <th scope="col" className="px-3 py-2 font-normal">{t("cols.notes")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-oh-mute">{t("noRows")}</td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.key} id={r.anchor} data-registry-key={r.key} className="scroll-mt-28 border-b border-oh-stone/60 align-top last:border-b-0 target:bg-oh-ember/10 target:ring-2 target:ring-inset target:ring-oh-ember">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="block text-oh-cream">{r.label}</span>
                    <span className="block font-mono text-[0.68rem] text-oh-mute">{r.key}</span>
                    <span className="mt-0.5 block text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute/80">{t(`groups.${r.group}`)}</span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums text-oh-cream">
                    <span className="block">{formatRegistryValue(r.value, r.unit, locale, units)}</span>
                    {r.variesByScenario ? <span className="block text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">{t("varies")}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-oh-mute">
                    <span className="block text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute/80">{t(`sources.${r.source.kind}`)}</span>
                    <span className="block">{r.source.detail}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-oh-mute">{fmtDate(r.source.asOf)}</td>
                  <td className="px-3 py-2">
                    <span className={["inline-block rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ring-1", CONF_CLASS[r.source.confidence]].join(" ")}>{t(`confidence.${r.source.confidence}`)}</span>
                  </td>
                  <td className="px-3 py-2 text-[0.74rem] text-oh-mute">
                    {r.lever ? (
                      <span className="block">
                        {r.onModel ? (
                          <Link href={modelHref} className="text-oh-cream underline decoration-oh-stone underline-offset-2 hover:decoration-oh-ember">{t("onModel")}</Link>
                        ) : (
                          <span className="text-oh-cream">{t("lever")}</span>
                        )}
                        {r.leverBounds ? <span> · {t("leverRange", { min: formatRegistryValue(r.leverBounds.min, r.unit, locale, units), max: formatRegistryValue(r.leverBounds.max, r.unit, locale, units) })}</span> : null}
                      </span>
                    ) : null}
                    {r.changedIn.length > 0 ? <span className="block">{t("changedIn", { date: fmtDate(r.changedIn[0] as string) })}</span> : null}
                    {r.awaiting.map((k) => (
                      <a key={k} href={`#open-${k}`} className="block text-oh-gold underline decoration-oh-gold/40 underline-offset-2 hover:decoration-oh-gold">
                        {t("awaiting", { item: to(`${k}.title`) })}
                      </a>
                    ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
