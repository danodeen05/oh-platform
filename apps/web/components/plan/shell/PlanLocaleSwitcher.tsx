"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PLAN_LOCALES, swapLocale } from "@/lib/plan/locales";

const NAMES: Record<(typeof PLAN_LOCALES)[number], string> = { en: "English", "zh-TW": "繁體中文" };

/** Shows only the locales the plan ships complete (spec 7.4). */
export function PlanLocaleSwitcher({ locale, label }: { locale: string; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-[0.72rem] text-oh-mute">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={locale}
        onChange={(e) => {
          const qs = search.toString();
          router.push(swapLocale(pathname, e.target.value) + (qs ? `?${qs}` : ""));
        }}
        className="rounded-md border border-oh-stone bg-oh-charcoal px-2 py-1 text-[0.75rem] text-oh-cream focus:border-oh-ember focus:outline-none"
      >
        {PLAN_LOCALES.map((l) => (
          <option key={l} value={l}>
            {NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
