'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''

export function LocationRowActions({ row }: { row: any }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(row.name || '')
  const [city, setCity] = useState(row.city || '')

  async function save() {
    await fetch(`${BASE}/locations/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, city: city || null })
    })
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete location "${row.name}"?`)) return
    await fetch(`${BASE}/locations/${row.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div style={{display:'flex', gap:8, alignItems:'center'}}>
      <input value={name} onChange={e=>setName(e.target.value)} style={{width:180}} />
      <input value={city} onChange={e=>setCity(e.target.value)} style={{width:140}} placeholder="City" />
      <button onClick={()=>start(save)} disabled={pending}>Save</button>
      <button onClick={()=>start(remove)} disabled={pending} style={{color:'crimson'}}>Delete</button>
    </div>
  )
}

export function MenuRowActions({ row }: { row: any }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(row.name || '')
  const [priceCents, setPriceCents] = useState(String(row.priceCents ?? ''))

  async function save() {
    const p = parseInt(priceCents, 10)
    if (Number.isNaN(p)) { alert('Price must be an integer in cents'); return }
    await fetch(`${BASE}/menu/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, priceCents: p })
    })
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete menu item "${row.name}"?`)) return
    await fetch(`${BASE}/menu/${row.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div style={{display:'flex', gap:8, alignItems:'center'}}>
      <input value={name} onChange={e=>setName(e.target.value)} style={{width:220}} />
      <input value={priceCents} onChange={e=>setPriceCents(e.target.value)} style={{width:120}} placeholder="Price (cents)" />
      <button onClick={()=>start(save)} disabled={pending}>Save</button>
      <button onClick={()=>start(remove)} disabled={pending} style={{color:'crimson'}}>Delete</button>
    </div>
  )
}