"use client";

/**
 * Private events: days, hours and minutes until the event starts, ticking
 * once a minute. It renders after mount (the server's clock and the
 * phone's differ), holding its height so nothing shifts.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const MINUTE = 60_000;

export function countdownParts(startsAt: string, now: number): { days: number; hours: number; minutes: number } | null {
  const ms = new Date(startsAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.ceil(ms / MINUTE);
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}

// `timezone` is part of the contract (the event's zone); the countdown is an absolute interval, so it isn't needed for the math.
export function Countdown({ startsAt }: { startsAt: string; timezone: string }) {
  const t = useTranslations("events.countdown");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    let interval: ReturnType<typeof setInterval> | undefined;
    // Line the ticks up with the minute so the number turns over on time.
    const first = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), MINUTE);
    }, MINUTE - (Date.now() % MINUTE));
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, []);

  const parts = now === null ? null : countdownParts(startsAt, now);
  const started = now !== null && parts === null;
  const cells: Array<[number | null, string]> = [
    [parts?.days ?? null, t("days")],
    [parts?.hours ?? null, t("hours")],
    [parts?.minutes ?? null, t("minutes")],
  ];

  return (
    <section data-countdown aria-live="off" className="rounded-3xl border border-oh-stone/70 bg-oh-ink p-5">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">{t("label")}</p>
      {started ? (
        <p className="m-0 mt-3 flex min-h-[4.5rem] items-center font-display text-3xl text-oh-cream">{t("started")}</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {cells.map(([value, label]) => (
            <div key={label} className="flex min-w-0 flex-col items-start">
              <span className={`block font-display text-[2.75rem] leading-none tabular-nums text-oh-cream ${value === null ? "invisible" : ""}`}>
                {value === null ? 0 : String(value).padStart(2, "0")}
              </span>
              <span className="mt-1.5 text-sm text-oh-mute">{label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
