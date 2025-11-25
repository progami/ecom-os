'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ResourcesApi, type Resource } from '@/lib/api-client'

// Icon components
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
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

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  )
}

function FolderPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
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

export default function ResourcesPage() {
  const [items, setItems] = useState<Resource[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await ResourcesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load resources', e)
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
        title="Service Providers"
        description="Resources"
        icon={FolderIcon}
        actions={
          <Link
            href="/resources/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Add Resource
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
                placeholder="Search by name or description..."
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
            {loading ? 'Loading...' : `${items.length} resource${items.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Subcategory</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Website</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
                          <FolderIcon className="h-7 w-7 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">No resources found</p>
                        <p className="text-xs text-slate-500 mb-4">Get started by adding your first service provider</p>
                        <Link
                          href="/resources/add"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                        >
                          <FolderPlusIcon className="h-4 w-4" />
                          Add Resource
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900">{r.name}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {r.category}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {r.subcategory || '—'}
                      </td>
                      <td className="px-5 py-4">
                        {r.website ? (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 transition-colors"
                          >
                            <span className="truncate max-w-[200px]">{r.website.replace(/^https?:\/\//, '')}</span>
                            <ExternalLinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
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
