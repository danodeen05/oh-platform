import LocationSelector from "./location-selector";

async function getLocations() {
  const base = process.env.NEXT_PUBLIC_API_URL!;
  // For now, we'll default to 'oh' tenant. Later we'll make this dynamic.
  const res = await fetch(`${base}/locations`, {
    cache: "no-store",
    headers: { "x-tenant-slug": "oh" },
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function OrderPage() {
  const locations = await getLocations();

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Choose Your Location</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Select a location to view the menu and current wait time
      </p>

      <LocationSelector locations={locations} />
    </main>
  );
}
