import { API_URL } from "@/lib/api";
import KioskWelcome from "./kiosk-welcome";

async function getLocations() {
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

  // If locationId is provided, use that location
  // Otherwise, use the first available location (for single-location setups)
  const locationId = params.locationId || locations[0]?.id;
  const location = locations.find((l: any) => l.id === locationId) || locations[0];

  if (!location) {
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
          <h1>Kiosk Unavailable</h1>
          <p style={{ color: "#999" }}>No locations configured.</p>
        </div>
      </main>
    );
  }

  return <KioskWelcome location={location} />;
}
