'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PoliciesApi, type Policy } from '@/lib/api-client'

// Icon components
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function DocumentPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

// Page Header Component
function PageHeader({
  title,
  description,
  icon: Icon,
  actions
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 -mt-6 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6 md:px-8 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-500 shadow-md">
              <Icon className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="flex flex-col">
            {description && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {description}
              </span>
            )}
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}

function getStatusBadgeClass(status: string) {
  const statusLower = status.toLowerCase()
  if (statusLower === 'active' || statusLower === 'published') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
  if (statusLower === 'draft') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
  if (statusLower === 'archived') return 'bg-slate-50 text-slate-600 ring-1 ring-slate-500/20'
  return 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20'
}

export default function PoliciesPage() {
  const [items, setItems] = useState<Policy[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await PoliciesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load policies', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  return (
    <>
      <PageHeader
        title="Policies"
        description="Company"
        icon={DocumentIcon}
        actions={
          <Link
            href="/policies/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Add Policy
          </Link>
        }
      />

      <div className="space-y-4">
        {/* Search */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search policies by title or summary..."
                className="pl-10 pr-4 py-2.5 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              Search
            </button>
          </form>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading...' : `${items.length} polic${items.length !== 1 ? 'ies' : 'y'} found`}
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-6 bg-slate-200 rounded-full w-16"></div></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
                          <DocumentIcon className="h-7 w-7 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">No policies found</p>
                        <p className="text-xs text-slate-500 mb-4">Get started by creating your first policy</p>
                        <Link
                          href="/policies/add"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                        >
                          <DocumentPlusIcon className="h-4 w-4" />
                          Add Policy
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900">{p.title}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {p.category}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
