import CreateMenuForm from "../_components/create-menu";
import { MenuRowActions } from "../_components/row-actions";

async function getData(base: string) {
  const [r1, r2] = await Promise.all([
    fetch(base + "/menu", {
      cache: "no-store",
      headers: { "x-tenant-slug": "oh" }
    }),
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
  const currentTenant = tenantOptions.find((t: any) => t.slug === "oh");

  return (
    <main style={{ padding: 24 }}>
      <h2>{currentTenant?.brandName || "Oh"} Admin - Menu Items</h2>

      {/* create without leaving the page */}
      <div style={{ margin: "16px 0" }}>
        <CreateMenuForm tenantOptions={tenantOptions} />
      </div>

      <table
        cellPadding={8}
        style={{ borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "0.9rem", width: "100%" }}
      >
        <thead style={{ backgroundColor: "#f9fafb" }}>
          <tr>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Name</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Category</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Type</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Mode</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Order</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Base Price</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Extra</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Incl.</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Tenant</th>
            <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(menu) &&
            menu.map((m: any) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>{m.name}</td>
                <td style={{ padding: 12, fontFamily: "monospace", fontSize: "0.85rem" }}>
                  {m.category || "—"}
                </td>
                <td style={{ padding: 12 }}>
                  {m.categoryType ? (
                    <span style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      backgroundColor: "#e0e7ff",
                      color: "#3730a3"
                    }}>
                      {m.categoryType}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: 12, fontSize: "0.85rem" }}>
                  {m.selectionMode ? (
                    <span style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      backgroundColor: m.selectionMode === 'SLIDER' ? '#fef3c7' :
                                       m.selectionMode === 'SINGLE' ? '#dbeafe' : '#e5e7eb',
                      color: m.selectionMode === 'SLIDER' ? '#92400e' :
                             m.selectionMode === 'SINGLE' ? '#1e40af' : '#374151'
                    }}>
                      {m.selectionMode}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  {m.displayOrder ?? "—"}
                </td>
                <td style={{ padding: 12 }}>${((m.basePriceCents || 0) / 100).toFixed(2)}</td>
                <td style={{ padding: 12 }}>
                  {m.additionalPriceCents > 0
                    ? `$${(m.additionalPriceCents / 100).toFixed(2)}`
                    : "—"}
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  {m.includedQuantity > 0 ? (
                    <span style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      backgroundColor: "#d1fae5",
                      color: "#065f46"
                    }}>
                      {m.includedQuantity}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: 12, fontSize: "0.85rem" }}>
                  {tenantOptions.find((t: any) => t.id === m.tenantId)?.brandName ||
                    m.tenantId}
                </td>
                <td style={{ padding: 12 }}>
                  <MenuRowActions row={m} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </main>
  );
}
