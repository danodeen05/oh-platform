import KitchenDisplay from "./kitchen-display";

async function getLocations() {
  const base = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${base}/locations`, {
    cache: "no-store",
    headers: { "x-tenant-slug": "oh" },
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function KitchenPage() {
  const locations = await getLocations();

  return (
    <div style={{ minHeight: "100vh", background: "#111827", color: "white" }}>
      <KitchenDisplay locations={locations} />
    </div>
  );
}
