'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''

export function TenantRowActions({ row }: { row: any }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [slug, setSlug] = useState(row.slug || '')
  const [brandName, setBrandName] = useState(row.brandName || '')

  async function save() {
    await fetch(`${BASE}/tenants/${row.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ slug, brandName })
    })
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete tenant "${row.brandName}"?`)) return
    const res = await fetch(`${BASE}/tenants/${row.id}`, {
      method: 'DELETE'
    })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Delete failed')
      return
    }
    router.refresh()
  }

  return (
    <div style={{display:'flex', gap:8, alignItems:'center'}}>
      <input value={slug} onChange={e=>setSlug(e.target.value)} style={{width:140}} placeholder="Slug" />
      <input value={brandName} onChange={e=>setBrandName(e.target.value)} style={{width:220}} placeholder="Brand Name" />
      <button onClick={()=>start(save)} disabled={pending}>Save</button>
      <button onClick={()=>start(remove)} disabled={pending} style={{color:'crimson'}}>Delete</button>
    </div>
  )
}

export function LocationRowActions({ row }: { row: any }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(row.name || '')
  const [address, setAddress] = useState(row.address || '')
  const [city, setCity] = useState(row.city || '')
  const [state, setState] = useState(row.state || '')
  const [zipCode, setZipCode] = useState(row.zipCode || '')
  const [phone, setPhone] = useState(row.phone || '')

  async function save() {
    await fetch(`${BASE}/locations/${row.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': 'oh'
      },
      body: JSON.stringify({
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        phone: phone || null
      })
    })
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete location "${row.name}"?`)) return
    const res = await fetch(`${BASE}/locations/${row.id}`, {
      method: 'DELETE',
      headers: { 'x-tenant-slug': 'oh' }
    })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Delete failed')
      return
    }
    router.refresh()
  }

  return (
    <div style={{display:'flex', gap:8, alignItems:'center'}}>
      <input value={name} onChange={e=>setName(e.target.value)} style={{width:160}} placeholder="Name" />
      <input value={address} onChange={e=>setAddress(e.target.value)} style={{width:200}} placeholder="Address" />
      <input value={city} onChange={e=>setCity(e.target.value)} style={{width:120}} placeholder="City" />
      <input value={state} onChange={e=>setState(e.target.value)} style={{width:60}} placeholder="State" />
      <input value={zipCode} onChange={e=>setZipCode(e.target.value)} style={{width:80}} placeholder="Zip" />
      <input value={phone} onChange={e=>setPhone(e.target.value)} style={{width:120}} placeholder="Phone" />
      <button onClick={()=>start(save)} disabled={pending}>Save</button>
      <button onClick={()=>start(remove)} disabled={pending} style={{color:'crimson'}}>Delete</button>
    </div>
  )
}

export function MenuRowActions({ row }: { row: any }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(row.name || '')
  const [category, setCategory] = useState(row.category || '')
  const [basePriceCents, setBasePriceCents] = useState(String(row.basePriceCents ?? ''))
  const [additionalPriceCents, setAdditionalPriceCents] = useState(String(row.additionalPriceCents ?? '0'))
  const [includedQuantity, setIncludedQuantity] = useState(String(row.includedQuantity ?? '0'))

  async function save() {
    const base = parseInt(basePriceCents, 10)
    const additional = parseInt(additionalPriceCents, 10)
    const included = parseInt(includedQuantity, 10)

    if (Number.isNaN(base)) { alert('Base price must be an integer in cents'); return }
    if (Number.isNaN(additional)) { alert('Additional price must be an integer in cents'); return }
    if (Number.isNaN(included)) { alert('Included quantity must be an integer'); return }

    await fetch(`${BASE}/menu/${row.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': 'oh'
      },
      body: JSON.stringify({
        name,
        category: category || null,
        basePriceCents: base,
        additionalPriceCents: additional,
        includedQuantity: included
      })
    })
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete menu item "${row.name}"?`)) return
    const res = await fetch(`${BASE}/menu/${row.id}`, {
      method: 'DELETE',
      headers: { 'x-tenant-slug': 'oh' }
    })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Delete failed')
      return
    }
    router.refresh()
  }

  return (
    <div style={{display:'flex', gap:6, alignItems:'center', fontSize:'0.85rem'}}>
      <input value={name} onChange={e=>setName(e.target.value)} style={{width:160}} placeholder="Name" />
      <input value={category} onChange={e=>setCategory(e.target.value)} style={{width:100}} placeholder="Category" />
      <input value={basePriceCents} onChange={e=>setBasePriceCents(e.target.value)} style={{width:80}} placeholder="Base ¢" />
      <input value={additionalPriceCents} onChange={e=>setAdditionalPriceCents(e.target.value)} style={{width:80}} placeholder="Extra ¢" />
      <input value={includedQuantity} onChange={e=>setIncludedQuantity(e.target.value)} style={{width:60}} placeholder="Incl" />
      <button onClick={()=>start(save)} disabled={pending}>Save</button>
      <button onClick={()=>start(remove)} disabled={pending} style={{color:'crimson'}}>Delete</button>
    </div>
  )
}