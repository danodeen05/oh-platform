import CreateMenuForm from "../_components/create-menu";
import { MenuRowActions } from "../_components/row-actions";

async function getData(base: string) {
  const [r1, r2] = await Promise.all([
    fetch(base + "/menu", { cache: "no-store" }),
    fetch(base + "/tenants", { cache: "no-store" }),
  ]);
  const [menu, tenants] = await Promise.all([r1.json(), r2.json()]);
  return { menu, tenants };
}

export default async function Page() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base)
    return (
      <pre style={{ padding: 24, color: "crimson" }}>
        Missing NEXT_PUBLIC_API_URL
      </pre>
    );

  const { menu, tenants } = await getData(base);
  const tenantOptions = Array.isArray(tenants) ? tenants : [];

  return (
    <main style={{ padding: 24 }}>
      <h2>Menu Items</h2>

      {/* create without leaving the page */}
      <div style={{ margin: "16px 0" }}>
        <CreateMenuForm tenantOptions={tenantOptions} />
      </div>

      <table
        cellPadding={8}
        style={{ borderCollapse: "collapse", border: "1px solid #ddd" }}
      >
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>Tenant</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(menu) &&
            menu.map((m: any) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>${(m.priceCents / 100).toFixed(2)}</td>
                <td>
                  {tenantOptions.find((t: any) => t.id === m.tenantId)?.name ||
                    m.tenantId}
                </td>
                <td>
                  <MenuRowActions row={m} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </main>
  );
}
