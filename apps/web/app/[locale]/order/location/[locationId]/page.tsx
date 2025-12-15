import EnhancedMenuBuilder from "./_components/enhanced-menu-builder";
import { API_URL } from "@/lib/api";

async function getLocation(locationId: string) {
  const locRes = await fetch(`${API_URL}/locations`, {
    cache: "no-store",
    headers: { "x-tenant-slug": "oh" },
  });

  const locations = await locRes.json();
  const location = locations.find((l: any) => l.id === locationId);

  return { location };
}

export default async function LocationMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ reorderId?: string; groupCode?: string }>;
}) {
  const { locationId } = await params;
  const { reorderId, groupCode } = await searchParams;
  const { location } = await getLocation(locationId);

  if (!location) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>Location not found</h1>
        <p>The location you're looking for doesn't exist.</p>
        <a href="/order">← Back to locations</a>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/order" style={{ color: "#7C7A67", textDecoration: "none" }}>
          ← Back to locations
        </a>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, marginBottom: 8 }}>{location.name}</h1>
        <p style={{ color: "#666", margin: 0 }}>{location.address}</p>
        {location.stats && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "#f9fafb",
              borderRadius: 8,
              display: "flex",
              gap: 24,
              fontSize: "0.9rem",
            }}
          >
            <div>
              <span style={{ color: "#9ca3af" }}>Available: </span>
              <strong>
                {location.stats.availableSeats}/{location.stats.totalSeats}{" "}
                seats
              </strong>
            </div>
            <div>
              <span style={{ color: "#9ca3af" }}>Current Wait: </span>
              <strong>{location.stats.avgWaitMinutes} min</strong>
            </div>
          </div>
        )}
      </div>

      <EnhancedMenuBuilder location={location} reorderId={reorderId} groupCode={groupCode} />
    </main>
  );
}
