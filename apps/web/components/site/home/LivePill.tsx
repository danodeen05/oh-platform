"use client";

/**
 * Task D1: the hero's live line. Open now, until when, and how many pods
 * are free, for the location nearer the visitor, else City Creek.
 *
 * "Nearer" only ever uses a location the browser already has permission to
 * share: we never trigger a geolocation prompt on the home page. Without
 * permission (or coordinates) it's City Creek.
 *
 * Numbers come straight from GET /locations/:id/availability (useLiveStatus).
 * Nothing renders until there's real data, and a failed poll hides the pill
 * again. The wrapper always reserves the pill's height so the hero never
 * shifts when it appears.
 */
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatClock, nearest, useLiveStatus } from "@/lib/site/live";

export interface LivePillLocation {
  slug: string;
  id: string | null;
  lat: number | null;
  lng: number | null;
  name: string;
}

const FALLBACK_SLUG = "city-creek";

function useNearerSlug(locations: LivePillLocation[]): string {
  const [slug, setSlug] = useState(FALLBACK_SLUG);
  useEffect(() => {
    let cancelled = false;
    const perms = typeof navigator !== "undefined" ? navigator.permissions : undefined;
    if (!perms?.query || !navigator.geolocation) return;
    perms
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const best = nearest({ lat: pos.coords.latitude, lng: pos.coords.longitude }, locations);
            if (best?.id) setSlug(best.slug);
          },
          () => {},
          { maximumAge: 10 * 60_000, timeout: 5_000 },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locations]);
  return slug;
}

export function LivePill({ locations }: { locations: LivePillLocation[] }) {
  const t = useTranslations("home.live");
  const locale = useLocale();
  const slug = useNearerSlug(locations);
  const location = locations.find((l) => l.slug === slug && l.id) ?? locations.find((l) => l.slug === FALLBACK_SLUG) ?? null;
  const state = useLiveStatus(location?.id ?? null);
  const data = state.status === "ready" ? state.data : null;

  return (
    <div data-live-ready={state.status === "loading" ? "false" : "true"} className="min-h-10">
      {data && location ? (
        <p
          data-live-pill
          data-location={location.slug}
          data-open={data.isOpen === null ? "unknown" : String(data.isOpen)}
          className="hm-rise m-0 inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-2xl bg-oh-charcoal/75 px-4 py-2 text-sm leading-snug text-oh-cream ring-1 ring-oh-cream/15"
        >
          <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold">
            {data.isOpen !== null ? (
              <span
                aria-hidden="true"
                data-open={String(data.isOpen)}
                className={`hm-live-dot relative inline-block size-2 shrink-0 rounded-full ${data.isOpen ? "bg-oh-olive-light" : "bg-oh-ash"}`}
              />
            ) : null}
            {location.name}
          </span>
          {/* Open/closed and the time only when the API reports real hours (live.ts). */}
          {data.isOpen !== null ? (
            <span data-live-status className="whitespace-nowrap">
              {data.isOpen && data.closesAt !== null ? t("openUntil", { time: formatClock(data.closesAt, locale) }) : t("closed")}
            </span>
          ) : null}
          {data.isOpen !== false && data.podsFree !== null ? (
            <span data-live-pods data-value={data.podsFree} className="whitespace-nowrap tabular-nums text-oh-gold">
              {t("podsFree", { count: data.podsFree })}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
