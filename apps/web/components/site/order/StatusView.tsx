"use client";

/**
 * The order status page (Task D6), rebuilt from the legacy 3,163-line page:
 * the stage headline and progress, the pod (PodCard, with call staff, add to
 * my order and dessert), the live kitchen feed, "I'm done eating", the
 * visit's timeline (PHONE_STAGES), the lines to open while the bowl cooks,
 * the bowl itself, and the way back to the account or another order.
 *
 * THE PLAN DEMO CONTRACT (binding; the business plan's PhoneFrame embeds
 * `/{locale}/order/status?orderQrCode=DEMO-PLAN.<STAGE>&embed=1&demoSync=parent`):
 *   - `embed`: no shell, dock, top bar or Chappy (the SiteShell embed branch
 *     keeps only the wrapper); this page also drops its "Ask Chappy" and the
 *     sign-up prompt, and hides the scrollbar a real phone doesn't have;
 *   - DEMO- codes render the API's synthetic order; the stage follows
 *     `{ type: "oh-status-demo", stage }` from the parent (useOrderStatus);
 *   - the AI routes are still called, in the page's language (AiLines);
 *   - pod 32 comes from the demo data, untouched here.
 * Pinned by tests/e2e/site/after-order.spec.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSiteAuth } from "@/lib/site/auth";
import { Display, Eyebrow, Title } from "@/components/site/Text";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { useOptionalChappy } from "@/components/site/chappy/ChappyLauncher";
import { useSiteApi, useMemberId, SITE_API_URL } from "@/lib/site/api";
import { groupIdentityHeaders } from "@/lib/site/orders";
import { useGuest } from "@/contexts/guest-context";
import { BACKSTORY_STAGES, FEED_STAGES, SERVICE_STAGES, podLabelOf, podMoved, progress, stageIndex } from "@/lib/site/order-status";
import { useOrderStatus, usePendingOrderLink, TENANT, type StatusOrder } from "./useOrderStatus";
import { StatusTimeline } from "./StatusTimeline";
import { ActionButton, PodCard, PRIMARY, SECONDARY, type ActionState } from "./PodCard";
import { BackstoryLine, FortuneLine, KitchenFeed, RedStepLine, RoastLine } from "./AiLines";
import dynamic from "next/dynamic";

// Task G2b: the add-on sheet (and the menu model it builds from) loads when
// the guest first taps "Add items", not with the status page.
const AddOnSheet = dynamic(() => import("./AddOnSheet").then((m) => m.AddOnSheet), { ssr: false });
// The join prompt shows only to a signed-out guest once the page has settled.
const JoinPrompt = dynamic(() => import("./JoinPrompt").then((m) => m.JoinPrompt), { ssr: false });
import { Spinner } from "./StepSheet";
import "./after-order.css";

const STAGE_ICON: Record<string, IconName> = {
  PENDING_PAYMENT: "wallet",
  PAID: "check",
  QUEUED: "clock",
  PREPPING: "flame",
  READY: "bell",
  SERVING: "bowl",
  COMPLETED: "seal",
  CANCELLED: "alert",
};
const KNOWN = new Set(Object.keys(STAGE_ICON));

export interface StatusViewProps {
  code: string | null;
  embedded: boolean;
  followParent: boolean;
  demoStage: string | null;
  podFrom: string | null;
  podNone: boolean;
}

export function StatusView({ code, embedded, followParent, demoStage: demoStageParam, podFrom, podNone }: StatusViewProps) {
  const t = useTranslations("afterOrder");
  const locale = useLocale();
  const router = useRouter();
  const api = useSiteApi();
  const { guest } = useGuest();
  const { isLoaded, isSignedIn, email: authEmail, name: authName, firstName: authFirstName } = useSiteAuth();
  const member = useMemberId();
  const chappy = useOptionalChappy();
  const s = useOrderStatus({ code, demoStageParam, followParent, locale });
  const order = s.order;

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);
  useEffect(() => () => void (noticeTimer.current && clearTimeout(noticeTimer.current)), []);

  const [staff, setStaff] = useState<ActionState>("idle");
  const [dessert, setDessert] = useState<ActionState>("idle");
  const [addOns, setAddOns] = useState(false);
  // Mounted on first open and kept, so the sheet's close animation plays.
  const [addOnsMounted, setAddOnsMounted] = useState(false);
  useEffect(() => {
    if (addOns) setAddOnsMounted(true);
  }, [addOns]);
  const [confirmDone, setConfirmDone] = useState(false);
  const [doneBusy, setDoneBusy] = useState(false);

  usePendingOrderLink({
    orderQrCode: order?.orderQrCode ?? null,
    signedIn: Boolean(isSignedIn),
    email: authEmail ?? null,
    name: authName || null,
    onLinked: useCallback(() => say(t("status.join.linked")), [say, t]),
  });

  const identity = groupIdentityHeaders(guest);
  // Fix round 1: pod services need the owner or the order's own code; this page was opened with it (the status link carries it).
  const proof: Record<string, string> = { ...identity, ...(order?.orderQrCode ? { "x-order-code": order.orderQrCode } : {}) };
  async function post(path: string, body: unknown = {}): Promise<Response | null> {
    if (!order) return null;
    return api(`${SITE_API_URL}/orders/${encodeURIComponent(order.id)}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...TENANT, ...proof },
      body: JSON.stringify(body),
    }).catch(() => null);
  }

  async function callStaff() {
    if (staff !== "idle") return;
    setStaff("busy");
    const res = await post("call-staff", { reason: "GENERAL" });
    if (res?.ok) {
      setStaff("done");
      say(t("status.pod.staffComing"));
      setTimeout(() => setStaff("idle"), 5000);
    } else {
      setStaff("idle");
      say(t("status.pod.callFailed"));
    }
  }

  async function readyForDessert() {
    if (dessert !== "idle") return;
    setDessert("busy");
    const res = await post("dessert-ready");
    if (res?.ok) {
      setDessert("done");
      say(t("status.pod.dessertComing"));
    } else {
      setDessert("idle");
      say(t("status.pod.dessertFailed"));
    }
  }

  async function finishVisit() {
    if (!order || doneBusy) return;
    setDoneBusy(true);
    // The owner's own call (D5 fix round 2): the Clerk session, or the guest session for a guest order. SERVING -> COMPLETED only.
    const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(order.id)}/done`, { method: "POST", headers: { ...TENANT, ...identity } }).catch(() => null);
    setDoneBusy(false);
    if (!res || (!res.ok && res.status !== 409)) {
      say(t("status.done.failed"));
      return;
    }
    setConfirmDone(false);
    if (s.isDemo) s.setDemoStage("COMPLETED");
    void s.refresh();
  }

  function atPod() {
    if (!order) return;
    if (s.isDemo) s.setDemoStage("QUEUED");
    else router.push(`/${locale}/order/scan?orderQrCode=${encodeURIComponent(order.orderQrCode)}`);
  }

  const embedStyle = embedded ? <style>{"html{scrollbar-width:none}html::-webkit-scrollbar{display:none}"}</style> : null;

  /* ------------------------------------------------------------ empty and error states */
  if (!code || s.state === "missing" || s.state === "error" || (s.state === "loading" && !order)) {
    const loading = s.state === "loading" && Boolean(code);
    return (
      <div data-status-page data-status-stage={loading ? "LOADING" : "NONE"} className={`mx-auto flex w-full max-w-xl flex-col px-4 ${embedded ? "pt-10" : "pt-8"} pb-12`}>
        {embedStyle}
        {loading ? (
          <div role="status" className="flex min-h-[60svh] flex-col items-center justify-center gap-4 text-oh-mute">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-oh-ink text-oh-ember-light">
              <Icon name="bowl" size={30} />
            </span>
            <span className="flex items-center gap-2.5 text-[15px]">
              <Spinner />
              {t("common.loading")}
            </span>
          </div>
        ) : (
          <div className="flex min-h-[50svh] flex-col items-start justify-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-oh-ink text-oh-ember-light">
              <Icon name={s.state === "error" ? "alert" : "bowl"} size={26} />
            </span>
            <Title locale={locale} as="h1" className="m-0 text-oh-cream">
              {!code ? t("status.noCode.title") : s.state === "error" ? t("common.error") : t("common.notFound")}
            </Title>
            <p className="m-0 max-w-prose text-base leading-relaxed text-oh-mute">{!code ? t("status.noCode.lede") : s.state === "error" ? t("common.errorLede") : t("common.notFoundLede")}</p>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              {s.state === "error" ? (
                <button type="button" onClick={() => void s.refresh()} className={SECONDARY}>
                  {t("common.retry")}
                </button>
              ) : null}
              <Link href={`/${locale}/order`} className={PRIMARY}>
                {t("common.newOrder")}
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------ the order */
  const o = order as StatusOrder;
  const status = o.status;
  const known = KNOWN.has(status) ? status : "UNKNOWN";
  const timeZone = o.location?.timezone || "America/Denver";
  const pod = podLabelOf(o);
  const moved = podMoved(podFrom, pod);
  const idx = stageIndex(status);
  const checkedIn = Boolean(o.podConfirmedAt);
  const hasDessert = o.items.some((i) => i.categoryType === "DESSERT");
  const signedOut = isLoaded && !isSignedIn;
  const number = o.kitchenOrderNumber || o.orderNumber;
  const firstName = authFirstName || o.guestName?.split(" ")[0] || t("status.friend");
  const orderAgainHref = !s.isDemo && member.signedIn ? `/${locale}/order?reorder=${encodeURIComponent(o.id)}` : `/${locale}/order`;
  const bowl = o.items.filter((i) => i.categoryType !== "SLIDER");
  const choices = o.items.filter((i) => i.categoryType === "SLIDER" && (i.selectedLabel || i.selectedValue));

  return (
    <div
      data-status-page
      data-status-stage={status}
      data-demo={s.isDemo ? "true" : "false"}
      className={`mx-auto w-full max-w-xl px-4 pb-[calc(var(--dock-h,0px)+2.5rem)] md:max-w-6xl md:px-8 ${embedded ? "pt-9" : "pt-4 md:pt-10"}`}
    >
      {embedStyle}
      {s.isDemo ? (
        <p role="note" className="m-0 mb-4 inline-flex items-center gap-2 rounded-full bg-oh-ink px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-oh-gold ring-1 ring-oh-stone">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-oh-gold" />
          {t("common.demo")}
        </p>
      ) : null}

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-10">
        {/* ------------------------------------------------ left: now */}
        <div className="flex flex-col gap-4 md:sticky md:top-24">
          <section data-status-section aria-labelledby="status-title" className="pt-1">
            <div key={status} className="flex items-start gap-4">
              <span aria-hidden="true" className="oh-mark-in relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-oh-ember-deep text-oh-cream shadow-[0_18px_40px_-18px] shadow-oh-ember-deep">
                <Icon name={STAGE_ICON[status] || "bowl"} size={32} />
              </span>
              <div className="oh-stage-in min-w-0 flex-1">
                <Eyebrow locale={locale} as="p" className="m-0 text-oh-mute">
                  <span data-order-number>{t("common.orderNumber", { number })}</span>
                  {o.location?.name ? (
                    <>
                      <span aria-hidden="true" className="px-1.5 text-oh-stone">
                        /
                      </span>
                      <span className="normal-case tracking-normal">{o.location.name}</span>
                    </>
                  ) : null}
                </Eyebrow>
                <Display id="status-title" locale={locale} className="m-0 mt-1.5 !text-[clamp(2.1rem,8vw,3.25rem)] text-oh-cream">
                  {t(`status.stages.${known}.title`)}
                </Display>
              </div>
            </div>
            <p className="oh-stage-in m-0 mt-3 max-w-prose text-base leading-relaxed text-oh-mute">{t(`status.stages.${known}.lede`)}</p>
            {idx >= 0 ? (
              <div className="mt-4">
                <div
                  role="progressbar"
                  aria-label={t("status.progressLabel")}
                  aria-valuemin={1}
                  aria-valuemax={6}
                  aria-valuenow={idx + 1}
                  aria-valuetext={t("status.progress", { current: idx + 1, total: 6 })}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-oh-stone"
                  style={{ ["--p" as string]: String(progress(status)) }}
                >
                  <div className="oh-progress h-full w-[calc(var(--p)*100%)] rounded-full bg-oh-ember-light" />
                </div>
              </div>
            ) : null}
          </section>

          {moved || podNone ? (
            <div data-pod-moved role="status" className="flex items-start gap-3 rounded-2xl bg-oh-gold/15 px-4 py-3 text-[15px] leading-relaxed text-oh-cream ring-1 ring-inset ring-oh-gold/40">
              <Icon name="pod" size={20} className="mt-0.5 shrink-0 text-oh-gold" />
              <span className="min-w-0">
                {moved ? (
                  <>
                    <strong className="font-semibold">{t("common.podMoved", { to: moved.to })}</strong> {t("common.podMovedLede", { from: moved.from })}
                  </>
                ) : (
                  t("common.podNone")
                )}
              </span>
            </div>
          ) : null}

          {pod ? (
            <PodCard
              label={pod}
              note={
                checkedIn ? (
                  <span className="inline-flex items-center gap-1.5 text-oh-olive-light">
                    <Icon name="check" size={18} />
                    {t("status.pod.checkedIn")}
                  </span>
                ) : idx >= 0 && idx < 5 ? (
                  t("status.pod.goTo")
                ) : null
              }
            >
              {!checkedIn && idx >= 0 && idx < 5 ? (
                <button type="button" data-at-pod onClick={atPod} className={PRIMARY}>
                  <Icon name="pod" size={20} />
                  {t("status.pod.confirm")}
                </button>
              ) : checkedIn && SERVICE_STAGES.includes(status) ? (
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  <ActionButton icon="bell" dataAttr="data-call-staff" label={t("status.pod.callStaff")} busyLabel={t("status.pod.calling")} doneLabel={t("status.pod.staffCalled")} state={staff} onClick={callStaff} />
                  <ActionButton icon="plus" dataAttr="data-add-items" label={t("status.pod.addItems")} onClick={() => setAddOns(true)} />
                  {status === "SERVING" && hasDessert ? (
                    <div className="min-[380px]:col-span-2">
                      <ActionButton icon="gift" dataAttr="data-dessert" label={t("status.pod.dessert")} busyLabel={t("status.pod.dessertSending")} doneLabel={t("status.pod.dessertCalled")} state={dessert} onClick={readyForDessert} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </PodCard>
          ) : o.queuePosition ? (
            <section data-status-section aria-labelledby="queue-title" className="rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
              <Eyebrow locale={locale} className="text-oh-mute">
                {t("status.queue.title")}
              </Eyebrow>
              <p id="queue-title" className="m-0 mt-1 font-display text-[2.25rem] leading-none text-oh-cream">
                {t("status.queue.position", { position: o.queuePosition })}
              </p>
              {o.estimatedWaitMinutes ? <p className="m-0 mt-2 text-[15px] text-oh-mute">{t("status.queue.wait", { minutes: o.estimatedWaitMinutes })}</p> : null}
              <p className="m-0 mt-2 text-[15px] text-oh-mute">{t("status.queue.note")}</p>
            </section>
          ) : null}

          {FEED_STAGES.includes(status) ? <KitchenFeed feed={s.feed} loading={s.feedLoading} /> : null}

          {status === "SERVING" ? (
            <section data-status-section aria-label={t("status.done.cta")} className="rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
              {!confirmDone ? (
                <button type="button" data-done-eating onClick={() => setConfirmDone(true)} className={PRIMARY}>
                  <Icon name="check" size={20} />
                  {t("status.done.cta")}
                </button>
              ) : (
                <div role="group" aria-labelledby="done-prompt">
                  <p id="done-prompt" className="m-0 text-[15px] leading-relaxed text-oh-cream">
                    {t("status.done.prompt")}
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                    <button type="button" data-done-confirm onClick={finishVisit} disabled={doneBusy} className={PRIMARY}>
                      {doneBusy ? <Spinner /> : null}
                      {t("status.done.confirm")}
                    </button>
                    <button type="button" onClick={() => setConfirmDone(false)} className={SECONDARY}>
                      {t("status.done.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>

        {/* ------------------------------------------------ right: the visit */}
        <div className="mt-4 flex flex-col gap-4 md:mt-0">
          <section data-status-section aria-labelledby="visit-title" className="rounded-[1.75rem] bg-oh-ink px-5 pb-3 pt-5 ring-1 ring-oh-stone">
            <h2 id="visit-title" className={`m-0 mb-4 text-lg font-semibold text-oh-cream ${locale.startsWith("zh") ? "font-cjk" : "font-body"}`}>
              {t("status.timeline.label")}
            </h2>
            <StatusTimeline status={status} times={o} timeZone={timeZone} />
          </section>

          {signedOut && !embedded ? <JoinPrompt orderId={o.id} orderQrCode={o.orderQrCode} orderNumber={number} returnTo={`/${locale}/order/status?orderQrCode=${encodeURIComponent(o.orderQrCode)}`} /> : null}

          {checkedIn ? (
            <>
              <FortuneLine orderQrCode={o.orderQrCode} />
              <RoastLine orderQrCode={o.orderQrCode} />
              {BACKSTORY_STAGES.includes(status) ? <BackstoryLine orderId={o.id} /> : null}
              <RedStepLine name={firstName} />
            </>
          ) : null}

          {bowl.length ? (
            <section data-status-section aria-labelledby="bowl-title" className="rounded-[1.75rem] bg-oh-linen px-5 py-5 text-oh-charcoal">
              <h2 id="bowl-title" className={`m-0 text-lg font-semibold ${locale.startsWith("zh") ? "font-cjk" : "font-body"}`}>
                {t("status.bowl.title")}
              </h2>
              <ul className="m-0 mt-3 list-none divide-y divide-oh-charcoal/10 p-0">
                {bowl.map((i) => (
                  <li key={i.id} className="flex items-baseline justify-between gap-3 py-2 text-[15px]">
                    <span className="min-w-0">{i.name}</span>
                    {i.quantity > 1 ? <span className="shrink-0 tabular-nums text-oh-charcoal/70">{t("common.qty", { count: i.quantity })}</span> : null}
                  </li>
                ))}
              </ul>
              {choices.length ? (
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                  {choices.map((i) => (
                    <li key={i.id} className="rounded-full bg-oh-charcoal/[0.07] px-3 py-1 text-sm text-oh-charcoal/85">
                      {i.name} {i.selectedLabel || i.selectedValue}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <nav aria-label={t("status.links.label")} className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <Link href={orderAgainHref} data-order-again className={SECONDARY}>
              <Icon name="bowl" size={20} />
              {t("status.links.orderAgain")}
            </Link>
            <Link href={`/${locale}/member`} className={SECONDARY}>
              <Icon name="user" size={20} />
              {t("status.links.account")}
            </Link>
          </nav>

          {chappy && !embedded ? (
            <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-sm text-oh-mute">
              <span>{t("common.needHelp")}</span>
              <button
                type="button"
                data-ask-chappy
                onClick={() => chappy.openChappy()}
                className="inline-flex min-h-11 cursor-pointer appearance-none items-center border-0 bg-transparent p-0 font-[inherit] text-sm font-semibold text-oh-cream underline decoration-oh-ember-light decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
              >
                {t("common.askChappy")}
              </button>
            </p>
          ) : null}
          <p className="m-0 text-sm text-oh-mute">{t("status.autoRefresh")}</p>
        </div>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--dock-h,0px)+1rem)] z-40 flex justify-center px-4">
        {notice ? (
          <p data-status-notice className="pointer-events-auto m-0 flex max-w-md items-center gap-2.5 rounded-2xl bg-oh-cream px-4 py-3 text-[15px] font-medium text-oh-charcoal shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)]">
            <Icon name="check" size={18} className="shrink-0 text-oh-ember-deep" />
            {notice}
          </p>
        ) : null}
      </div>

      {order && addOnsMounted ? (
        <AddOnSheet
          open={addOns}
          onClose={() => setAddOns(false)}
          orderId={order.id}
          api={api}
          headers={proof}
          onNotice={say}
          onCallStaff={() => {
            setAddOns(false);
            void callStaff();
          }}
        />
      ) : null}
    </div>
  );
}
