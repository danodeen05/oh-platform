import KitchenDisplay from "./kitchen-display";

const base = process.env.NEXT_PUBLIC_API_URL!;

async function getJson(path: string) {
  try {
    const res = await fetch(`${base}${path}`, { cache: "no-store", headers: { "x-tenant-slug": "oh" } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function KitchenPage() {
  // Catering mode = dine-in ordering turned OFF (catering-only). In that mode
  // the kitchen lists LIVE catering events as "locations" instead of restaurants
  // and only shows catering attendee orders.
  const cfg = await getJson("/catering/site-config/order-now");
  const cateringMode = cfg ? cfg.enabled === false : false;
  const locations = (await getJson(cateringMode ? "/catering/kitchen-locations" : "/locations")) || [];

  return (
    <div style={{ minHeight: "100vh", background: "#111827", color: "white" }}>
      <KitchenDisplay locations={locations} cateringMode={cateringMode} />
    </div>
  );
}
