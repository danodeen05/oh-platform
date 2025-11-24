export default async function Page() {
  const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/tenants', { cache: 'no-store' })
  const data = await res.json()
  return (
    <main style={{padding:24}}>
      <h2>Tenants</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  )
}
