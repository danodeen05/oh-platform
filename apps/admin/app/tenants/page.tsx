// apps/admin/app/tenants/page.tsx
export default async function Page() {
  const base = process.env.NEXT_PUBLIC_API_URL!
  const res = await fetch(base + '/tenants', { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    return <pre style={{ padding: 24, color: 'crimson' }}>API error {res.status}\n{text}</pre>
  }
  const data = await res.json()
  return (
    <main style={{ padding: 24 }}>
      <h2>Tenants</h2>
      <table cellPadding={8} style={{ borderCollapse: 'collapse', border: '1px solid #ddd' }}>
        <thead><tr><th>ID</th><th>Name</th><th>Slug</th></tr></thead>
        <tbody>
          {data.map((t: any) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.name}</td>
              <td>{t.slug}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}