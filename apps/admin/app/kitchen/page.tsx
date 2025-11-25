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
      <div
        style={{
          background: "#1f2937",
          padding: "16px 24px",
          borderBottom: "1px solid #374151",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>
          🍜 Kitchen Display
        </h1>
        <div style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      <KitchenDisplay locations={locations} />
    </div>
  );
}
