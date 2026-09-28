"use client";

/**
 * Order, step 1 (Task D5): pick a location. Big photo cards (one tap each),
 * then a quiet row for eating together: start a group (signed in) or join
 * one with a code. A `?ref=` referral code is kept for sign-up, as before.
 * `?group=true` (the old "start a group" link) opens the group row ready.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Icon } from "@/components/site/icons/Icon";
import { StepSheet } from "@/components/site/order/StepSheet";
import { ClosedPanel } from "@/components/site/order/ClosedPanel";
import { SITE_IMAGES, type ImageKey } from "@/lib/site/images";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { loadDraft, saveDraft } from "@/lib/site/order-draft";

export type LocationCard = {
  id: string;
  name: string;
  landmarks: string | null;
  address: string | null;
  open: boolean;
  canOrder: boolean;
  image: ImageKey;
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export default function LocationSelector({ locations, dineInEnabled }: { locations: LocationCard[]; dineInEnabled: boolean }) {
  const t = useTranslations("orderFlow.location");
  const tf = useTranslations("orderFlow");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const api = useSiteApi();
  const member = useMemberId();
  const [groupMode, setGroupMode] = useState(search.get("group") === "true");
  const [code, setCode] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [referral, setReferral] = useState(false);

  // A referral link (/order?ref=CODE): kept for the account the guest signs up with.
  useEffect(() => {
    const ref = search.get("ref");
    try {
      if (ref) localStorage.setItem("pendingReferralCode", ref);
      setReferral(Boolean(ref || localStorage.getItem("pendingReferralCode")));
    } catch {
      /* storage blocked */
    }
  }, [search]);

  async function choose(loc: LocationCard) {
    if (groupMode) {
      if (!member.signedIn) {
        setGroupError(t("group.signIn"));
        return;
      }
      setBusy(loc.id);
      setGroupError(null);
      const res = await api(`${SITE_API_URL}/group-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": "oh" },
        body: JSON.stringify({ locationId: loc.id }),
      }).catch(() => null);
      const body = res && res.ok ? await res.json().catch(() => null) : null;
      if (!body?.code) {
        setGroupError(t("group.failed"));
        setBusy(null);
        return;
      }
      router.push(`/${locale}/group/${encodeURIComponent(body.code)}`);
      return;
    }
    setBusy(loc.id);
    try {
      const storage = window.sessionStorage;
      const d = loadDraft(storage);
      if (d.locationId !== loc.id) saveDraft(storage, { ...d, locationId: loc.id, pod: { mode: "best" }, order: null });
    } catch {
      /* the flow still starts; the draft is created there */
    }
    router.push(`/${locale}/order/location/${encodeURIComponent(loc.id)}`);
  }

  if (!dineInEnabled) {
    return (
      <StepSheet step="location" title={tf("closed.title")} backHref={null}>
        <ClosedPanel />
      </StepSheet>
    );
  }

  return (
    <StepSheet step="location" title={groupMode ? t("group.pickTitle") : t("title")} lede={groupMode ? t("group.pickLede") : t("lede")} backHref={null}>
      {referral ? (
        <p className="m-0 mb-5 flex items-center gap-2 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] text-oh-cream">
          <Icon name="gift" size={18} className="shrink-0 text-oh-gold" />
          {t("referral")}
        </p>
      ) : null}

      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {locations.map((loc) => (
          <li key={loc.id}>
            <button
              type="button"
              data-location-card={loc.id}
              onClick={() => choose(loc)}
              disabled={busy !== null}
              aria-describedby={`loc-${loc.id}-status`}
              className={`group relative block w-full cursor-pointer appearance-none overflow-hidden rounded-[28px] border-0 bg-oh-ink p-0 text-left font-[inherit] disabled:cursor-wait ${FOCUS}`}
            >
              <span className="relative block aspect-[4/3] w-full overflow-hidden [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-[1.03] motion-reduce:[&_img]:transition-none">
                <SitePicture image={loc.image} sizes="(min-width: 768px) 440px, 100vw" priority alt={tRoot(SITE_IMAGES[loc.image].alt)} className="block h-full w-full" />
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-oh-charcoal via-oh-charcoal/30 to-transparent" />
              </span>
              <span className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-5">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span id={`loc-${loc.id}-status`} className="flex items-center gap-2 text-sm text-oh-cream">
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${loc.canOrder ? "bg-oh-olive-light" : "bg-oh-ember-light"}`} />
                    {!loc.open ? t("closedNow") : loc.canOrder ? t("open") : t("orderingPaused")}
                  </span>
                  <span className="text-2xl font-semibold leading-tight text-oh-cream [overflow-wrap:anywhere]">{loc.name}</span>
                  {loc.landmarks ? <span className="text-[15px] text-oh-cream/80">{loc.landmarks}</span> : null}
                </span>
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep text-oh-cream transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none">
                  {busy === loc.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : <Icon name="chevron" size={22} />}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Eating together */}
      <section aria-labelledby="group-title" className="mt-8 rounded-3xl bg-oh-ink p-5">
        <h2 id="group-title" className="m-0 text-lg font-semibold text-oh-cream">
          {t("group.title")}
        </h2>
        <p className="m-0 mt-1 text-[15px] leading-relaxed text-oh-mute">{groupMode ? t("group.startHint") : t("group.body")}</p>
        {groupError ? (
          <p role="alert" className="m-0 mt-3 text-sm text-oh-ember-light">
            {groupError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            aria-pressed={groupMode}
            onClick={() => {
              setGroupMode((g) => !g);
              setGroupError(null);
            }}
            className={`flex min-h-12 w-full cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border px-5 font-[inherit] text-[15px] font-semibold ${FOCUS} ${
              groupMode ? "border-oh-cream bg-oh-cream text-oh-charcoal" : "border-oh-stone bg-transparent text-oh-cream hover:border-oh-mute"
            }`}
          >
            <Icon name="user" size={18} />
            {groupMode ? t("group.cancel") : t("group.start")}
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c) router.push(`/${locale}/group/${encodeURIComponent(c)}`);
            }}
          >
            <label htmlFor="group-code" className="sr-only">
              {t("group.joinLabel")}
            </label>
            <input
              id="group-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("group.joinPlaceholder")}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 rounded-full border border-oh-stone bg-oh-charcoal px-5 font-[inherit] text-base uppercase tracking-wider text-oh-cream placeholder:normal-case placeholder:tracking-normal placeholder:text-oh-mute focus-visible:border-oh-cream focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className={`h-12 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-oh-stone px-5 font-[inherit] text-[15px] font-semibold text-oh-cream disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
            >
              {t("group.join")}
            </button>
          </form>
        </div>
      </section>
    </StepSheet>
  );
}
