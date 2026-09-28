/**
 * Task D11: /order/group-payment, the host pays for the whole group, on
 * the site shell. The summary is the server's (each unpaid order's quoted
 * amount due); the card step is components/site/group/GroupPayForm (the
 * verified batch confirm, then the pods picked in the lobby).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { GroupPayForm } from "@/components/site/group/GroupPayForm";
import { GroupMissing, getGroupOrder } from "@/components/site/group/server";
import { Icon } from "@/components/site/icons/Icon";
import { formatMoney } from "@/components/site/rewards/format";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { amountDue, decodePods, liveOrders, memberName } from "@/lib/site/group";
import { localizedHref } from "@/lib/site/nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("groupLobby.payment");
  return { title: t("title"), robots: { index: false } };
}

export default async function GroupPaymentPage({ searchParams }: { searchParams: Promise<{ groupCode?: string; pods?: string }> }) {
  const params = await searchParams;
  const locale = await getLocale();
  const code = (params.groupCode ?? "").toUpperCase();
  if (!code) return <GroupMissing locale={locale} noCode />;
  const group = await getGroupOrder(code, locale);
  if (!group) return <GroupMissing code={code} locale={locale} />;

  const t = await getTranslations("groupLobby");
  const money = (c: number) => formatMoney(c, locale);
  const back = localizedHref(locale, `/group/${group.code}`);

  if (group.paymentMethod !== "HOST_PAYS_ALL") {
    return (
      <div data-group-payment className="mx-auto max-w-2xl px-5 py-20 md:px-8">
        <Display locale={locale} className="m-0 text-oh-cream">
          {t("payment.title")}
        </Display>
        <Body locale={locale} className="m-0 mt-4 text-lg text-oh-cream/80">
          {t("payment.invalidMethod")}
        </Body>
        <Link href={back} className="mt-8 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-oh-cream no-underline hover:text-oh-ember-light">
          {t("payment.back")}
        </Link>
      </div>
    );
  }

  const orders = liveOrders(group);
  const due = amountDue(orders);
  const picks = decodePods(params.pods);
  const podCount = orders.filter((o) => picks[o.id]).length;
  const hostOrder = orders.find((o) => o.isGroupHost) ?? orders[0];

  return (
    <div data-group-payment className="overflow-x-clip px-5 pb-16 pt-12 md:px-8 md:pt-20">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12">
        <section aria-labelledby="gp-title" className="min-w-0">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("payment.eyebrow")}
          </Eyebrow>
          <Display id="gp-title" locale={locale} className="m-0 mt-3 text-oh-cream">
            {t("payment.title")}
          </Display>
          <Body locale={locale} className="m-0 mt-3 text-oh-cream/75">
            {t("payment.summary", { code: group.code, location: group.location.name })}
          </Body>

          <div className="mt-8 rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-5 md:p-6">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("payment.orders")}</p>
            <ul className="m-0 mt-3 grid list-none gap-3 p-0">
              {orders.map((o) => {
                const pod = picks[o.id];
                const paid = o.paymentStatus === "PAID";
                return (
                  <li key={o.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-oh-cream">{memberName(o) ?? (o.isGroupHost ? t("members.host") : t("members.guest"))}</span>
                      <span className="block text-sm text-oh-mute">
                        {t("members.items", { count: o.items.length })}
                        {pod ? ` · ${t("done.pod", { label: pod })}` : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 tabular-nums ${paid ? "text-oh-olive-light" : "text-oh-cream"}`}>{paid ? t("members.paid") : money(o.amountDueCents ?? o.totalCents)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-center justify-between border-t border-oh-stone/70 pt-4">
              <span className="text-base font-semibold text-oh-cream/85">{t("payment.due")}</span>
              <span className="text-2xl font-semibold tabular-nums text-oh-cream">{money(due)}</span>
            </div>
            <p className="m-0 mt-4 flex items-start gap-2 text-sm text-oh-mute">
              <Icon name="pod" size={16} className="mt-0.5 shrink-0" />
              <span>
                {podCount ? t("payment.podsPicked", { count: podCount }) : t("payment.podsNone")}
                {podCount && podCount < orders.length ? <span className="mt-1 block">{t("pods.fillNote")}</span> : null}
              </span>
            </p>
          </div>
          <Link href={back} className="mt-6 inline-flex min-h-11 items-center gap-2 text-base text-oh-cream/80 no-underline hover:text-oh-cream">
            {t("payment.back")}
          </Link>
        </section>

        <section aria-label={t("payment.title")} className="min-w-0 rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-5 md:p-7">
          {hostOrder ? (
            <Suspense fallback={null}>
              <GroupPayForm groupCode={group.code} hostOrderId={hostOrder.id} hostOrderNumber={hostOrder.orderNumber} />
            </Suspense>
          ) : (
            <Body locale={locale} className="m-0 text-oh-cream/80">
              {t("mine.addFirst")}
            </Body>
          )}
        </section>
      </div>
    </div>
  );
}
