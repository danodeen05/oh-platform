"use client";

/**
 * Task D11: the group lobby (replaces the legacy group-lobby.tsx).
 *
 * - Identity: a member is the verified Clerk session (useMemberId, GET
 *   /users/me); a guest proves themself with their server-issued guest
 *   session token (x-guest-session). Host actions are checked by the API.
 * - Names are shown exactly as the API returns them (A8b: "First L." for
 *   everyone but yourself); an order with no name reads "Host" or "Guest".
 * - The group polls every 5 s (G3b pacing); seats come from useSeats.
 * - Pods: everyone sees the live CombMap; the host of a host-pays group
 *   that is closed and arriving now picks a pod per member (GroupPodPicker).
 *   The picks ride to the group payment page in its URL; the API claims
 *   them race-safe after the verified payment (A7 batch confirm).
 * - Every string is translated (groupLobby, combMap); the location and menu
 *   item names come back localized from the API (?locale=).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInTrigger } from "@/components/site/auth/AuthTriggers";
import { useSiteAuth } from "@/lib/site/auth";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CombMap, type CombMapLabels } from "@/components/site/floor-plan/CombMap";
import { useSeats } from "@/components/site/floor-plan/useSeats";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { LazySheet as Sheet } from "@/components/site/motion/LazySheet";
import { formatMoney } from "@/components/site/rewards/format";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { useGuest } from "@/contexts/guest-context";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import {
  amountDue,
  arrivesSoon,
  countdown,
  displayValue,
  encodePods,
  groupTotal,
  isBowlItem,
  liveOrders,
  memberName,
  type Group,
  type GroupMemberOrder,
  type Picks,
} from "@/lib/site/group";
import { localizedHref } from "@/lib/site/nav";
import { groupIdentityHeaders } from "@/lib/site/orders";
import { GroupPodPicker } from "./GroupPodPicker";

const MAX_MEMBERS = 8;
const POLL_MS = 5000;

const primary =
  "inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline shadow-[0_10px_30px_-12px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-wait disabled:opacity-70";
const quiet =
  "inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-default disabled:opacity-60";
const panel = "rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-5 md:p-7";

type Confirm = null | "close" | "cancel" | "remove";

export function GroupLobby({ initialGroup }: { initialGroup: Group }) {
  const t = useTranslations("groupLobby");
  const tAll = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const api = useSiteApi();
  const { isLoaded: clerkLoaded } = useSiteAuth();
  const member = useMemberId();
  const { guest, isGuest, startGuestSession, isLoading: guestLoading } = useGuest();
  const [group, setGroup] = useState<Group>(initialGroup);
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [now, setNow] = useState<number | null>(null);
  const [pick, setPick] = useState<{ picks: Picks; active: string | null }>({ picks: {}, active: null });
  const money = useCallback((cents: number) => formatMoney(cents, locale), [locale]);
  const href = useCallback((p: string) => localizedHref(locale, p), [locale]);

  const userId = member.userId;
  const identity = groupIdentityHeaders(userId ? null : isGuest ? guest : null);
  const isHost = Boolean((userId && userId === group.hostUserId) || (isGuest && guest?.id && guest.id === group.hostGuestId));
  const orders = useMemo(() => liveOrders(group), [group]);
  const myOrder = userId ? orders.find((o) => o.userId === userId) : isGuest && guest?.id ? orders.find((o) => o.guestId === guest.id && !o.userId) : undefined;
  const credentialsReady = Boolean(userId || (isGuest && guest?.id));
  const loadingCredentials = !clerkLoaded || !member.ready || guestLoading;

  // Poll the group (the lobby is live while people add their bowls).
  const refresh = useCallback(async () => {
    try {
      const res = await api(`${SITE_API_URL}/group-orders/${encodeURIComponent(group.code)}?locale=${encodeURIComponent(locale)}`, { headers: { "x-tenant-slug": "oh", ...identity } });
      if (res.ok) setGroup((await res.json()) as Group);
    } catch {
      /* keep the last good copy */
    }
    // identity is derived from guest/userId, both in deps through `api` and the token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, group.code, locale, guest?.sessionToken, userId]);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Countdown, client only (no hydration mismatch).
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsLeft = now === null ? null : Math.max(0, Math.floor((new Date(group.expiresAt).getTime() - now) / 1000));

  const seatsApi = useSeats(group.locationId, { refreshMs: 10_000, apiBase: SITE_API_URL });
  const soon = arrivesSoon(group.estimatedArrival, now ?? Date.now());
  const allPaid = orders.length > 0 && orders.every((o) => o.paymentStatus === "PAID");
  const canPick = isHost && group.paymentMethod === "HOST_PAYS_ALL" && (group.status === "CLOSED" || group.status === "PAYING") && orders.length > 0 && soon && !allPaid;

  const nameOf = useCallback(
    (o: GroupMemberOrder) => memberName(o) ?? (o.isGroupHost ? t("members.host") : t("members.guest")),
    [t],
  );

  async function act(fn: () => Promise<Response>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(t("errors.action"));
      else {
        await refresh();
        after?.();
      }
    } catch {
      setError(t("errors.action"));
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, string>) =>
    api(`${SITE_API_URL}/group-orders/${encodeURIComponent(group.code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-tenant-slug": "oh", ...identity },
      body: JSON.stringify(body),
    });

  async function join() {
    if (!credentialsReady) {
      setError(t("errors.signInFirst"));
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await api(`${SITE_API_URL}/group-orders/${encodeURIComponent(group.code)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": "oh", ...identity },
        // The member comes from the session; a guest id is only the guest checkout row.
        body: JSON.stringify({ guestId: userId ? null : guest?.id ?? null }),
      });
      if (!res.ok) {
        setError(t("errors.join"));
        setJoining(false);
        return;
      }
      router.push(href(`/order/location/${group.locationId}?groupCode=${group.code}`));
    } catch {
      setError(t("errors.join"));
      setJoining(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}${href(`/group/${group.code}`)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("hero.shareTitle"), text: t("hero.shareText", { code: group.code }), url });
        return;
      }
    } catch {
      /* dismissed: fall back to copying */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const due = amountDue(orders);
  const payHref = href(`/order/group-payment?groupCode=${group.code}${Object.keys(pick.picks).length ? `&pods=${encodeURIComponent(encodePods(pick.picks))}` : ""}`);
  const podLabels = orders.map((o) => o.seat?.label ?? o.seat?.number ?? null).filter(Boolean) as string[];
  const statusTone = group.status === "CANCELLED" ? "bg-oh-ember-deep/30 text-oh-ember-light" : group.status === "PAID" ? "bg-oh-olive/30 text-oh-olive-light" : "bg-oh-gold/15 text-oh-gold";

  return (
    <div data-group-lobby className="overflow-x-clip pb-16">
      {/* Hero: the code, the place, the clock. */}
      <section aria-labelledby="group-title" className="border-b border-oh-stone/70 px-5 pb-10 pt-14 md:px-8 md:pb-14 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <Reveal from="fade">
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("hero.eyebrow")}
            </Eyebrow>
            <Display id="group-title" locale={locale} className="m-0 mt-3 max-w-3xl text-oh-cream">
              {t("hero.title", { location: group.location.name })}
            </Display>
            <Body locale={locale} className="m-0 mt-3 text-oh-cream/70">
              {group.location.address}
            </Body>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="flex min-h-14 items-center gap-4 rounded-2xl border border-oh-stone bg-oh-ink px-5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("hero.codeLabel")}</span>
                <span data-literal className="font-mono text-2xl font-semibold tracking-[0.2em] text-oh-cream">
                  {group.code}
                </span>
              </div>
              <button type="button" onClick={share} className={quiet} data-group-share>
                <Icon name={copied ? "check" : "share"} size={18} />
                {copied ? t("hero.copied") : t("hero.share")}
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-base">
              <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-sm font-semibold ${statusTone}`}>{t(`status.${group.status}`)}</span>
              {group.status === "GATHERING" && secondsLeft !== null ? (
                <span className="inline-flex items-center gap-2 text-oh-cream/75" aria-live="off">
                  <Icon name="clock" size={16} />
                  {secondsLeft > 0 ? t("hero.closesIn", { time: countdown(secondsLeft) }) : t("hero.closed")}
                </span>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      {/*
        Fix round 1: at desktop width the actions and the table sit side by
        side, and the pods get the full content width below them (the same
        sizing as the order flow's pod step), so picking works on a wide screen.
      */}
      <div className="mx-auto grid max-w-6xl gap-8 px-5 pt-10 md:grid-cols-2 md:gap-10 md:px-8">
        {/* What you can do now. */}
        <div className="grid min-w-0 content-start gap-6">
          {error ? (
            <p role="alert" className="m-0 flex items-start gap-2 rounded-2xl border border-oh-ember-light/40 bg-oh-ember-deep/15 px-4 py-3 text-base text-oh-cream">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
              {error}
            </p>
          ) : null}

          {!myOrder && !isHost && group.status === "GATHERING" ? (
            <ActionCard title={t("join.title")} body={t("join.body")}>
              {loadingCredentials ? (
                <button type="button" disabled className={primary}>
                  {t("join.loading")}
                </button>
              ) : credentialsReady ? (
                <button type="button" onClick={join} disabled={joining} className={primary} data-group-join>
                  {joining ? t("join.joining") : t("join.cta")}
                  {joining ? null : <Icon name="arrow" size={18} />}
                </button>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <SignInTrigger>
                    <button type="button" className={primary}>
                      {t("join.signIn")}
                    </button>
                  </SignInTrigger>
                  <button type="button" className={quiet} onClick={() => void startGuestSession()}>
                    {t("join.guest")}
                  </button>
                </div>
              )}
            </ActionCard>
          ) : null}

          {isHost && !myOrder && group.status === "GATHERING" ? (
            <ActionCard title={t("host.title")} body={t("host.body")}>
              <Link href={href(`/order/location/${group.locationId}?groupCode=${group.code}`)} className={primary}>
                {t("host.cta")}
                <Icon name="arrow" size={18} />
              </Link>
            </ActionCard>
          ) : null}

          {myOrder ? (
            <section aria-labelledby="group-mine" className={panel}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id="group-mine" className="m-0 text-xl font-semibold text-oh-cream">
                    {t("mine.title")}
                  </h2>
                  {myOrder.orderNumber ? <p className="m-0 mt-1 text-sm text-oh-mute">{t("mine.number", { number: myOrder.orderNumber })}</p> : null}
                </div>
                <p className="m-0 shrink-0 text-xl font-semibold tabular-nums text-oh-cream">{money(myOrder.totalCents)}</p>
              </div>
              {myOrder.paymentStatus === "PAID" ? (
                <p className="m-0 mt-4 inline-flex items-center gap-2 text-base text-oh-olive-light">
                  <Icon name="check" size={18} />
                  {group.paymentMethod === "PAY_YOUR_OWN" && !allPaid ? t("mine.waiting") : t("mine.paid")}
                </p>
              ) : group.status === "GATHERING" || group.status === "CLOSED" ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={href(`/order/location/${group.locationId}?groupCode=${group.code}&edit=${myOrder.id}`)} className={quiet}>
                    {t("mine.edit")}
                  </Link>
                  <button type="button" className={quiet} onClick={() => setConfirm("remove")}>
                    {t("mine.remove")}
                  </button>
                </div>
              ) : null}

              {group.status === "CLOSED" && group.paymentMethod === "PAY_YOUR_OWN" && myOrder.paymentStatus !== "PAID" ? (
                <div className="mt-5 border-t border-oh-stone/70 pt-5">
                  <p className="m-0 text-lg font-semibold text-oh-cream">{t("mine.payTitle")}</p>
                  <p className="m-0 mt-1 text-base text-oh-cream/75">{t("mine.payBody")}</p>
                  <Link
                    href={href(`/order/payment?orderId=${myOrder.id}&orderNumber=${myOrder.orderNumber ?? ""}&total=${myOrder.totalCents}`)}
                    className={`${primary} mt-4`}
                    data-group-pay-own
                  >
                    {t("mine.pay", { amount: money(myOrder.amountDueCents ?? myOrder.totalCents) })}
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}

          {isHost && (group.status === "GATHERING" || group.status === "CLOSED") ? (
            <section aria-labelledby="group-controls" className={panel}>
              <h2 id="group-controls" className="m-0 text-xl font-semibold text-oh-cream">
                {t("controls.title")}
              </h2>
              <p id="group-who-pays" className="m-0 mt-4 text-sm font-semibold text-oh-cream/80">
                {t("controls.whoPays")}
              </p>
              <div role="radiogroup" aria-labelledby="group-who-pays" className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["HOST_PAYS_ALL", "PAY_YOUR_OWN"] as const).map((m) => {
                  const on = group.paymentMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={busy}
                      onClick={() => void act(() => patch({ paymentMethod: m }))}
                      className={`flex min-h-12 cursor-pointer appearance-none items-center gap-3 rounded-2xl border px-4 text-left font-[inherit] text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream ${
                        on ? "border-oh-ember-light bg-oh-ember-deep/20 text-oh-cream" : "border-oh-stone bg-transparent text-oh-cream/80 hover:border-oh-cream/40"
                      }`}
                    >
                      <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-oh-ember-light" : "border-oh-mute"}`}>
                        {on ? <span className="h-2.5 w-2.5 rounded-full bg-oh-ember-light" /> : null}
                      </span>
                      {m === "HOST_PAYS_ALL" ? t("controls.hostPays") : t("controls.eachPays")}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {group.status === "GATHERING" ? (
                  <button type="button" className={quiet} disabled={busy} onClick={() => setConfirm("close")} data-group-close>
                    {t("controls.close")}
                  </button>
                ) : null}
                <button type="button" className={`${quiet} border-oh-ember-light/50 text-oh-ember-light hover:border-oh-ember-light`} disabled={busy} onClick={() => setConfirm("cancel")}>
                  {t("controls.cancel")}
                </button>
              </div>
            </section>
          ) : null}

        </div>

        {/* The table: every order, its person and its state. */}
        <div className="grid min-w-0 content-start gap-6">
          <section aria-labelledby="group-members" className={panel}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="group-members" className="m-0 text-xl font-semibold text-oh-cream">
                {t("members.title")}
              </h2>
              <p className="m-0 text-sm text-oh-mute">
                {t("members.count", { count: orders.length })} · {t("members.max", { max: MAX_MEMBERS })}
              </p>
            </div>
            {group.paymentMethod ? <p className="m-0 mt-2 text-base text-oh-cream/70">{group.paymentMethod === "HOST_PAYS_ALL" ? t("members.hostPaying") : t("members.eachPaying")}</p> : null}
            {orders.length === 0 ? (
              <p className="m-0 mt-6 text-base text-oh-cream/70">{t("members.empty")}</p>
            ) : (
              <ul className="m-0 mt-5 grid list-none gap-2 p-0">
                {orders.map((o) => (
                  <MemberRow key={o.id} order={o} name={nameOf(o)} money={money} hostPays={group.paymentMethod === "HOST_PAYS_ALL"} />
                ))}
              </ul>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-oh-stone/70 pt-4">
              <span className="text-base font-semibold text-oh-cream/85">{t("members.total")}</span>
              <span className="text-xl font-semibold tabular-nums text-oh-cream">{money(groupTotal(orders))}</span>
            </div>
          </section>
        </div>

        {/* The pods, full width. */}
        <div className="min-w-0 md:col-span-2">
          {allPaid ? (
            <DonePanel group={group} podLabels={podLabels} soon={soon} myOrder={myOrder} />
          ) : group.status !== "CANCELLED" ? (
            <section aria-labelledby="group-pods" data-group-map className={panel}>
              <Eyebrow locale={locale} className="text-oh-ember-light">
                {t("pods.eyebrow")}
              </Eyebrow>
              <h2 id="group-pods" className={`m-0 mt-2 text-[1.6rem] font-normal leading-tight text-oh-cream ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>
                {canPick ? t("pods.pickTitle") : t("pods.title")}
              </h2>
              <p className="m-0 mt-2 text-base text-oh-cream/75">{canPick ? t("pods.pickBody") : soon ? t("pods.live") : t("pods.later")}</p>
              <div className="mt-5">
                {seatsApi.status === "error" ? (
                  <p className="m-0 flex items-start gap-2 text-base text-oh-cream/75">
                    <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
                    {t("pods.error")}
                  </p>
                ) : !seatsApi.layoutKey ? (
                  <p role="status" className="m-0 flex min-h-40 items-center justify-center rounded-2xl bg-oh-charcoal text-base text-oh-mute">
                    {t("pods.loading")}
                  </p>
                ) : canPick ? (
                  <GroupPodPicker
                    layoutKey={seatsApi.layoutKey}
                    seats={seatsApi.seats}
                    members={orders.map((o) => ({ orderId: o.id, name: nameOf(o) }))}
                    picks={pick.picks}
                    active={pick.active}
                    onChange={setPick}
                  />
                ) : (
                  <>
                    <CombMap layoutKey={seatsApi.layoutKey} mode="live" tone="night" labels={tAll.raw("combMap") as CombMapLabels} seats={seatsApi.seats} className="mx-auto max-w-3xl" />
                    <p className="m-0 mt-3 text-sm text-oh-mute">
                      {t("pods.free", { free: seatsApi.seats.filter((s) => s.status === "AVAILABLE").length, total: seatsApi.seats.length })}
                    </p>
                  </>
                )}
              </div>
              {isHost && group.paymentMethod === "HOST_PAYS_ALL" && (group.status === "CLOSED" || group.status === "PAYING") && orders.length > 0 ? (
                <div className="mt-6 border-t border-oh-stone/70 pt-5">
                  <Link href={payHref} className={`${primary} w-full md:ml-auto md:flex md:w-fit md:min-w-80`} data-group-pay>
                    {t("pay.cta", { amount: money(due) })}
                    <Icon name="arrow" size={18} />
                  </Link>
                  <p className="m-0 mt-2 text-center text-sm text-oh-mute md:text-right">{t("pay.note")}</p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <ConfirmSheet
        open={confirm !== null}
        title={confirm === "close" ? t("controls.closeTitle") : confirm === "cancel" ? t("controls.cancelTitle") : t("controls.removeTitle")}
        body={confirm === "close" ? t("controls.closeBody") : confirm === "cancel" ? t("controls.cancelBody") : t("controls.removeBody")}
        confirmLabel={t("controls.confirm")}
        keepLabel={t("controls.keep")}
        danger={confirm === "cancel" || confirm === "remove"}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          if (which === "close") void act(() => patch({ status: "CLOSED" }), () => setConfirm(null));
          else if (which === "cancel") void act(() => patch({ status: "CANCELLED" }), () => router.push(href("/order")));
          else if (which === "remove" && myOrder)
            void act(
              () => api(`${SITE_API_URL}/group-orders/${encodeURIComponent(group.code)}/orders/${myOrder.id}`, { method: "DELETE", headers: { "x-tenant-slug": "oh", ...identity } }),
              () => setConfirm(null),
            );
        }}
      />
    </div>
  );
}

function ActionCard({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-oh-ember-light/40 bg-[color-mix(in_oklab,var(--color-oh-ember-deep)_14%,var(--color-oh-ink))] p-5 md:p-7">
      <h2 className="m-0 text-xl font-semibold text-oh-cream">{title}</h2>
      <p className="m-0 mt-1 text-base text-oh-cream/80">{body}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MemberRow({ order, name, money, hostPays }: { order: GroupMemberOrder; name: string; money: (c: number) => string; hostPays: boolean }) {
  const t = useTranslations("groupLobby.members");
  const bowl = order.items.filter((i) => isBowlItem(i.menuItem.category));
  const extras = order.items.filter((i) => !isBowlItem(i.menuItem.category));
  const paid = order.paymentStatus === "PAID";
  const line = (i: GroupMemberOrder["items"][number]) => {
    const value = displayValue(i);
    return (
      <li key={i.id} className="flex justify-between gap-3 text-base">
        <span className="min-w-0 text-oh-cream/85">
          {i.menuItem.name}
          {value ? <span className="text-oh-mute">{` · ${value}`}</span> : i.quantity > 1 ? <span className="text-oh-mute">{` · ${t("quantity", { count: i.quantity })}`}</span> : null}
        </span>
        {i.priceCents > 0 ? <span className="shrink-0 tabular-nums text-oh-mute">{money(i.priceCents)}</span> : null}
      </li>
    );
  };
  return (
    <li className="rounded-2xl bg-oh-charcoal">
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-oh-cream">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oh-stone text-base font-semibold text-oh-cream">
            {name.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 truncate font-semibold text-oh-cream">{name}</span>
              {order.isGroupHost ? <span className="rounded-full bg-oh-gold/15 px-2 py-0.5 text-xs font-semibold text-oh-gold">{t("host")}</span> : null}
            </span>
            <span className="mt-0.5 block text-sm text-oh-mute">
              {t("items", { count: order.items.length })}
              <span className="sr-only">{`, ${t("show")}`}</span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-semibold tabular-nums text-oh-cream">{money(order.totalCents)}</span>
            <span className={`block text-sm ${paid ? "text-oh-olive-light" : "text-oh-mute"}`}>{paid ? t("paid") : hostPays ? t("hostPays") : t("unpaid")}</span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-oh-mute rotate-90 transition-transform group-open:-rotate-90" />
        </summary>
        <div className="grid gap-3 px-4 pb-4">
          {bowl.length ? (
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-oh-ember-light">{t("bowl")}</p>
              <ul className="m-0 mt-1 grid list-none gap-1 p-0">{bowl.map(line)}</ul>
            </div>
          ) : null}
          {extras.length ? (
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-oh-ember-light">{t("extras")}</p>
              <ul className="m-0 mt-1 grid list-none gap-1 p-0">{extras.map(line)}</ul>
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function DonePanel({ group, podLabels, soon, myOrder }: { group: Group; podLabels: string[]; soon: boolean; myOrder?: GroupMemberOrder }) {
  const t = useTranslations("groupLobby.done");
  const locale = useLocale();
  return (
    <section aria-labelledby="group-done" data-group-done className={panel}>
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-oh-olive/30 text-oh-olive-light">
        <Icon name="check" size={28} />
      </span>
      <h2 id="group-done" className="m-0 mt-5 text-2xl font-semibold text-oh-cream">
        {t("title")}
      </h2>
      <p className="m-0 mt-1 text-base text-oh-cream/80">{t("body")}</p>
      {soon ? (
        <>
          {podLabels.length ? (
            <div className="mt-6">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("pods")}</p>
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                {podLabels.map((l) => (
                  <li key={l} className="rounded-full bg-oh-gold/15 px-4 py-2 text-base font-semibold text-oh-gold">
                    {t("pod", { label: l })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="m-0 mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("steps.title")}</p>
          <ol className="m-0 mt-2 grid list-none gap-2 p-0">
            {[t("steps.go", { location: group.location.name }), t("steps.find"), t("steps.scan"), t("steps.served")].map((s, i) => (
              <li key={i} className="flex gap-3 text-base text-oh-cream/85">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-oh-stone text-sm tabular-nums text-oh-cream/70">
                  {i + 1}
                </span>
                <span className="min-w-0 pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="m-0 mt-5 text-base text-oh-cream/80">{t("later")}</p>
      )}
      {myOrder ? (
        <Link
          href={localizedHref(locale, `/order/confirmation?orderId=${myOrder.id}&orderNumber=${myOrder.orderNumber ?? ""}&groupCode=${group.code}&total=${myOrder.totalCents}&paid=true`)}
          className={`${quiet} mt-6`}
        >
          {t("view")}
        </Link>
      ) : null}
    </section>
  );
}

function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  keepLabel,
  danger,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  keepLabel: string;
  danger: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title} snapPoints={[0.5]}>
      <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-2">
        <p className="m-0 text-xl font-semibold text-oh-cream">{title}</p>
        <p className="m-0 mt-2 text-base text-oh-cream/80">{body}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onConfirm} disabled={busy} className={`${primary} ${danger ? "" : ""}`}>
            {confirmLabel}
          </button>
          <button type="button" onClick={onClose} className={quiet}>
            {keepLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
