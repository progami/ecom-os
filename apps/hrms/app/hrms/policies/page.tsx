"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PoliciesApi, type Policy } from '@/lib/api-client'

export default function PoliciesPage() {
  const [items, setItems] = useState<Policy[]>([])
  const [q, setQ] = useState('')

  const load = async () => {
    try {
      const data = await PoliciesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load policies', e)
      setItems([])
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Policies</h1>
          <p className="text-muted-foreground">Company policies like leave and performance reviews</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hrms/policies/add" className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">+ Add Policy</Link>
          <Link href="/hrms" className="text-sm underline">Back to Dashboard</Link>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search policies by title or summary" className="px-3 py-2 rounded-md border border-input w-full" />
        <button onClick={load} className="px-3 py-2 rounded-md bg-primary text-primary-foreground">Search</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-b border-gray-200 dark:border-gray-800">
                <td className="p-2 font-medium">{p.title}</td>
                <td className="p-2">{p.category}</td>
                <td className="p-2">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
