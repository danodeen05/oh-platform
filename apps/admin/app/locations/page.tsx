import CreateLocationForm from "../_components/create-location";
import { LocationRowActions } from "../_components/row-actions";

async function getData(base: string) {
  const [r1, r2] = await Promise.all([
    fetch(base + "/locations", {
      cache: "no-store",
      headers: { "x-tenant-slug": "oh" }
    }),
    fetch(base + "/tenants", { cache: "no-store" }),
  ]);
  const [loc, tenants] = await Promise.all([r1.json(), r2.json()]);
  return { loc, tenants };
}

export default async function Page() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base)
    return (
      <pre style={{ padding: 24, color: "crimson" }}>
        Missing NEXT_PUBLIC_API_URL
      </pre>
    );

  const { loc, tenants} = await getData(base);
  const tenantOptions = Array.isArray(tenants) ? tenants : [];
  const currentTenant = tenantOptions.find((t: any) => t.slug === "oh");

  return (
    <main style={{ padding: 24 }}>
      <h2>{currentTenant?.brandName || "Oh"} Admin - Locations</h2>

      {/* create without leaving the page */}
      <div style={{ margin: "16px 0" }}>
        <CreateLocationForm tenantOptions={tenantOptions} />
      </div>

      <table
        cellPadding={8}
        style={{ borderCollapse: "collapse", border: "1px solid #ddd" }}
      >
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
            <th>City</th>
            <th>State</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(loc) &&
            loc.map((l: any) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.address || ""}</td>
                <td>{l.city || ""}</td>
                <td>{l.state || ""}</td>
                <td>{l.phone || ""}</td>
                <td>{l.isActive ? "Active" : "Inactive"}</td>
                <td>
                  <LocationRowActions row={l} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </main>
  );
}
