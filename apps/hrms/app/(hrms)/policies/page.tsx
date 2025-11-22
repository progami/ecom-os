"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PoliciesApi, type Policy } from '@/lib/api-client'

export default function PoliciesPage() {
  const [items, setItems] = useState<Policy[]>([])
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await PoliciesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load policies', e)
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Policies</h1>
          <p className="text-muted-foreground mt-1">Company policies like leave and performance reviews</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
          href="/policies/add"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
          >
            + Add Policy
          </Link>
        </div>
      </div>

      <div className="dashboard-card p-6">
        <div className="flex gap-3 mb-6">
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search policies by title or summary"
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
                <th className="text-left p-3 font-semibold">Title</th>
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-left p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="table-row-hover border-b border-border">
                  <td className="p-3 font-medium text-foreground">{p.title}</td>
                  <td className="p-3 text-foreground">{p.category}</td>
                  <td className="p-3">
                    <span className="badge-info">{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
