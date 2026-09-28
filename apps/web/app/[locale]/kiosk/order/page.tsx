import { API_URL } from "@/lib/api";
import { getTranslations } from "next-intl/server";
import KioskOrderFlow from "./kiosk-order-flow";
import { serverApiHeaders } from "@/lib/server/api-headers";

async function getLocation(locationId: string) {
  const locRes = await fetch(`${API_URL}/locations`, {
    cache: "no-store",
    headers: serverApiHeaders({ "x-tenant-slug": "oh" }), // G3b: server-side call skips the per-IP limit
  });

  const locations = await locRes.json();
  return locations.find((l: any) => l.id === locationId);
}

export default async function KioskOrderPage({
  searchParams,
}: {
  searchParams: Promise<{
    locationId: string;
    partySize: string;
    paymentType: "single" | "separate";
  }>;
}) {
  const params = await searchParams;
  const location = await getLocation(params.locationId);
  const t = await getTranslations("kiosk");

  if (!location) {
    return (
      <main
        style={{
          minHeight: "calc(var(--kvh, 1vh) * 100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a1a",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1>{t("errors.locationNotFound")}</h1>
          <a href="/kiosk" style={{ color: "#7C7A67" }}>
            {t("errors.returnToStart")}
          </a>
        </div>
      </main>
    );
  }

  const partySize = parseInt(params.partySize) || 1;
  const paymentType = params.paymentType || "single";

  return (
    <KioskOrderFlow
      location={location}
      partySize={partySize}
      paymentType={paymentType}
    />
  );
}
