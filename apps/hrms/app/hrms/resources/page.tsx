"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ResourcesApi, type Resource } from '@/lib/api-client'

export default function ResourcesPage() {
  const [items, setItems] = useState<Resource[]>([])
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await ResourcesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load resources', e)
      setItems([])
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Service Providers</h1>
          <p className="text-muted-foreground">Directory of accounting firms, CPAs, designers, and more</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hrms/resources/add" className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">+ Add Resource</Link>
          <Link href="/hrms" className="text-sm underline">Back to Dashboard</Link>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or description" className="px-3 py-2 rounded-md border border-input w-full" />
        <button onClick={load} className="px-3 py-2 rounded-md bg-primary text-primary-foreground">Search</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Subcategory</th>
              <th className="text-left p-2">Website</th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-b border-gray-200 dark:border-gray-800">
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2">{r.category}</td>
                <td className="p-2">{r.subcategory || '—'}</td>
                <td className="p-2">{
                  r.website ? (
                    <a className="text-primary underline" target="_blank" href={r.website} rel="noreferrer">
                      {r.website}
                    </a>
                  ) : '—'
                }</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
