"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { api, ApiError } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { DataTable } from "../components/DataTable";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", "en-US": "English (US)", "en-GB": "English (UK)", "en-AU": "English (Australia)",
  "zh-TW": "Traditional Chinese (Taiwan)", "zh-CN": "Simplified Chinese (China)", "zh-HK": "Traditional Chinese (Hong Kong)",
  zh: "Chinese", es: "Spanish", "es-ES": "Spanish (Spain)", "es-MX": "Spanish (Mexico)", fr: "French", "fr-FR": "French (France)",
  de: "German", ja: "Japanese", ko: "Korean", pt: "Portuguese", "pt-BR": "Portuguese (Brazil)", it: "Italian", ru: "Russian",
  ar: "Arabic", hi: "Hindi", vi: "Vietnamese", th: "Thai", id: "Indonesian", ms: "Malay", tl: "Tagalog", nl: "Dutch",
  pl: "Polish", tr: "Turkish", uk: "Ukrainian", cs: "Czech", sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian",
  he: "Hebrew", el: "Greek", ro: "Romanian", hu: "Hungarian",
};
const languageName = (code: string) => LANGUAGE_NAMES[code] || LANGUAGE_NAMES[code.split("-")[0]] || code;

type LanguageData = {
  summary: { totalVisits: number; uniqueLanguages: number; unsupportedLanguageVisits: number; supportedLanguageVisits: number };
  allLanguages: Array<{ language: string; count: number; percentage: string; isSupported: boolean }>;
  unsupportedLanguages: Array<{ language: string; count: number; percentage: string }>;
  resolvedLocales: Array<{ locale: string; count: number; percentage: string }>;
};

const DAY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Failed to load data");

export default function LanguagesPage() {
  const [days, setDays] = useState("30");
  const res = useResource(`languages:${days}`, async (signal) => {
    const data = await api<LanguageData & { error?: string }>("/analytics/language", { signal, query: { days } });
    if (data.error) throw new Error(data.error);
    return data;
  });
  const failed = res.error && !res.data;
  const data = res.data;
  const supportedPct = data && data.summary.totalVisits > 0 ? ((data.summary.supportedLanguageVisits / data.summary.totalVisits) * 100).toFixed(1) : "0";

  return (
    <>
      <PageHeader title="Languages" subtitle="Visitor language preferences and localization gaps." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <SegmentedControl label="Days" value={days} onChange={setDays} options={DAY_OPTIONS} />
        {failed ? (
          <ErrorCard message={`Unable to load language analytics. ${errorText(res.error)}`} onRetry={res.reload} />
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Total visits" value={data.summary.totalVisits} hint={`Last ${days} days`} />
              <StatTile label="Unique languages" value={data.summary.uniqueLanguages} />
              <StatTile label="Supported language" value={`${supportedPct}%`} hint={`${data.summary.supportedLanguageVisits} visits`} />
              <StatTile label="Unsupported languages" value={data.summary.unsupportedLanguageVisits} hint="Localization opportunities" />
            </div>

            <Card title="Locales served">
              <p className="mb-4 text-sm text-oh-stone/70">What language version visitors actually saw on the site.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {data.resolvedLocales.map((l) => (
                  <div key={l.locale} className="rounded-xl border border-oh-stone/15 bg-oh-paper p-3">
                    <div className="text-sm text-oh-stone/70">{languageName(l.locale)}</div>
                    <div className="text-xs text-oh-stone/50">{l.locale}</div>
                    <div className="font-display text-2xl tabular-nums text-oh-charcoal">{l.count}</div>
                    <div className="text-sm text-oh-stone/60">{l.percentage}% of visits</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-oh-stone/15">
                      <div
                        style={{ width: `${l.percentage}%` }} // style-ok: share of visits
                        className="h-full rounded-full bg-oh-gold" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {data.unsupportedLanguages.length > 0 && (
              <DataTable title="Localization opportunities" rows={data.unsupportedLanguages}
                columns={[
                  { key: "language", label: "Language", render: (l) => `${languageName(l.language)} (${l.language})` },
                  { key: "count", label: "Visits", align: "right" },
                  { key: "percentage", label: "% of total", align: "right", render: (l) => `${l.percentage}%` },
                ]} />
            )}

            <DataTable title="All detected browser languages" rows={data.allLanguages}
              columns={[
                { key: "language", label: "Language", render: (l) => `${languageName(l.language)} (${l.language})` },
                { key: "count", label: "Visits", align: "right" },
                { key: "percentage", label: "% of total", align: "right", render: (l) => `${l.percentage}%` },
                { key: "isSupported", label: "Status", render: (l) => (l.isSupported ? "Supported" : "Not supported") },
              ]} />

            <p className="text-sm leading-relaxed text-oh-stone/70">
              Language data is collected from visitors&apos; browser settings. It represents preferences, not necessarily what
              they can read. When a preferred language isn&apos;t supported, visitors are shown the closest available locale or English.
            </p>
          </>
        )}
      </div>
    </>
  );
}
