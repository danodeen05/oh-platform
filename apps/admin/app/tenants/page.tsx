import CreateTenantForm from "../_components/create-tenant";
import { TenantRowActions } from "../_components/row-actions";

export default async function Page() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base)
    return (
      <pre style={{ padding: 24, color: "crimson" }}>
        Missing NEXT_PUBLIC_API_URL
      </pre>
    );

  const res = await fetch(base + "/tenants", { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    return (
      <pre style={{ padding: 24, color: "crimson" }}>
        API error {res.status}\n{text}
      </pre>
    );
  }
  const data = await res.json();

  return (
    <main style={{ padding: 24 }}>
      <h2>Tenants</h2>

      {/* create without leaving the page */}
      <div style={{ margin: "16px 0" }}>
        <CreateTenantForm />
      </div>

      <table
        cellPadding={8}
        style={{ borderCollapse: "collapse", border: "1px solid #ddd" }}
      >
        <thead>
          <tr>
            <th>Brand Name</th>
            <th>Slug</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t: any) => (
            <tr key={t.id}>
              <td>{t.brandName}</td>
              <td>{t.slug}</td>
              <td>
                <TenantRowActions row={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}