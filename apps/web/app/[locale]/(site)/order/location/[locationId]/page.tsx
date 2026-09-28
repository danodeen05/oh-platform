/**
 * Order, steps 2 to 5 (Task D5): bowl, arrival, pod and savings for one
 * location, as ?step=... on this route. The location and the dine-in switch
 * are read on the server; everything interactive is OrderFlow.
 */
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { OrderFlow, type FlowLocation } from "@/components/site/order/OrderFlow";
import { StepSheetStatic } from "@/components/site/order/StepSheetStatic";
import type { CombLayoutKey } from "@/components/site/floor-plan/useSeats";
import { serverApiHeaders } from "@/lib/server/api-headers";

export const dynamic = "force-dynamic";

type ApiLocation = { id: string; tenantId: string; name: string; layoutKey?: string | null; timezone?: string | null; i18n?: Record<string, { name?: string }> | null };

/** `failed`: the API didn't answer (down, or rate limited), which is not the same as an unknown location. */
async function getLocation(locationId: string): Promise<{ location: ApiLocation | null; failed: boolean }> {
  try {
    const res = await fetch(`${API_URL}/locations`, { cache: "no-store", headers: serverApiHeaders({ "x-tenant-slug": "oh" }) });
    if (!res.ok) return { location: null, failed: true };
    const all: ApiLocation[] = await res.json();
    return { location: all.find((l) => l.id === locationId) ?? null, failed: false };
  } catch {
    return { location: null, failed: true };
  }
}

async function dineInEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/catering/site-config/order-now`, { cache: "no-store", headers: serverApiHeaders({ "x-tenant-slug": "oh" }) });
    if (!res.ok) return true;
    return (await res.json())?.enabled !== false;
  } catch {
    return true;
  }
}

export default async function LocationOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ reorderId?: string; groupCode?: string }>;
}) {
  const { locationId } = await params;
  const { reorderId, groupCode } = await searchParams;
  const locale = await getLocale();
  const [{ location, failed }, enabled] = await Promise.all([getLocation(locationId), dineInEnabled()]);

  if (!location && failed) {
    const t = await getTranslations("orderFlow");
    return (
      <StepSheetStatic title={t("location.loadErrorTitle")}>
        <p className="m-0 text-[15px] text-oh-mute">{t("location.loadErrorBody")}</p>
        <a href={`/${locale}/order/location/${encodeURIComponent(locationId)}`} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline">
          {t("retry")}
        </a>
      </StepSheetStatic>
    );
  }

  if (!location) {
    const t = await getTranslations("orderFlow");
    return (
      <StepSheetStatic title={t("location.notFoundTitle")}>
        <p className="m-0 text-[15px] text-oh-mute">{t("location.notFoundBody")}</p>
        <Link href={`/${locale}/order`} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline">
          {t("location.backToLocations")}
        </Link>
      </StepSheetStatic>
    );
  }

  const layoutKey = location.layoutKey === "comb-75" || location.layoutKey === "comb-70-mirrored" ? (location.layoutKey as CombLayoutKey) : null;
  const flow: FlowLocation = {
    id: location.id,
    tenantId: location.tenantId,
    name: location.i18n?.[locale]?.name || location.name,
    layoutKey,
    timezone: location.timezone || "America/Denver",
  };
  return <OrderFlow location={flow} dineInEnabled={enabled} groupCode={groupCode || null} reorderId={reorderId || null} />;
}
