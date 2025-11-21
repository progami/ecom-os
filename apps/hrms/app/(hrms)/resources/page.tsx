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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Service Providers</h1>
          <p className="text-muted-foreground mt-1">Directory of accounting firms, CPAs, designers, and more</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
          href="/resources/add"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
          >
            + Add Resource
          </Link>
        </div>
      </div>

      <div className="dashboard-card p-6">
        <div className="flex gap-3 mb-6">
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search name or description"
            className="px-4 py-2 rounded-lg border border-input w-full input-focus"
          />
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium text-sm whitespace-nowrap"
          >
            Search
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left p-3 font-semibold">Name</th>
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-left p-3 font-semibold">Subcategory</th>
                <th className="text-left p-3 font-semibold">Website</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="table-row-hover border-b border-border">
                  <td className="p-3 font-medium text-foreground">{r.name}</td>
                  <td className="p-3 text-foreground">{r.category}</td>
                  <td className="p-3 text-muted-foreground">{r.subcategory || '—'}</td>
                  <td className="p-3">{
                    r.website ? (
                      <a className="text-primary hover:text-primary/80 underline" target="_blank" href={r.website} rel="noreferrer">
                        {r.website}
                      </a>
                    ) : <span className="text-muted-foreground">—</span>
                  }</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
