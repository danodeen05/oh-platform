import { API_URL } from "@/lib/api";
import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import KioskWelcome from "./kiosk-welcome";
import KioskLocationSelector from "./kiosk-location-selector";

type Location = {
  id: string;
  name: string;
  address: string;
  city: string;
};

async function getLocations(): Promise<Location[]> {
  const res = await fetch(`${API_URL}/locations`, {
    cache: "no-store",
    headers: { "x-tenant-slug": "oh" },
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const params = await searchParams;
  const locations = await getLocations();
  const user = await currentUser();
  const t = await getTranslations("kiosk");

  // If no locations configured
  if (locations.length === 0) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a1a",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1>{t("errors.kioskUnavailable")}</h1>
          <p style={{ color: "#999" }}>{t("errors.noLocations")}</p>
        </div>
      </main>
    );
  }

  // If locationId is provided, use that location
  if (params.locationId) {
    const location = locations.find((l) => l.id === params.locationId);
    if (location) {
      return <KioskWelcome location={location} />;
    }
  }

  // No locationId provided - show location selector
  return (
    <KioskLocationSelector
      locations={locations}
      userName={user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "Staff"}
    />
  );
}
