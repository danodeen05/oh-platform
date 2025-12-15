import PodConfigurator from "./pod-configurator";

async function getLocations() {
  const base = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${base}/locations`, {
    cache: "no-store",
    headers: { "x-tenant-slug": "oh" },
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function PodConfigPage() {
  const locations = await getLocations();

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div
        style={{
          background: "white",
          padding: "16px 24px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold", color: "#111827" }}>
          Pod Configuration
        </h1>
        <a
          href="/pods"
          style={{
            padding: "8px 16px",
            background: "#f3f4f6",
            color: "#374151",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Back to Cleaning View
        </a>
      </div>

      <PodConfigurator locations={locations} />
    </div>
  );
}
