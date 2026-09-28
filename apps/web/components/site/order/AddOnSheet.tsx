"use client";

/**
 * "Add to my order" at the pod (Task D6), in the motion kit's bottom sheet:
 * free drink refills (or water), free extra vegetables, and paid add-ons
 * (up to 3 of each). Same routes as the legacy page:
 *   GET  /orders/:id/available-addons?locale=
 *   POST /orders/:id/refill            { drinkMenuItemId? }
 *   POST /orders/:id/extra-vegetables  { items: [{ menuItemId, selectedValue: "Extra" }] }
 *   POST /orders/:id/addons            { items: [{ menuItemId, quantity }] }
 * A paid add-on is priced by the server and paid on the regular pay step
 * (Task A6); the plan's demo answers with `demo: true` and nothing is charged.
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/site/motion/Sheet";
import { Icon } from "@/components/site/icons/Icon";
import { Eyebrow } from "@/components/site/Text";
import { SITE_API_URL, type SiteFetch } from "@/lib/site/api";
import { formatCents } from "@/lib/site/order-flow";
import { Spinner } from "./StepSheet";
import { PRIMARY, SECONDARY } from "./PodCard";
import { TENANT } from "./useOrderStatus";

interface Addons {
  paidAddons: { id: string; name: string; basePriceCents: number }[];
  refillableDrinks: { id: string; name: string }[];
  extraVegetables: { id: string; name: string }[];
}

export const NIGHT_SHEET =
  "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone [&_.oh-sheet-panel]:max-w-xl [&_.oh-sheet-panel]:px-4";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const MAX_EACH = 3;

export function AddOnSheet({
  open,
  onClose,
  orderId,
  api,
  headers,
  onNotice,
  onCallStaff,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  api: SiteFetch;
  headers: Record<string, string>;
  onNotice: (text: string) => void;
  onCallStaff: () => void;
}) {
  const t = useTranslations("afterOrder.addOns");
  const locale = useLocale();
  const router = useRouter();
  const cjk = locale.startsWith("zh");
  const [data, setData] = useState<Addons | null>(null);
  const [load, setLoad] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [veg, setVeg] = useState<Set<string>>(new Set());
  const [paid, setPaid] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPaid(new Map());
    setVeg(new Set());
    setError(null);
    if (load === "ready") return;
    setLoad("loading");
    (async () => {
      try {
        const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(orderId)}/available-addons?locale=${encodeURIComponent(locale)}`, { headers: { ...TENANT, ...headers } });
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        setData({ paidAddons: d.paidAddons || [], refillableDrinks: d.refillableDrinks || [], extraVegetables: d.extraVegetables || [] });
        setLoad("ready");
      } catch {
        setLoad("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, locale]);

  async function post(path: string, body: unknown): Promise<{ ok: boolean; data: any }> {
    try {
      const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(orderId)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...TENANT, ...headers },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, data: await res.json().catch(() => null) };
    } catch {
      return { ok: false, data: null };
    }
  }

  async function refill(drinkId?: string) {
    setBusy(drinkId || "water");
    setError(null);
    const r = await post("refill", { drinkMenuItemId: drinkId });
    setBusy(null);
    if (!r.ok) return setError(t("failed"));
    onNotice(t("refillSent"));
    onClose();
  }

  async function requestVeg() {
    setBusy("veg");
    setError(null);
    const r = await post("extra-vegetables", { items: [...veg].map((id) => ({ menuItemId: id, selectedValue: "Extra" })) });
    setBusy(null);
    if (!r.ok) return setError(t("failed"));
    onNotice(t("extrasSent"));
    onClose();
  }

  async function payAddons() {
    setBusy("paid");
    setError(null);
    const r = await post("addons", { items: [...paid.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity })) });
    setBusy(null);
    if (!r.ok || !r.data) return setError(t("failed"));
    if (r.data.demo) {
      onNotice(t("demoAdded"));
      onClose();
      return;
    }
    const addon = r.data.order;
    onClose();
    router.push(`/${locale}/order/payment?orderId=${encodeURIComponent(addon.id)}&orderNumber=${encodeURIComponent(addon.orderNumber || "")}`);
  }

  const paidTotal = data ? [...paid.entries()].reduce((sum, [id, q]) => sum + (data.paidAddons.find((a) => a.id === id)?.basePriceCents || 0) * q, 0) : 0;
  const nothing = data && !data.refillableDrinks.length && !data.extraVegetables.length && !data.paidAddons.length;

  return (
    <Sheet open={open} onClose={onClose} label={t("title")} snapPoints={[0.9]} className={NIGHT_SHEET}>
      <div data-addon-sheet className={`flex flex-col pb-[max(1rem,env(safe-area-inset-bottom,0px))] ${cjk ? "font-cjk" : "font-body"}`}>
        <div className="-mt-2 mb-2 flex items-center justify-between gap-3">
          <h2 className={`${cjk ? "font-display-cjk" : "font-display"} m-0 text-3xl font-normal text-oh-cream`}>{t("title")}</h2>
          <button type="button" onClick={onClose} className={`-mr-2 flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-oh-cream/80 hover:bg-oh-stone/60 ${FOCUS}`}>
            <Icon name="close" size={22} title={t("close")} />
          </button>
        </div>

        {load === "loading" || load === "idle" ? (
          <p role="status" className="m-0 flex items-center gap-2.5 py-6 text-oh-mute">
            <Spinner />
            {t("loading")}
          </p>
        ) : load === "error" || !data ? (
          <div className="py-4">
            <p className="m-0 text-[15px] text-oh-mute">{t("loadFailed")}</p>
            <button type="button" onClick={onCallStaff} className={`${SECONDARY} mt-4`}>
              <Icon name="bell" size={20} />
              {t("callInstead")}
            </button>
          </div>
        ) : nothing ? (
          <div className="py-4">
            <p className="m-0 text-[15px] text-oh-mute">{t("none")}</p>
            <button type="button" onClick={onCallStaff} className={`${SECONDARY} mt-4`}>
              <Icon name="bell" size={20} />
              {t("callInstead")}
            </button>
          </div>
        ) : (
          <div className="space-y-7 pt-1">
            {data.refillableDrinks.length ? (
              <section aria-labelledby="addon-refills">
                <SectionHead id="addon-refills" title={t("refills")} badge={t("free")} />
                <ul className="m-0 mt-3 list-none space-y-2 p-0">
                  {[...data.refillableDrinks.map((d) => ({ id: d.id, name: d.name })), { id: "", name: t("water") }].map((d) => (
                    <li key={d.id || "water"}>
                      <button
                        type="button"
                        data-refill={d.id || "water"}
                        disabled={busy !== null}
                        onClick={() => refill(d.id || undefined)}
                        className={`flex min-h-12 w-full cursor-pointer appearance-none items-center justify-between gap-3 rounded-2xl border-0 bg-oh-charcoal px-4 py-3 text-left font-[inherit] text-[15px] text-oh-cream ring-1 ring-inset ring-oh-stone hover:bg-oh-stone/60 disabled:cursor-default ${FOCUS}`}
                      >
                        <span className="min-w-0">{d.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-oh-ember-light">
                          {busy === (d.id || "water") ? <Spinner /> : null}
                          {t("refill")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {data.extraVegetables.length ? (
              <section aria-labelledby="addon-veg">
                <SectionHead id="addon-veg" title={t("extras")} badge={t("free")} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.extraVegetables.map((v) => {
                    const on = veg.has(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const next = new Set(veg);
                          if (on) next.delete(v.id);
                          else next.add(v.id);
                          setVeg(next);
                        }}
                        className={`flex min-h-11 cursor-pointer appearance-none items-center gap-1.5 rounded-full border-0 px-4 font-[inherit] text-[15px] ring-1 ring-inset ${on ? "bg-oh-cream text-oh-charcoal ring-oh-cream" : "bg-oh-charcoal text-oh-cream ring-oh-stone hover:bg-oh-stone/60"} ${FOCUS}`}
                      >
                        {on ? <Icon name="check" size={16} /> : null}
                        {v.name}
                      </button>
                    );
                  })}
                </div>
                {veg.size ? (
                  <button type="button" data-request-extras onClick={requestVeg} disabled={busy !== null} className={`${PRIMARY} mt-3`}>
                    {busy === "veg" ? <Spinner /> : null}
                    {t("requestExtras", { count: veg.size })}
                  </button>
                ) : null}
              </section>
            ) : null}

            {data.paidAddons.length ? (
              <section aria-labelledby="addon-paid">
                <SectionHead id="addon-paid" title={t("paid")} />
                <ul className="m-0 mt-3 list-none space-y-2 p-0">
                  {data.paidAddons.map((a) => {
                    const q = paid.get(a.id) || 0;
                    const set = (n: number) => {
                      const next = new Map(paid);
                      if (n <= 0) next.delete(a.id);
                      else next.set(a.id, Math.min(MAX_EACH, n));
                      setPaid(next);
                    };
                    return (
                      <li key={a.id} data-paid-addon={a.id} className="flex items-center gap-3 rounded-2xl bg-oh-charcoal px-4 py-2.5 ring-1 ring-inset ring-oh-stone">
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-[15px] text-oh-cream">{a.name}</p>
                          <p className="m-0 text-sm tabular-nums text-oh-mute">{formatCents(a.basePriceCents, locale)}</p>
                        </div>
                        {q === 0 ? (
                          <button type="button" onClick={() => set(1)} aria-label={t("addOne", { name: a.name })} className={`flex h-11 min-w-11 cursor-pointer appearance-none items-center justify-center gap-1 rounded-full border-0 bg-oh-stone px-3.5 font-[inherit] text-sm font-semibold text-oh-cream hover:brightness-110 ${FOCUS}`}>
                            <Icon name="plus" size={16} />
                            <span aria-hidden="true">{t("add")}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => set(q - 1)} aria-label={t("less", { name: a.name })} className={`flex h-11 w-11 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-oh-stone p-0 text-oh-cream ${FOCUS}`}>
                              <span aria-hidden="true" className="h-0.5 w-3.5 rounded-full bg-current" />
                            </button>
                            <span aria-live="polite" className="w-7 text-center text-base font-semibold tabular-nums text-oh-cream">
                              {q}
                            </span>
                            <button type="button" onClick={() => set(q + 1)} disabled={q >= MAX_EACH} aria-label={t("more", { name: a.name })} className={`flex h-11 w-11 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-oh-stone p-0 text-oh-cream disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}>
                              <Icon name="plus" size={16} />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {paid.size ? (
                  <div className="mt-3 flex items-center gap-4 rounded-2xl bg-oh-charcoal px-4 py-3 ring-1 ring-inset ring-oh-stone">
                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="text-xs text-oh-mute">{t("total")}</span>
                      <span className="text-lg font-semibold tabular-nums text-oh-cream">{formatCents(paidTotal, locale)}</span>
                    </div>
                    <button type="button" data-pay-addons onClick={payAddons} disabled={busy !== null} className={`${PRIMARY} flex-1`}>
                      {busy === "paid" ? <Spinner /> : null}
                      {t("pay", { amount: formatCents(paidTotal, locale) })}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
        {error ? (
          <p role="alert" className="m-0 mt-4 flex items-start gap-2 rounded-2xl bg-oh-ember-deep/25 px-3.5 py-2.5 text-[15px] text-oh-cream">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function SectionHead({ id, title, badge }: { id: string; title: string; badge?: string }) {
  const locale = useLocale();
  return (
    <div className="flex items-center gap-2.5">
      <h3 id={id} className="m-0 text-lg font-semibold text-oh-cream">
        {title}
      </h3>
      {badge ? (
        <Eyebrow locale={locale} className="rounded-full bg-oh-olive-light/20 px-2.5 py-1 text-oh-olive-light">
          {badge}
        </Eyebrow>
      ) : null}
    </div>
  );
}
